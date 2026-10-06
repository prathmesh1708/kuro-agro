/**
 * webhookProcessor.js
 * ────────────────────
 * Processes a verified webhook payload:
 *   1. Parses the raw body via the correct provider's parser
 *   2. Looks up the DeliveryShipment + Order by orderId
 *   3. Appends the event to DeliveryShipment.webhookLog + timeline
 *   4. Normalizes the provider status → canonical Order status
 *   5. If status changed → updates Order.status (respecting allowed transitions)
 *   6. Sends in-app notifications to customer and vendors
 *
 * Called by deliveryWebhookRoutes.js AFTER signature verification.
 * Always resolves (never throws) so the webhook route can always return 200.
 */

import { parseWebhookPayload, normalizeProviderStatus } from '../deliveryManager.js';
import DeliveryShipment from '../../../models/DeliveryShipment.model.js';
import Order            from '../../../models/Order.model.js';
import { createNotification } from '../../../services/notification.service.js';
import { sendOrderStatusEmail } from '../../../services/orderEmailNotification.service.js';

// ─── Status transition guard (mirrors admin order controller) ─────────────────
const ALLOWED_TRANSITIONS = {
    pending:    ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped:    ['delivered', 'cancelled', 'returned'],
    delivered:  ['returned'],
    cancelled:  [],
    returned:   [],
};

function canTransition(from, to) {
    const allowed = ALLOWED_TRANSITIONS[String(from)] || [];
    return allowed.includes(String(to));
}

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

// ─── Main processor ───────────────────────────────────────────────────────────

/**
 * @param {string}        providerName – e.g. "shiprocket"
 * @param {string|Buffer} rawBody      – raw webhook request body
 * @param {object}        headers      – request headers
 */
export async function processWebhook(providerName, rawBody, headers) {
    let parsed;

    // 1. Parse payload
    try {
        parsed = parseWebhookPayload(providerName, rawBody, headers);
    } catch (err) {
        console.error(`[webhookProcessor] Failed to parse ${providerName} webhook:`, err.message);
        return;
    }

    const { orderId, externalId, providerStatus, meta } = parsed;

    if (!orderId && !externalId) {
        console.warn(`[webhookProcessor] ${providerName} webhook missing orderId and externalId — discarding`);
        return;
    }

    // Strip any vendor-specific suffix e.g. "ORD-12345-V6789" -> "ORD-12345"
    const baseOrderId = orderId ? String(orderId).replace(/-V[a-zA-Z0-9]+$/, '') : null;

    // 2. Look up DeliveryShipment first by AWB / externalId / Shiprocket ID
    let shipment = null;
    if (externalId) {
        shipment = await DeliveryShipment.findOne({
            $or: [
                { awbCode: externalId },
                { externalShipmentId: externalId },
                { shiprocketShipmentId: String(externalId) },
            ],
        });
    }
    if (!shipment && orderId) {
        shipment = await DeliveryShipment.findOne({
            $or: [
                { shiprocketOrderId: String(orderId) },
                { orderId: String(orderId) },
                { orderId: baseOrderId },
            ],
        });
    }

    // 3. Look up order
    let order = null;
    if (shipment?.orderMongoId) {
        order = await Order.findOne({ _id: shipment.orderMongoId, isDeleted: { $ne: true } });
    }
    if (!order && baseOrderId) {
        order = await Order.findOne({ orderId: baseOrderId, isDeleted: { $ne: true } });
    }
    if (!order && orderId) {
        order = await Order.findOne({
            $or: [
                { orderId: String(orderId) },
                { 'vendorItems.shiprocketOrderId': String(orderId) },
            ],
            isDeleted: { $ne: true },
        });
    }
    if (!order && externalId) {
        order = await Order.findOne({
            $or: [
                { externalShipmentId: externalId },
                { 'vendorItems.awbCode': externalId },
                { 'vendorItems.externalShipmentId': externalId },
            ],
            isDeleted: { $ne: true },
        });
    }

    if (!order) {
        console.warn(`[webhookProcessor] Order not found for orderId="${orderId}" (base="${baseOrderId}") externalId="${externalId}" — discarding`);
        return;
    }

    if (!shipment) {
        // Auto-create if first webhook arrives before shipment document was saved
        shipment = new DeliveryShipment({
            orderId:            order.orderId,
            orderMongoId:       order._id,
            providerName,
            externalShipmentId: externalId || undefined,
            awbCode:            externalId || undefined,
            shiprocketOrderId:  orderId || undefined,
            status:             'created',
        });
    }

    // 4. Append to webhookLog
    shipment.webhookLog = shipment.webhookLog || [];
    shipment.webhookLog.push({
        receivedAt: new Date(),
        payload:    meta,
        processed:  false,
    });

    // 5. Append to timeline
    shipment.timeline = shipment.timeline || [];
    shipment.timeline.push({
        status:    providerStatus,
        timestamp: new Date(),
        location:  parsed.location?.label || null,
        raw:       meta,
    });

    // Update external identifiers if newly received
    if (externalId && !shipment.externalShipmentId) {
        shipment.externalShipmentId = externalId;
        shipment.awbCode = externalId;
    }
    if (orderId && !shipment.shiprocketOrderId) {
        shipment.shiprocketOrderId = orderId;
    }

    // 6. Normalize status → canonical
    const canonicalStatus = normalizeProviderStatus(providerName, providerStatus);

    let statusChanged = false;
    const webhookPreviousStatus = order.status;

    // Update shipment status mapping
    const SHIPMENT_STATUS_MAP = {
        processing: 'created',
        shipped:    'in_transit',
        delivered:  'delivered',
        cancelled:  'cancelled',
        returned:   'cancelled',
    };
    if (canonicalStatus && SHIPMENT_STATUS_MAP[canonicalStatus]) {
        shipment.status = SHIPMENT_STATUS_MAP[canonicalStatus];
    }

    const targetVendorId = shipment.vendorId ? String(shipment.vendorId) : null;

    // Align vendor-specific sub-order items
    if (canonicalStatus) {
        order.vendorItems = (order.vendorItems || []).map((vi) => {
            const isTargetVendor = targetVendorId
                ? String(vi.vendorId) === targetVendorId
                : (vi.awbCode === externalId || vi.shiprocketOrderId === orderId || (order.vendorItems.length === 1));

            if (isTargetVendor) {
                const currentStatus = String(vi.status || 'pending');
                if (canTransition(currentStatus, canonicalStatus)) {
                    const viObj = vi.toObject ? vi.toObject() : vi;
                    return {
                        ...viObj,
                        status: canonicalStatus,
                        providerStatus,
                        ...(externalId ? { awbCode: externalId, externalShipmentId: externalId } : {}),
                    };
                }
            }
            return vi;
        });

        // Recompute overall order status from sub-orders
        const derivedStatus = deriveTopLevelOrderStatus(order.vendorItems, order.status);
        if (derivedStatus !== order.status) {
            order.status = derivedStatus;
            statusChanged = true;
        }

        if (order.status === 'delivered') {
            order.deliveredAt = order.deliveredAt || new Date();
            if (order.paymentMethod === 'cod') order.paymentStatus = 'paid';
        }
        if (order.status === 'cancelled') {
            order.cancelledAt = order.cancelledAt || new Date();
        }
    }

    // Mark webhook log as processed
    const lastLog = shipment.webhookLog[shipment.webhookLog.length - 1];
    if (lastLog) lastLog.processed = true;

    // 7. Persist changes
    try {
        await Promise.all([order.save(), shipment.save()]);
    } catch (err) {
        console.error(`[webhookProcessor] Failed to save order/shipment for ${order.orderId}:`, err.message);
        return;
    }

    // 8. Send notifications
    if (statusChanged || canonicalStatus) {
        const notificationTasks = [];

        if (order.userId) {
            const msgMap = {
                shipped:   `A shipment for order ${order.orderId} is out for delivery.`,
                delivered: `Your items in order ${order.orderId} have been delivered.`,
                cancelled: `A shipment for order ${order.orderId} was cancelled.`,
                returned:  `A parcel in order ${order.orderId} is being returned.`,
            };
            const msg = msgMap[canonicalStatus];
            if (msg) {
                notificationTasks.push(
                    createNotification({
                        recipientId:   order.userId,
                        recipientType: 'user',
                        title: canonicalStatus === 'delivered' ? 'Delivery Update 🎉' : 'Shipment update',
                        message: msg,
                        type: 'order',
                        data: { orderId: String(order.orderId), status: canonicalStatus },
                    })
                );
            }
        }

        // Notify the specific vendor
        const notifyVendorIds = targetVendorId
            ? [targetVendorId]
            : (order.vendorItems || []).map((vi) => String(vi?.vendorId || '')).filter(Boolean);

        notifyVendorIds.forEach((vId) => {
            notificationTasks.push(
                createNotification({
                    recipientId:   vId,
                    recipientType: 'vendor',
                    title: 'Delivery status update',
                    message: `Shipment for order ${order.orderId} updated to "${providerStatus}" (${canonicalStatus || 'updated'}).`,
                    type: 'order',
                    data: { orderId: String(order.orderId), status: canonicalStatus },
                })
            );
        });

        Promise.allSettled(notificationTasks).catch(() => {});
        sendOrderStatusEmail(order, webhookPreviousStatus, order.status).catch(() => {});
    }

    console.info(
        `[webhookProcessor] ${providerName} webhook processed for order ${order.orderId}: ` +
        `providerStatus="${providerStatus}" → canonicalStatus="${canonicalStatus || 'unmapped'}" ` +
        `(order status ${statusChanged ? `updated to "${order.status}"` : 'unchanged'})`
    );
}

export default { processWebhook };
