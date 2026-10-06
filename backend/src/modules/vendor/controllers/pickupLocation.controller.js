/**
 * pickupLocation.controller.js
 * ────────────────────────────
 * Controller for Vendor warehouse / pickup locations.
 * Handles database CRUD and automatic registration with Shiprocket.
 */

import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import PickupLocation from '../../../models/PickupLocation.model.js';
import Vendor from '../../../models/Vendor.model.js';
import { addPickupLocation, isDeliveryEnabled } from '../../delivery/deliveryManager.js';
import { cleanPickupNickname } from '../../delivery/providers/shiprocket/shiprocketProvider.js';

/** Generate a unique Shiprocket pickup nickname */
function generateShiprocketNickname(locationName, vendorId, salt = '') {
    const cleanName = cleanPickupNickname(locationName || 'Store');
    const suffix = String(vendorId || '').slice(-4);
    const combined = salt ? `${cleanName}_${suffix}_${salt}` : `${cleanName}_${suffix}`;
    return combined.slice(0, 36);
}

/** Helper to sync location with Shiprocket, auto-recovering from duplicate nickname errors */
async function syncWithShiprocket(locationPayload, vendorId) {
    let nickname = cleanPickupNickname(locationPayload.pickup_location || generateShiprocketNickname(locationPayload.name, vendorId));
    try {
        await addPickupLocation({
            ...locationPayload,
            pickup_location: nickname,
        });
        return { success: true, nickname, error: '' };
    } catch (err) {
        const errMsg = String(err.message || '');
        // If Shiprocket reports address name already exists or inactive, auto-retry with a unique salt
        if (errMsg.includes('already exists') || errMsg.includes('address name')) {
            const uniqueSalt = Date.now().toString().slice(-4);
            const freshNickname = generateShiprocketNickname(locationPayload.name, vendorId, uniqueSalt);
            try {
                await addPickupLocation({
                    ...locationPayload,
                    pickup_location: freshNickname,
                });
                return { success: true, nickname: freshNickname, error: '' };
            } catch (retryErr) {
                return { success: false, nickname: freshNickname, error: retryErr.message };
            }
        }
        return { success: false, nickname, error: err.message };
    }
}

// ─── GET /api/vendor/pickup-locations ─────────────────────────────────────────
export const getVendorPickupLocations = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    let locations = await PickupLocation.find({ vendorId }).sort({ isDefault: -1, createdAt: -1 });

    // Auto-bootstrap default location from vendor profile if empty
    if (locations.length === 0) {
        const vendor = await Vendor.findById(vendorId).lean();
        if (vendor) {
            const addr = vendor.address || vendor.businessAddress || {};
            const defaultLocation = await PickupLocation.create({
                vendorId,
                name: vendor.storeName || vendor.name || 'Main Warehouse',
                phone: vendor.phone || '',
                email: vendor.email || '',
                address: addr.street || addr.address || (typeof vendor.address === 'string' ? vendor.address : '') || '',
                city: addr.city || vendor.city || '',
                state: addr.state || vendor.state || '',
                zipCode: addr.zipCode || vendor.zipCode || vendor.pincode || '',
                country: addr.country || 'India',
                isDefault: true,
                isActive: true,
                shiprocketLocationName: generateShiprocketNickname(vendor.storeName || 'Main', vendorId),
                syncStatus: 'pending',
            });
            locations = [defaultLocation];
        }
    }

    // Auto-heal / sync any unsynced locations in the background if they have valid addresses
    for (const loc of locations) {
        if (!loc.isSyncedWithShiprocket && loc.address && loc.city && loc.zipCode) {
            const syncResult = await syncWithShiprocket({
                pickup_location: loc.shiprocketLocationName,
                name: loc.name,
                contactName: loc.name,
                phone: loc.phone || req.user.phone || '',
                email: loc.email || req.user.email || '',
                address: loc.address,
                city: loc.city,
                state: loc.state,
                pincode: loc.zipCode,
                country: loc.country || 'India',
            }, vendorId);

            if (syncResult.success) {
                loc.isSyncedWithShiprocket = true;
                loc.syncStatus = 'synced';
                loc.shiprocketLocationName = syncResult.nickname;
                loc.syncedAt = new Date();
                loc.syncError = '';
                await loc.save().catch(() => {});
            }
        }
    }

    res.status(200).json(new ApiResponse(200, locations, 'Pickup locations fetched successfully.'));
});

// ─── POST /api/vendor/pickup-locations ────────────────────────────────────────
export const createVendorPickupLocation = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    const {
        name,
        phone,
        email,
        address,
        address_2,
        city,
        state,
        zipCode,
        country = 'India',
        isDefault = false,
        operatingHours,
    } = req.body;

    if (!name || !address || !city || !state || !zipCode) {
        throw new ApiError(400, 'Name, address, city, state, and zipCode are required.');
    }

    // Check if first location -> make default automatically
    const count = await PickupLocation.countDocuments({ vendorId });
    const shouldBeDefault = isDefault || count === 0;

    if (shouldBeDefault) {
        await PickupLocation.updateMany({ vendorId }, { $set: { isDefault: false } });
    }

    const shiprocketLocationName = generateShiprocketNickname(name, vendorId);

    const newLocation = new PickupLocation({
        vendorId,
        name: name.trim(),
        phone: (phone || '').trim(),
        email: (email || '').trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        zipCode: zipCode.trim(),
        country: country.trim() || 'India',
        isDefault: shouldBeDefault,
        isActive: true,
        operatingHours,
        shiprocketLocationName,
        syncStatus: 'pending',
    });

    const syncResult = await syncWithShiprocket({
        pickup_location: shiprocketLocationName,
        name: name.trim(),
        contactName: name.trim(),
        phone: (phone || req.user.phone || '').trim(),
        email: (email || req.user.email || '').trim(),
        address: address.trim(),
        address_2: address_2 || '',
        city: city.trim(),
        state: state.trim(),
        pincode: zipCode.trim(),
        country: country.trim() || 'India',
    }, vendorId);

    if (syncResult.success) {
        newLocation.isSyncedWithShiprocket = true;
        newLocation.syncStatus = 'synced';
        newLocation.shiprocketLocationName = syncResult.nickname;
        newLocation.syncedAt = new Date();
        newLocation.syncError = '';
    } else {
        console.warn(`[pickupLocation] Shiprocket sync notice for vendor ${vendorId}:`, syncResult.error);
        newLocation.syncStatus = isDeliveryEnabled() ? 'failed' : 'pending';
        newLocation.syncError = syncResult.error;
    }

    await newLocation.save();

    res.status(201).json(new ApiResponse(201, newLocation, 'Pickup location created successfully.'));
});

// ─── PUT /api/vendor/pickup-locations/:id ─────────────────────────────────────
export const updateVendorPickupLocation = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    const location = await PickupLocation.findOne({ _id: req.params.id, vendorId });
    if (!location) throw new ApiError(404, 'Pickup location not found.');

    const {
        name,
        phone,
        email,
        address,
        address_2,
        city,
        state,
        zipCode,
        country,
        isDefault,
        isActive,
        operatingHours,
    } = req.body;

    if (name !== undefined) location.name = name.trim();
    if (phone !== undefined) location.phone = phone.trim();
    if (email !== undefined) location.email = email.trim();
    if (address !== undefined) location.address = address.trim();
    if (city !== undefined) location.city = city.trim();
    if (state !== undefined) location.state = state.trim();
    if (zipCode !== undefined) location.zipCode = zipCode.trim();
    if (country !== undefined) location.country = country.trim();
    if (isActive !== undefined) location.isActive = Boolean(isActive);
    if (operatingHours !== undefined) location.operatingHours = operatingHours;

    if (isDefault) {
        await PickupLocation.updateMany({ vendorId, _id: { $ne: location._id } }, { $set: { isDefault: false } });
        location.isDefault = true;
    }

    const currentSRName = cleanPickupNickname(location.shiprocketLocationName || generateShiprocketNickname(location.name, vendorId));
    location.shiprocketLocationName = currentSRName;

    // Re-sync with Shiprocket
    const syncResult = await syncWithShiprocket({
        pickup_location: currentSRName,
        name: location.name,
        contactName: location.name,
        phone: location.phone || req.user.phone || '',
        email: location.email || req.user.email || '',
        address: location.address,
        address_2: address_2 || '',
        city: location.city,
        state: location.state,
        pincode: location.zipCode,
        country: location.country || 'India',
    }, vendorId);

    if (syncResult.success) {
        location.isSyncedWithShiprocket = true;
        location.syncStatus = 'synced';
        location.shiprocketLocationName = syncResult.nickname;
        location.syncedAt = new Date();
        location.syncError = '';
    } else {
        console.warn(`[pickupLocation] Shiprocket update sync notice for vendor ${vendorId}:`, syncResult.error);
        location.syncStatus = isDeliveryEnabled() ? 'failed' : 'pending';
        location.syncError = syncResult.error;
    }

    await location.save();

    res.status(200).json(new ApiResponse(200, location, 'Pickup location updated successfully.'));
});

// ─── DELETE /api/vendor/pickup-locations/:id ──────────────────────────────────
export const deleteVendorPickupLocation = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    const location = await PickupLocation.findOneAndDelete({ _id: req.params.id, vendorId });
    if (!location) throw new ApiError(404, 'Pickup location not found.');

    // If deleted location was default, make remaining active location default
    if (location.isDefault) {
        const nextLoc = await PickupLocation.findOne({ vendorId }).sort({ createdAt: 1 });
        if (nextLoc) {
            nextLoc.isDefault = true;
            await nextLoc.save();
        }
    }

    res.status(200).json(new ApiResponse(200, null, 'Pickup location deleted successfully.'));
});

// ─── PATCH /api/vendor/pickup-locations/:id/default ───────────────────────────
export const setDefaultPickupLocation = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    const location = await PickupLocation.findOne({ _id: req.params.id, vendorId });
    if (!location) throw new ApiError(404, 'Pickup location not found.');

    await PickupLocation.updateMany({ vendorId }, { $set: { isDefault: false } });
    location.isDefault = true;
    await location.save();

    res.status(200).json(new ApiResponse(200, location, 'Default pickup location updated.'));
});

export default {
    getVendorPickupLocations,
    createVendorPickupLocation,
    updateVendorPickupLocation,
    deleteVendorPickupLocation,
    setDefaultPickupLocation,
};
