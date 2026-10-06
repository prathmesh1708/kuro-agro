/**
 * shiprocketProvider.js
 * ──────────────────────
 * Full implementation of IDeliveryProvider for Shiprocket.
 *
 * All methods throw ProviderError on failure so deliveryManager.js can
 * handle errors uniformly without knowing provider internals.
 */

import crypto from 'crypto';
import { shiprocketRequest, refreshShiprocketToken, ProviderError } from './shiprocketClient.js';
import { providerStatusToOrderStatus } from '../../deliveryStatusMapping.js';
import { normalizeIndianState, sanitizeAddressLine1 } from '../../../../utils/indianStates.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getChannelId() {
    return process.env.SHIPROCKET_CHANNEL_ID || null;
}

export function cleanPickupNickname(name) {
    if (!name) return 'Primary';
    // Remove special characters, convert spaces to underscores for Shiprocket nickname compliance
    let clean = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9\-_]/g, '');
    return clean.slice(0, 36).trim() || 'Primary';
}

/** Build the Shiprocket order payload from a ShipmentContext object. */
function buildOrderPayload(context) {
    const {
        orderId, pickup, drop, items, paymentMode,
        totalValue, weight, channelId,
    } = context;

    const orderItems = (items || []).map((item, idx) => ({
        name:               String(item.name || `Item ${idx + 1}`),
        sku:                String(item.sku   || `SKU-${idx}`),
        units:              Number(item.qty   || 1),
        selling_price:      String(Number(item.value || 0)),
        discount:           '',
        tax:                '',
        hsn:                item.hsn || '',
    }));

    const pickupLocationNickname = cleanPickupNickname(
        pickup?.pickup_location || pickup?.shiprocketLocationName || pickup?.name || 'Primary'
    );

    return {
        order_id:             String(orderId),
        order_date:           new Date().toISOString().split('T')[0],
        channel_id:           channelId || getChannelId() || '',
        comment:              '',
        billing_customer_name: String(drop.name   || ''),
        billing_last_name:    '',
        billing_address:      String(drop.address || ''),
        billing_address_2:    '',
        billing_city:         String(drop.city    || ''),
        billing_pincode:      String(drop.pincode || ''),
        billing_state:        normalizeIndianState(drop.state || ''),
        billing_country:      'India',
        billing_email:        String(drop.email   || ''),
        billing_phone:        String(drop.phone   || '').replace(/\D/g, '').slice(-10),
        shipping_is_billing:  true,
        payment_method:       String(paymentMode  || 'PREPAID').toUpperCase() === 'COD' ? 'COD' : 'Prepaid',
        sub_total:            Number(totalValue   || 0),
        length:               Number(context.length || 10),
        breadth:              Number(context.breadth || 10),
        height:               Number(context.height  || 5),
        weight:               Number(weight          || 0.5),
        order_items:          orderItems,
        pickup_location:      pickupLocationNickname,
    };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const shiprocketProvider = {
    name: 'shiprocket',

    // ── createShipment ─────────────────────────────────────────────────────
    async createShipment(context) {
        const payload = buildOrderPayload(context);

        // Step 0: Dynamically ensure pickup location is registered on Shiprocket
        if (context.pickup) {
            const pickupNickname = cleanPickupNickname(
                context.pickup.pickup_location ||
                context.pickup.shiprocketLocationName ||
                context.pickup.name ||
                'Primary'
            );
            const pickupPhone = String(context.pickup.phone || '').replace(/\D/g, '').slice(-10);

            try {
                await shiprocketRequest('POST', '/settings/company/addpickup', {
                    pickup_location: pickupNickname,
                    name:            String(context.pickup.contactName || context.pickup.name || 'Vendor Warehouse').slice(0, 36),
                    email:           String(context.pickup.email || 'vendor@example.com'),
                    phone:           pickupPhone,
                    address:         sanitizeAddressLine1(context.pickup.address, context.pickup.city),
                    address_2:       String(context.pickup.address_2 || '').slice(0, 80),
                    city:            String(context.pickup.city || ''),
                    state:           normalizeIndianState(context.pickup.state || ''),
                    country:         'India',
                    pin_code:        String(context.pickup.pincode || context.pickup.zipCode || ''),
                });
            } catch (err) {
                console.warn(`[shiprocketProvider] Pickup location (${pickupNickname}) registration notice:`, err.message);
            }
        }

        // Step 1: Create order on Shiprocket
        const orderRes = await shiprocketRequest('POST', '/orders/create/adhoc', payload);
        const shipmentId  = orderRes?.shipment_id;
        const orderId     = orderRes?.order_id;

        if (!shipmentId) {
            throw new ProviderError(
                'NO_SHIPMENT_ID',
                `Shiprocket did not return a shipment_id. Response: ${JSON.stringify(orderRes)}`
            );
        }

        // Run Courier Assignment, AWB Generation, Pickup Scheduling & Label Fetching
        return this.assignAwbAndPickup({
            ...context,
            shipmentId: Number(shipmentId),
            orderId:    orderId || context.orderId,
        });
    },

    // ── assignAwbAndPickup ─────────────────────────────────────────────────
    /**
     * Programmatically activates shipment (Ship Now equivalent):
     * 1. Resolves cheapest/best courier (if not already provided).
     * 2. Calls /courier/assign/awb to assign courier & generate AWB tracking code.
     * 3. Calls /courier/generate/pickup to schedule courier pickup.
     * 4. Calls /courier/generate/label to get shipping label URL.
     */
    async assignAwbAndPickup(params) {
        const shipmentId = Number(params.shipmentId || params.shiprocketShipmentId);
        const orderId    = params.orderId || params.shiprocketOrderId;

        if (!shipmentId) {
            throw new ProviderError('INVALID_SHIPMENT_ID', 'Valid shipmentId is required to assign courier/AWB.');
        }

        // Step 2A: Resolve courier (auto-select cheapest available courier if not provided)
        let resolvedCourierId = params.courierId ? Number(params.courierId) : null;
        let resolvedCourierName = params.courierName || null;

        if (!resolvedCourierId && params.pickup?.pincode && params.drop?.pincode) {
            try {
                const quote = await this.getQuote(params);
                if (quote?.courierId) {
                    resolvedCourierId = Number(quote.courierId);
                    resolvedCourierName = quote.courierName || null;
                }
            } catch (err) {
                console.warn('[shiprocketProvider] Auto-courier quote resolution notice:', err.message);
            }
        }

        // Step 2B: Generate AWB
        const awbPayload = {
            shipment_id: shipmentId, // Send as Number
        };
        if (resolvedCourierId) {
            awbPayload.courier_id = resolvedCourierId;
        }

        let awbRes;
        try {
            awbRes = await shiprocketRequest('POST', '/courier/assign/awb', awbPayload);
        } catch (err) {
            awbRes = { awb_assign_status: 0, message: err.message };
        }

        const isAwbSuccess = awbRes?.awb_assign_status === 1 ||
            Boolean(awbRes?.response?.data?.awb_code || awbRes?.awb_code);
        const awbData = awbRes?.response?.data || awbRes?.response || awbRes;
        const awb = isAwbSuccess ? (awbData?.awb_code || awbRes?.awb_code || null) : null;
        const courierId = isAwbSuccess ? (awbData?.courier_company_id || resolvedCourierId || null) : null;
        const courierName = isAwbSuccess ? (awbData?.courier_name || resolvedCourierName || null) : null;

        // If AWB assignment failed (e.g. low wallet balance, serviceability rule)
        if (!isAwbSuccess || !awb) {
            const rawMsg = typeof awbData === 'string'
                ? awbData
                : (awbRes?.message || awbData?.message || JSON.stringify(awbData));
            const isWalletLow = /wallet|recharge|balance|credit/i.test(rawMsg);
            const friendlyMsg = isWalletLow
                ? 'Shiprocket wallet balance is insufficient. Please recharge your Shiprocket wallet to assign courier and schedule pickup.'
                : (rawMsg || 'Courier assignment pending in Shiprocket.');

            return {
                externalId:          null,
                awbCode:             null,
                courierId:           null,
                courierName:         null,
                trackingUrl:         null,
                labelUrl:            null,
                label:               null,
                providerStatus:      isWalletLow ? 'WALLET_RECHARGE_REQUIRED' : 'AWB_ASSIGNMENT_PENDING',
                pickupStatus:        isWalletLow ? 'WALLET_RECHARGE_REQUIRED' : 'PENDING',
                shiprocketOrderId:   orderId,
                shiprocketShipmentId: shipmentId,
                isAwbAssigned:       false,
                isWalletLow,
                warning:             friendlyMsg,
            };
        }

        const trackingUrl = `https://shiprocket.co/tracking/${awb}`;

        // Step 3: Attempt label generation
        let labelUrl = null;
        try {
            const labelRes = await shiprocketRequest('POST', '/courier/generate/label', {
                shipment_id: [shipmentId],
            });
            labelUrl = labelRes?.label_url || labelRes?.response?.label_url || null;
        } catch (err) {
            console.warn('[shiprocketProvider] Label generation deferred:', err.message);
        }

        // Step 4: Schedule pickup automatically
        let pickupScheduled = false;
        let pickupScheduledDate = null;
        try {
            const pickupRes = await shiprocketRequest('POST', '/courier/generate/pickup', {
                shipment_id: [shipmentId],
            });
            pickupScheduled = true;
            pickupScheduledDate = pickupRes?.response?.pickup_scheduled_date || pickupRes?.pickup_scheduled_date || new Date();
        } catch (err) {
            console.warn('[shiprocketProvider] Pickup request notice:', err.message);
        }

        return {
            externalId:          awb,
            awbCode:             awb,
            courierId:           courierId ? Number(courierId) : null,
            courierName:         courierName ? String(courierName) : null,
            trackingUrl,
            labelUrl,
            label:               null,
            providerStatus:      pickupScheduled ? 'PICKUP SCHEDULED' : 'AWB ASSIGNED',
            pickupStatus:        pickupScheduled ? 'SCHEDULED' : 'PENDING',
            pickupScheduledDate,
            shiprocketOrderId:   orderId,
            shiprocketShipmentId: shipmentId,
            isAwbAssigned:       true,
            isWalletLow:         false,
        };
    },

    // ── generateLabel ──────────────────────────────────────────────────────
    async generateLabel(shipmentId) {
        const res = await shiprocketRequest('POST', '/courier/generate/label', {
            shipment_id: [shipmentId],
        });
        return res?.label_url || res?.response?.label_url || null;
    },

    // ── generateManifest ───────────────────────────────────────────────────
    async generateManifest(shipmentId) {
        const res = await shiprocketRequest('POST', '/manifests/generate', {
            shipment_id: [shipmentId],
        });
        return res?.manifest_url || res?.response?.manifest_url || null;
    },

    // ── generateInvoice ────────────────────────────────────────────────────
    async generateInvoice(orderId) {
        const res = await shiprocketRequest('POST', '/orders/print/invoice', {
            ids: [orderId],
        });
        return res?.invoice_url || res?.response?.invoice_url || null;
    },

    // ── requestPickup ──────────────────────────────────────────────────────
    async requestPickup(shipmentId) {
        const res = await shiprocketRequest('POST', '/courier/generate/pickup', {
            shipment_id: [shipmentId],
        });
        return res;
    },

    // ── cancelShipment ─────────────────────────────────────────────────────
    async cancelShipment(context) {
        if (!context.externalShipmentId && !context.shiprocketOrderId) {
            return { cancelled: false, reason: 'No Shiprocket order ID available to cancel.' };
        }

        try {
            await shiprocketRequest('POST', '/orders/cancel', {
                ids: [context.shiprocketOrderId || context.externalShipmentId],
            });
            return { cancelled: true };
        } catch (err) {
            return { cancelled: false, reason: err.message };
        }
    },

    // ── getTrackingInfo ────────────────────────────────────────────────────
    async getTrackingInfo(context) {
        const awb = context.externalShipmentId;
        if (!awb) {
            return { providerStatus: null, location: null, etaMinutes: null, etaTimestamp: null, events: [] };
        }

        const res = await shiprocketRequest('GET', `/courier/track/awb/${awb}`);
        const td  = res?.tracking_data;

        if (!td) {
            return { providerStatus: null, location: null, etaMinutes: null, etaTimestamp: null, events: [] };
        }

        const currentStatus = td?.shipment_track?.[0]?.current_status || null;
        const events        = (td?.shipment_track_activities || []).map((e) => ({
            status:    e.activity,
            timestamp: e.date,
            location:  e.location,
        }));

        return {
            providerStatus: currentStatus,
            location:       null,   // Shiprocket does not expose lat/lng in tracking API
            etaMinutes:     null,
            etaTimestamp:   null,
            events,
        };
    },

    // ── getETA ─────────────────────────────────────────────────────────────
    async getETA(context) {
        // Shiprocket doesn't expose a dedicated ETA endpoint — return null safely.
        return { etaMinutes: null, etaTimestamp: null };
    },

    // ── getQuote ───────────────────────────────────────────────────────────
    async getQuote(context) {
        const { pickup, drop, weight, totalValue } = context;

        const params = new URLSearchParams({
            pickup_postcode:   String(pickup?.pincode  || ''),
            delivery_postcode: String(drop?.pincode    || ''),
            weight:            String(Number(weight    || 0.5)),
            cod:               String(String(context.paymentMode || '').toUpperCase() === 'COD' ? 1 : 0),
            declared_value:    String(Number(totalValue || 0)),
        });

        const res = await shiprocketRequest('GET', `/courier/serviceability/?${params.toString()}`);
        const available = res?.data?.available_courier_companies || [];

        if (available.length === 0) {
            throw new ProviderError('NO_COURIERS', 'No couriers available for this route.');
        }

        // Pick the cheapest available courier
        const cheapest = available.sort((a, b) => Number(a.freight_charge) - Number(b.freight_charge))[0];

        return {
            providerName:     'shiprocket',
            price:            Number(cheapest.freight_charge || 0),
            currency:         'INR',
            breakdown: {
                base: Number(cheapest.base_weight_charge    || 0),
                fuel: Number(cheapest.fuel_surcharge        || 0),
                gst:  Number(cheapest.freight_charge_gst   || 0),
            },
            estimatedMinutes: Number(cheapest.etd_hours    || 0) * 60 || null,
            validUntil:       null,
            courierId:        cheapest.courier_company_id,
            courierName:      cheapest.courier_name,
            rawCouriers:      available,
        };
    },

    // ── mapStatus ──────────────────────────────────────────────────────────
    mapStatus(providerStatus) {
        return providerStatusToOrderStatus('shiprocket', providerStatus);
    },

    // ── verifyWebhookSignature ─────────────────────────────────────────────
    verifyWebhookSignature(rawBody, headers) {
        const secret = process.env.SHIPROCKET_WEBHOOK_SECRET;
        if (!secret) {
            // If no secret is configured, warn and accept (so dev env still works)
            console.warn('[shiprocket] SHIPROCKET_WEBHOOK_SECRET not set — skipping signature check');
            return true;
        }

        const receivedSig = String(
            headers['x-shiprocket-signature'] ||
            headers['x-sr-signature']         ||
            ''
        ).trim();

        if (!receivedSig) return false;

        const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
        const expectedSig = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');

        if (receivedSig.length !== expectedSig.length) return false;

        try {
            return crypto.timingSafeEqual(
                Buffer.from(receivedSig),
                Buffer.from(expectedSig)
            );
        } catch {
            return false;
        }
    },

    // ── parseWebhookPayload ────────────────────────────────────────────────
    parseWebhookPayload(rawBody, _headers) {
        let body;
        try {
            const raw = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
            body = JSON.parse(raw);
        } catch (err) {
            throw new ProviderError('INVALID_WEBHOOK_BODY', 'Cannot parse Shiprocket webhook body as JSON', err);
        }

        // Shiprocket webhook payload shape:
        // { awb_code, current_status, shipment_id, order_id, etd, scans: [...] }
        const orderId        = String(body?.order_id     || body?.customer_order_id || '');
        const externalId     = String(body?.awb_code     || body?.shipment_id       || '');
        const providerStatus = String(body?.current_status || '');

        return {
            orderId,
            externalId,
            providerStatus,
            location: null,
            meta: body,
        };
    },

    // ── addPickupLocation ──────────────────────────────────────────────────
    async addPickupLocation(locationData) {
        const rawNickname = locationData.pickup_location || locationData.shiprocketLocationName || locationData.name || 'Primary';
        const nickname = cleanPickupNickname(rawNickname);
        const payload = {
            pickup_location: nickname,
            name:            String(locationData.contactName || locationData.name || 'Vendor Warehouse').slice(0, 36),
            email:           String(locationData.email || 'vendor@example.com'),
            phone:           String(locationData.phone || '').replace(/\D/g, '').slice(-10),
            address:         sanitizeAddressLine1(locationData.address, locationData.city),
            address_2:       String(locationData.address_2 || '').slice(0, 80),
            city:            String(locationData.city || ''),
            state:           normalizeIndianState(locationData.state || ''),
            country:         'India',
            pin_code:        String(locationData.pincode || locationData.zipCode || ''),
        };

        const res = await shiprocketRequest('POST', '/settings/company/addpickup', payload);
        return {
            success: true,
            pickupLocationName: nickname,
            raw: res,
        };
    },

    // ── getPickupLocations ─────────────────────────────────────────────────
    async getPickupLocations() {
        const res = await shiprocketRequest('GET', '/settings/company/pickup');
        return res?.data?.shipping_address || res?.data || [];
    },

    // ── refreshToken ───────────────────────────────────────────────────────
    async refreshToken() {
        await refreshShiprocketToken();
    },
};

export default shiprocketProvider;
