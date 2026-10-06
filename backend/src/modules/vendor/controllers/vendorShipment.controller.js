/**
 * vendorShipment.controller.js (Vendor / Seller)
 * ───────────────────────────────────────────────
 * Seller endpoints for generating and managing Shiprocket shipments.
 *
 * Responsibilities:
 *   • Resolves seller's registered pickup location automatically (PickupLocation model / Vendor model).
 *   • Auto-fills product physical attributes (weight, length, breadth, height) if present.
 *   • Calls deliveryManager to create third-party shipment with central platform credentials.
 *   • Updates Order and DeliveryShipment models with AWB, courier name, labels, and tracking URL.
 *   • Provides document endpoints for shipping label, manifest, invoice, and live tracking.
 */

import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Order from '../../../models/Order.model.js';
import DeliveryShipment from '../../../models/DeliveryShipment.model.js';
import PickupLocation from '../../../models/PickupLocation.model.js';
import Vendor from '../../../models/Vendor.model.js';
import Product from '../../../models/Product.model.js';
import {
    createShipment,
    assignAwbAndPickup,
    cancelShipment,
    getTrackingInfo,
    getActiveProviderName,
} from '../../delivery/deliveryManager.js';
import shiprocketProvider from '../../delivery/providers/shiprocket/shiprocketProvider.js';
import { sendOrderStatusEmail } from '../../../services/orderEmailNotification.service.js';

/** Derive overall order status from individual vendor sub-orders */
function deriveTopLevelOrderStatus(vendorItems = [], fallback = 'pending') {
    const statuses = (vendorItems || [])
        .map((item) => String(item?.status || '').toLowerCase())
        .filter(Boolean);

    if (!statuses.length) return String(fallback || 'pending').toLowerCase();
    if (statuses.every((s) => s === 'cancelled')) return 'cancelled';
    if (statuses.every((s) => s === 'delivered')) return 'delivered';
    if (statuses.includes('shipped')) return 'shipped';
    if (statuses.includes('processing')) return 'processing';
    if (statuses.includes('pending')) return 'pending';

    return String(fallback || 'pending').toLowerCase();
}

/** Find vendor's order by orderId or Mongo _id */
async function findVendorOrder(paramId, vendorId) {
    const idFilter = [{ orderId: paramId }];
    if (paramId.match(/^[0-9a-fA-F]{24}$/)) {
        idFilter.push({ _id: paramId });
    }
    return Order.findOne({
        $or: idFilter,
        'vendorItems.vendorId': vendorId,
        isDeleted: { $ne: true },
    });
}

/** Resolve Seller's registered pickup warehouse location */
export async function resolveSellerPickupLocation(vendorId) {
    const vendor = await Vendor.findById(vendorId).lean();
    const vendorSuffix = String(vendorId || '').slice(-4);

    // 1. Try default registered PickupLocation
    let pickup = await PickupLocation.findOne({ vendorId, isDefault: true, isActive: { $ne: false } }).lean();
    if (!pickup) {
        // 2. Try any registered active PickupLocation for this vendor
        pickup = await PickupLocation.findOne({ vendorId, isActive: { $ne: false } }).lean();
    }

    if (pickup) {
        const cleanName = (pickup.name || vendor?.storeName || 'Warehouse').replace(/[^a-zA-Z0-9\-_ ]/g, '').slice(0, 25).trim();
        const nickname = pickup.shiprocketLocationName || `${cleanName}_${vendorSuffix}`;

        return {
            pickup_location:        nickname,
            shiprocketLocationName: nickname,
            name:                   pickup.name || vendor?.storeName || 'Primary Warehouse',
            contactName:            pickup.name || vendor?.name || 'Store Manager',
            phone:                  String(pickup.phone || vendor?.phone || '').replace(/\D/g, '').slice(-10),
            address:                pickup.address || '',
            address_2:              pickup.address_2 || '',
            city:                   pickup.city    || '',
            state:                  pickup.state   || '',
            pincode:                pickup.zipCode || '',
            email:                  pickup.email   || vendor?.email || '',
        };
    }

    // 3. Fallback to Vendor profile primary address (auto-generate unique vendor nickname)
    const vendorAddr = typeof vendor?.address === 'object' && vendor?.address !== null ? vendor.address : {};
    const street = vendorAddr.street || (typeof vendor?.address === 'string' ? vendor.address : '') || vendor?.storeDescription || '';
    const storeClean = (vendor?.storeName || vendor?.name || 'Store').replace(/[^a-zA-Z0-9\-_ ]/g, '').slice(0, 25).trim();
    const fallbackNickname = `${storeClean || 'Store'}_${vendorSuffix}`;

    return {
        pickup_location:        fallbackNickname,
        shiprocketLocationName: fallbackNickname,
        name:                   vendor?.storeName || vendor?.name || 'Store',
        contactName:            vendor?.name || vendor?.storeName || 'Store Owner',
        phone:                  String(vendor?.phone || '').replace(/\D/g, '').slice(-10),
        address:                street || '',
        address_2:              '',
        city:                   vendorAddr.city || vendor?.city || '',
        state:                  vendorAddr.state || vendor?.state || '',
        pincode:                vendorAddr.zipCode || vendor?.zipCode || vendor?.pincode || '',
        email:                  vendor?.email || '',
    };
}

/** Calculate or extract package dimensions and weight from products */
async function resolvePackageMetrics(orderItems = [], overrides = {}) {
    let totalWeight = 0;
    let maxLength = 10;
    let maxBreadth = 10;
    let maxHeight = 5;

    const productIds = orderItems.map((item) => item.productId).filter(Boolean);
    if (productIds.length > 0) {
        const products = await Product.find({ _id: { $in: productIds } }).lean();
        const prodMap = new Map(products.map((p) => [String(p._id), p]));

        for (const item of orderItems) {
            const prod = prodMap.get(String(item.productId));
            const qty = Number(item.quantity || 1);
            if (prod) {
                totalWeight += Number(prod.weight || 0.5) * qty;
                if (Number(prod.length || 10) > maxLength) maxLength = Number(prod.length);
                if (Number(prod.breadth || 10) > maxBreadth) maxBreadth = Number(prod.breadth);
                if (Number(prod.height || 5) > maxHeight) maxHeight = Number(prod.height);
            } else {
                totalWeight += 0.5 * qty;
            }
        }
    }

    return {
        weight: Number(overrides.weight || totalWeight || 0.5),
        length: Number(overrides.length || maxLength || 10),
        breadth: Number(overrides.breadth || maxBreadth || 10),
        height: Number(overrides.height || maxHeight || 5),
    };
}
// ─── POST /api/vendor/orders/:id/shipment ─────────────────────────────────────
export const createVendorShipment = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    const order = await findVendorOrder(req.params.id, vendorId);
    if (!order) throw new ApiError(404, 'Order not found for this vendor.');

    if (['cancelled', 'returned', 'delivered'].includes(order.status)) {
        throw new ApiError(409, `Cannot create shipment for a ${order.status} order.`);
    }

    // Check for existing active shipment for this vendor
    const existing = await DeliveryShipment.findOne({
        orderId: order.orderId,
        vendorId,
        status: { $nin: ['failed', 'cancelled'] },
    });
    if (existing) {
        throw new ApiError(409, `A shipment already exists for your items in order ${order.orderId} (AWB: ${existing.awbCode || existing.externalShipmentId || 'N/A'}).`);
    }

    // Extract seller-specific items
    const vendorGroup = (order.vendorItems || []).find((vi) => String(vi.vendorId) === String(vendorId));
    const itemsToShip = vendorGroup?.items?.length ? vendorGroup.items : order.items;

    // Resolve pickup location & physical dimensions
    const pickup = req.body?.pickup || await resolveSellerPickupLocation(vendorId);
    const metrics = await resolvePackageMetrics(itemsToShip, req.body);

    const isMultiVendorOrder = (order.vendorItems || []).length > 1;
    const vendorSuffix = String(vendorId).slice(-4);
    const shiprocketVendorOrderId = isMultiVendorOrder
        ? `${order.orderId}-V${vendorSuffix}`
        : order.orderId;

    const vendorTotalValue = Number(
        (vendorGroup?.subtotal || 0) + (vendorGroup?.shipping || 0) + (vendorGroup?.tax || 0) - (vendorGroup?.discount || 0)
    ) || Number(order.total || order.subtotal || 0);

    const addr = order.shippingAddress || {};
    const context = {
        orderId:         shiprocketVendorOrderId,
        parentOrderId:   order.orderId,
        orderMongoId:    String(order._id),
        vendorId,
        pickup,
        drop: {
            name:    addr.name    || '',
            phone:   addr.phone   || '',
            email:   addr.email   || '',
            address: addr.address || '',
            city:    addr.city    || '',
            state:   addr.state   || '',
            pincode: addr.zipCode || '',
        },
        items: itemsToShip.map((item) => ({
            name:  item.name  || 'Item',
            sku:   String(item.productId || ''),
            qty:   item.quantity  || 1,
            value: item.price     || 0,
        })),
        paymentMode: String(order.paymentMethod || 'PREPAID').toUpperCase() === 'COD' ? 'COD' : 'PREPAID',
        totalValue:  vendorTotalValue,
        weight:      metrics.weight,
        length:      metrics.length,
        breadth:     metrics.breadth,
        height:      metrics.height,
        idempotencyKey: `shipment:vendor:${vendorId}:${order.orderId}:${getActiveProviderName()}`,
    };

    const providerName = getActiveProviderName();
    let shipmentResult;

    try {
        shipmentResult = await createShipment(context);
    } catch (err) {
        console.error('[vendorShipment.controller] Shipment creation error:', err);
        await DeliveryShipment.create({
            orderId:      order.orderId,
            orderMongoId: order._id,
            vendorId,
            providerName,
            status:        'failed',
            failureReason: err.message || String(err),
        });
        throw new ApiError(502, err.message || 'Failed to create shipment with Shiprocket.');
    }

    const isAwbAssigned = Boolean(shipmentResult.isAwbAssigned && shipmentResult.awbCode);
    const resolvedPickupStatus = shipmentResult.pickupStatus || (isAwbAssigned ? 'SCHEDULED' : 'PENDING');
    const resolvedProviderStatus = shipmentResult.providerStatus || (isAwbAssigned ? 'PICKUP SCHEDULED' : 'CREATED');

    // Persist DeliveryShipment record
    const shipment = await DeliveryShipment.create({
        orderId:              order.orderId,
        orderMongoId:         order._id,
        vendorId,
        providerName,
        externalShipmentId:   shipmentResult.externalId           || null,
        shiprocketOrderId:    shipmentResult.shiprocketOrderId    || shiprocketVendorOrderId,
        shiprocketShipmentId: shipmentResult.shiprocketShipmentId || null,
        awbCode:              shipmentResult.awbCode              || null,
        courierId:            shipmentResult.courierId            || null,
        courierName:          shipmentResult.courierName          || null,
        trackingUrl:          shipmentResult.trackingUrl          || null,
        labelUrl:             shipmentResult.labelUrl             || null,
        status:               'created',
        pickupStatus:         resolvedPickupStatus,
        pickupScheduledDate:  shipmentResult.pickupScheduledDate  || null,
        shipmentCreatedAt:    new Date(),
        idempotencyKey:       context.idempotencyKey,
        timeline: [{
            status:    resolvedProviderStatus,
            timestamp: new Date(),
        }],
    });

    // Update vendor-specific sub-order in vendorItems
    order.vendorItems = (order.vendorItems || []).map((vi) => {
        if (String(vi.vendorId) === String(vendorId)) {
            const viObj = vi.toObject ? vi.toObject() : vi;
            return {
                ...viObj,
                status: isAwbAssigned ? 'shipped' : (viObj.status || 'processing'),
                shipmentId: shipment._id,
                providerName,
                externalShipmentId: shipmentResult.externalId || null,
                shiprocketOrderId: shipmentResult.shiprocketOrderId || shiprocketVendorOrderId,
                shiprocketShipmentId: shipmentResult.shiprocketShipmentId || null,
                awbCode: shipmentResult.awbCode || null,
                courierId: shipmentResult.courierId || null,
                courierName: shipmentResult.courierName || null,
                trackingUrl: shipmentResult.trackingUrl || null,
                labelUrl: shipmentResult.labelUrl || null,
                pickupStatus: resolvedPickupStatus,
                providerStatus: resolvedProviderStatus,
                shipmentCreatedAt: new Date(),
            };
        }
        return vi;
    });

    // Sync Order top-level fields (defaulting to first or single shipment)
    if (!order.awbCode || !isMultiVendorOrder) {
        order.providerName          = providerName;
        order.externalShipmentId    = shipmentResult.externalId || null;
        order.awbCode               = shipmentResult.awbCode || null;
        order.courierId             = shipmentResult.courierId || null;
        order.courierName           = shipmentResult.courierName || null;
        order.shiprocketOrderId    = shipmentResult.shiprocketOrderId || shiprocketVendorOrderId;
        order.shiprocketShipmentId = shipmentResult.shiprocketShipmentId || null;
        order.trackingUrl           = shipmentResult.trackingUrl || null;
        order.labelUrl              = shipmentResult.labelUrl || null;
        order.providerStatus        = resolvedProviderStatus;
        order.pickupStatus          = resolvedPickupStatus;
        order.shipmentCreatedAt     = new Date();
    }

    const prevShipmentStatus = order.status;
    if (isAwbAssigned) {
        order.status = deriveTopLevelOrderStatus(order.vendorItems, order.status);
    }

    await order.save();

    // Send email notification if order status transitioned to shipped
    if (isAwbAssigned) {
        sendOrderStatusEmail(order, prevShipmentStatus, order.status).catch(() => {});
    }

    const responseMsg = isAwbAssigned
        ? `Shiprocket shipment created & pickup scheduled with ${shipmentResult.courierName || 'assigned courier'}.`
        : (shipmentResult.warning || 'Shiprocket order registered. Courier assignment pending.');

    res.status(201).json(
        new ApiResponse(201, { order, shipment, shipmentResult, isAwbAssigned, isWalletLow: shipmentResult.isWalletLow }, responseMsg)
    );
});

// ─── POST /api/vendor/orders/:id/shipment/pickup ──────────────────────────────
export const scheduleVendorPickup = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    const order = await findVendorOrder(req.params.id, vendorId);
    if (!order) throw new ApiError(404, 'Order not found for this vendor.');

    const vendorGroup = (order.vendorItems || []).find((vi) => String(vi.vendorId) === String(vendorId));
    let shipment = await DeliveryShipment.findOne({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
        vendorId,
        status: { $nin: ['cancelled'] },
    });

    const srShipmentId = shipment?.shiprocketShipmentId || vendorGroup?.shiprocketShipmentId || order.shiprocketShipmentId;
    const srOrderId = shipment?.shiprocketOrderId || vendorGroup?.shiprocketOrderId || order.shiprocketOrderId;

    if (!srShipmentId) {
        throw new ApiError(400, 'No existing Shiprocket shipment found. Please create shipment first.');
    }

    const pickup = req.body?.pickup || await resolveSellerPickupLocation(vendorId);
    const itemsToShip = vendorGroup?.items?.length ? vendorGroup.items : order.items;
    const metrics = await resolvePackageMetrics(itemsToShip, req.body);
    const addr = order.shippingAddress || {};

    const context = {
        shipmentId: Number(srShipmentId),
        orderId: srOrderId || order.orderId,
        pickup,
        drop: {
            name:    addr.name    || '',
            phone:   addr.phone   || '',
            email:   addr.email   || '',
            address: addr.address || '',
            city:    addr.city    || '',
            state:   addr.state   || '',
            pincode: addr.zipCode || '',
        },
        paymentMode: String(order.paymentMethod || 'PREPAID').toUpperCase() === 'COD' ? 'COD' : 'PREPAID',
        totalValue: Number(vendorGroup?.subtotal || order.total || 0),
        weight: metrics.weight,
        courierId: req.body?.courierId || null,
    };

    const shipmentResult = await assignAwbAndPickup(context);

    if (!shipmentResult.isAwbAssigned || !shipmentResult.awbCode) {
        throw new ApiError(422, shipmentResult.warning || 'Failed to assign courier and schedule pickup.');
    }

    // Update DeliveryShipment record
    if (shipment) {
        shipment.awbCode = shipmentResult.awbCode;
        shipment.courierId = shipmentResult.courierId || shipment.courierId;
        shipment.courierName = shipmentResult.courierName || shipment.courierName;
        shipment.trackingUrl = shipmentResult.trackingUrl || shipment.trackingUrl;
        shipment.labelUrl = shipmentResult.labelUrl || shipment.labelUrl;
        shipment.pickupStatus = shipmentResult.pickupStatus || 'SCHEDULED';
        shipment.pickupScheduledDate = shipmentResult.pickupScheduledDate || new Date();
        shipment.timeline.push({
            status: shipmentResult.providerStatus || 'PICKUP SCHEDULED',
            timestamp: new Date(),
        });
        await shipment.save();
    }

    // Update vendorItems
    order.vendorItems = (order.vendorItems || []).map((vi) => {
        if (String(vi.vendorId) === String(vendorId)) {
            return {
                ...(vi.toObject ? vi.toObject() : vi),
                status: 'shipped',
                awbCode: shipmentResult.awbCode,
                courierId: shipmentResult.courierId,
                courierName: shipmentResult.courierName,
                trackingUrl: shipmentResult.trackingUrl,
                labelUrl: shipmentResult.labelUrl || vi.labelUrl,
                pickupStatus: 'SCHEDULED',
                providerStatus: 'PICKUP SCHEDULED',
            };
        }
        return vi;
    });

    order.awbCode = shipmentResult.awbCode;
    order.courierId = shipmentResult.courierId || order.courierId;
    order.courierName = shipmentResult.courierName || order.courierName;
    order.trackingUrl = shipmentResult.trackingUrl || order.trackingUrl;
    order.labelUrl = shipmentResult.labelUrl || order.labelUrl;
    order.providerStatus = 'PICKUP SCHEDULED';
    order.pickupStatus = 'SCHEDULED';

    const prevStatus = order.status;
    order.status = deriveTopLevelOrderStatus(order.vendorItems, order.status);
    await order.save();

    sendOrderStatusEmail(order, prevStatus, order.status).catch(() => {});

    res.status(200).json(
        new ApiResponse(200, { order, shipment, shipmentResult }, 'Courier assigned and pickup scheduled successfully!')
    );
});

// ─── GET /api/vendor/orders/:id/shipment ─────────────────────────────────────
export const getVendorShipment = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    const order = await findVendorOrder(req.params.id, vendorId);
    if (!order) throw new ApiError(404, 'Order not found for this vendor.');

    const shipment = await DeliveryShipment.findOne({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
        vendorId,
    }).lean();

    const pickupLocation = await resolveSellerPickupLocation(vendorId);
    const vendorGroup = (order.vendorItems || []).find((vi) => String(vi.vendorId) === String(vendorId));
    const itemsToInspect = vendorGroup?.items?.length ? vendorGroup.items : order.items;
    const metrics = await resolvePackageMetrics(itemsToInspect);

    res.status(200).json(
        new ApiResponse(200, { order, shipment, vendorGroup, pickupLocation, metrics }, 'Shipment details fetched.')
    );
});

// ─── GET /api/vendor/orders/:id/shipment/tracking ────────────────────────────
export const getVendorShipmentTracking = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    const order = await findVendorOrder(req.params.id, vendorId);
    if (!order) throw new ApiError(404, 'Order not found.');

    const vendorGroup = (order.vendorItems || []).find((vi) => String(vi.vendorId) === String(vendorId));
    const shipment = await DeliveryShipment.findOne({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
        vendorId,
    }).select('timeline status externalShipmentId awbCode courierName trackingUrl labelUrl shiprocketOrderId shiprocketShipmentId').lean();

    const awb = vendorGroup?.awbCode || shipment?.awbCode || shipment?.externalShipmentId || order.awbCode || order.externalShipmentId;
    if (!awb) {
        throw new ApiError(404, 'No active shipment tracking available for this order.');
    }

    const tracking = await getTrackingInfo({ externalShipmentId: awb });

    res.status(200).json(
        new ApiResponse(200, { liveTracking: tracking, shipment, vendorGroup }, 'Tracking info fetched.')
    );
});

// ─── GET /api/vendor/orders/:id/shipment/label ────────────────────────────────
export const getVendorShipmentLabel = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    const order = await findVendorOrder(req.params.id, vendorId);
    if (!order) throw new ApiError(404, 'Order not found.');

    const vendorGroup = (order.vendorItems || []).find((vi) => String(vi.vendorId) === String(vendorId));
    const shipment = await DeliveryShipment.findOne({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
        vendorId,
    });

    let labelUrl = vendorGroup?.labelUrl || shipment?.labelUrl || order.labelUrl;
    const srShipmentId = shipment?.shiprocketShipmentId || vendorGroup?.shiprocketShipmentId || order.shiprocketShipmentId;

    if (!labelUrl && srShipmentId) {
        try {
            labelUrl = await shiprocketProvider.generateLabel(srShipmentId);
            if (labelUrl) {
                if (shipment) {
                    shipment.labelUrl = labelUrl;
                    await shipment.save();
                }
                order.vendorItems = (order.vendorItems || []).map((vi) =>
                    String(vi.vendorId) === String(vendorId) ? { ...vi.toObject(), labelUrl } : vi
                );
                if (!order.labelUrl) order.labelUrl = labelUrl;
                await order.save();
            }
        } catch (err) {
            throw new ApiError(502, `Failed to generate shipping label: ${err.message}`);
        }
    }

    if (!labelUrl) {
        // Fallback: Generate printable shipping label HTML data URI
        const pickup = await resolveSellerPickupLocation(vendorId);
        const vendor = await Vendor.findById(vendorId).lean();
        const shippingAddr = order.shippingAddress || {};
        const itemsToPrint = vendorGroup?.items || order.items || [];
        const itemsHtml = itemsToPrint.map((item, i) => `
            <tr>
                <td style="padding: 6px; border-bottom: 1px solid #eee;">${item.name || `Item ${i+1}`}</td>
                <td style="padding: 6px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
                <td style="padding: 6px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price || 0}</td>
            </tr>
        `).join('');

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Shipping Label - ${order.orderId}</title>
    <style>
        body { font-family: 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f3f4f6; }
        .label-card { max-width: 550px; margin: 0 auto; background: #ffffff; border: 2px dashed #111827; padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 16px; }
        .barcode { text-align: center; font-family: monospace; font-size: 22px; font-weight: bold; letter-spacing: 4px; border: 1px solid #000; padding: 8px; margin: 12px 0; background: #f9fafb; border-radius: 4px; }
        .section { margin-bottom: 16px; }
        .title { font-size: 11px; text-transform: uppercase; color: #4b5563; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px; }
        .content { font-size: 13px; line-height: 1.5; color: #111827; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .items-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
        .btn-print { display: block; width: 100%; max-width: 550px; margin: 16px auto; padding: 12px; background: #7c3aed; color: white; text-align: center; font-weight: bold; text-decoration: none; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; }
        @media print { .btn-print { display: none; } body { padding: 0; background: #fff; } .label-card { border: 2px solid #000; box-shadow: none; } }
    </style>
</head>
<body>
    <button class="btn-print" onclick="window.print()">🖨️ Print Shipping Label</button>
    <div class="label-card">
        <div class="header">
            <div>
                <h2 style="margin:0; font-size: 18px; font-weight: 800; color: #111827;">SHIPPING LABEL</h2>
                <p style="margin:4px 0 0 0; color:#6b7280; font-size:12px;">Order ID: <strong>#${order.orderId}</strong></p>
            </div>
            <div style="text-align: right;">
                <span style="display:inline-block; padding:4px 10px; background:#e0e7ff; color:#3730a3; font-weight:bold; border-radius:6px; font-size:11px;">
                    ${String(order.paymentMethod || 'PREPAID').toUpperCase()}
                </span>
            </div>
        </div>

        <div class="barcode">*${order.orderId}*</div>

        <div class="grid">
            <div class="section">
                <div class="title">SHIP FROM (SELLER):</div>
                <div class="content">
                    <strong>${pickup?.name || vendor?.storeName || vendor?.name || 'Seller Store'}</strong><br/>
                    ${pickup?.address || ''}<br/>
                    ${pickup?.city ? pickup.city + ', ' : ''}${pickup?.state || ''} ${pickup?.pincode ? '- ' + pickup.pincode : ''}<br/>
                    Phone: ${pickup?.phone || vendor?.phone || 'N/A'}
                </div>
            </div>
            <div class="section">
                <div class="title">SHIP TO (CUSTOMER):</div>
                <div class="content">
                    <strong>${shippingAddr.name || 'Customer'}</strong><br/>
                    ${shippingAddr.address || ''}<br/>
                    ${shippingAddr.city ? shippingAddr.city + ', ' : ''}${shippingAddr.state || ''} - <strong>${shippingAddr.zipCode || ''}</strong><br/>
                    Phone: ${shippingAddr.phone || 'N/A'}
                </div>
            </div>
        </div>

        <div class="section" style="margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
            <div class="title">PACKAGE ITEMS:</div>
            <table class="items-table">
                <thead>
                    <tr style="background: #f9fafb; text-align: left;">
                        <th style="padding: 6px;">Item</th>
                        <th style="padding: 6px; text-align: center;">Qty</th>
                        <th style="padding: 6px; text-align: right;">Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
        </div>
        <div style="margin-top: 16px; text-align: right; font-weight: bold; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 8px;">
            Subtotal: ₹${vendorGroup?.subtotal || order.total || order.subtotal || 0}
        </div>
    </div>
</body>
</html>`;
        labelUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    }

    res.status(200).json(new ApiResponse(200, { labelUrl }, 'Shipping label fetched.'));
});

// ─── GET /api/vendor/orders/:id/shipment/manifest ─────────────────────────────
export const getVendorShipmentManifest = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    const order = await findVendorOrder(req.params.id, vendorId);
    if (!order) throw new ApiError(404, 'Order not found.');

    const vendorGroup = (order.vendorItems || []).find((vi) => String(vi.vendorId) === String(vendorId));
    const shipment = await DeliveryShipment.findOne({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
        vendorId,
    });

    let manifestUrl = vendorGroup?.manifestUrl || shipment?.manifestUrl || order.manifestUrl;
    const srShipmentId = shipment?.shiprocketShipmentId || vendorGroup?.shiprocketShipmentId || order.shiprocketShipmentId;

    if (!manifestUrl && srShipmentId) {
        try {
            manifestUrl = await shiprocketProvider.generateManifest(srShipmentId);
            if (manifestUrl) {
                if (shipment) {
                    shipment.manifestUrl = manifestUrl;
                    await shipment.save();
                }
                order.vendorItems = (order.vendorItems || []).map((vi) =>
                    String(vi.vendorId) === String(vendorId) ? { ...vi.toObject(), manifestUrl } : vi
                );
                if (!order.manifestUrl) order.manifestUrl = manifestUrl;
                await order.save();
            }
        } catch (err) {
            throw new ApiError(502, `Failed to generate manifest: ${err.message}`);
        }
    }

    if (!manifestUrl) throw new ApiError(404, 'Manifest document not available yet.');
    res.status(200).json(new ApiResponse(200, { manifestUrl }, 'Manifest fetched.'));
});

// ─── GET /api/vendor/orders/:id/shipment/invoice ──────────────────────────────
export const getVendorShipmentInvoice = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    const order = await findVendorOrder(req.params.id, vendorId);
    if (!order) throw new ApiError(404, 'Order not found.');

    const vendorGroup = (order.vendorItems || []).find((vi) => String(vi.vendorId) === String(vendorId));
    const shipment = await DeliveryShipment.findOne({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
        vendorId,
    });

    let invoiceUrl = vendorGroup?.invoiceUrl || shipment?.invoiceUrl || order.invoiceUrl;
    const srOrderId = shipment?.shiprocketOrderId || vendorGroup?.shiprocketOrderId || order.shiprocketOrderId;

    if (!invoiceUrl && srOrderId) {
        try {
            invoiceUrl = await shiprocketProvider.generateInvoice(srOrderId);
            if (invoiceUrl) {
                if (shipment) {
                    shipment.invoiceUrl = invoiceUrl;
                    await shipment.save();
                }
                order.vendorItems = (order.vendorItems || []).map((vi) =>
                    String(vi.vendorId) === String(vendorId) ? { ...vi.toObject(), invoiceUrl } : vi
                );
                if (!order.invoiceUrl) order.invoiceUrl = invoiceUrl;
                await order.save();
            }
        } catch (err) {
            throw new ApiError(502, `Failed to generate invoice: ${err.message}`);
        }
    }

    if (!invoiceUrl) throw new ApiError(404, 'Invoice document not available yet.');
    res.status(200).json(new ApiResponse(200, { invoiceUrl }, 'Invoice fetched.'));
});

// ─── POST /api/vendor/orders/:id/shipment/cancel ─────────────────────────────
export const cancelVendorShipment = asyncHandler(async (req, res) => {
    const vendorId = req.user.id;
    const order = await findVendorOrder(req.params.id, vendorId);
    if (!order) throw new ApiError(404, 'Order not found.');

    const vendorGroup = (order.vendorItems || []).find((vi) => String(vi.vendorId) === String(vendorId));
    if (vendorGroup && ['delivered'].includes(vendorGroup.status)) {
        throw new ApiError(409, 'Cannot cancel shipment for already delivered items.');
    }

    const shipment = await DeliveryShipment.findOne({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
        vendorId,
        status: { $nin: ['cancelled', 'failed'] },
    });

    const result = await cancelShipment({
        externalShipmentId: shipment?.externalShipmentId || vendorGroup?.awbCode || order.externalShipmentId,
        shiprocketOrderId:  shipment?.shiprocketOrderId  || vendorGroup?.shiprocketOrderId || order.shiprocketOrderId,
    });

    if (shipment) {
        shipment.status = 'cancelled';
        shipment.shipmentCancelledAt = new Date();
        shipment.timeline.push({ status: 'CANCELLED_BY_SELLER', timestamp: new Date() });
        await shipment.save();
    }

    order.vendorItems = (order.vendorItems || []).map((vi) =>
        String(vi.vendorId) === String(vendorId)
            ? { ...vi.toObject(), status: 'cancelled', shipmentCancelledAt: new Date() }
            : vi
    );

    order.status = deriveTopLevelOrderStatus(order.vendorItems, order.status);
    await order.save();

    res.status(200).json(new ApiResponse(200, { result }, 'Vendor shipment cancellation completed.'));
});
