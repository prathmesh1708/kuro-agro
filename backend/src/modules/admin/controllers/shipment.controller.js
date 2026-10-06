/**
 * shipment.controller.js  (Admin)
 * ────────────────────────────────
 * Admin endpoints for managing third-party delivery shipments.
 *
 * All write operations persist to both DeliveryShipment and Order models
 * so admin dashboards and customer-facing APIs always see consistent data.
 *
 * Routes (all require admin auth):
 *   POST  /api/admin/orders/:id/shipment         – create shipment with provider
 *   POST  /api/admin/orders/:id/shipment/cancel  – cancel shipment with provider
 *   GET   /api/admin/orders/:id/shipment/tracking – live tracking from provider
 *   GET   /api/admin/orders/:id/shipment/quote    – get delivery quote
 *   GET   /api/admin/orders/:id/shipment          – get stored shipment record
 *   POST  /api/admin/delivery/token/refresh       – force provider token refresh
 */

import asyncHandler   from '../../../utils/asyncHandler.js';
import ApiResponse    from '../../../utils/ApiResponse.js';
import ApiError       from '../../../utils/ApiError.js';
import Order          from '../../../models/Order.model.js';
import DeliveryShipment from '../../../models/DeliveryShipment.model.js';
import {
    createShipment,
    assignAwbAndPickup,
    cancelShipment,
    getTrackingInfo,
    getQuote,
    getActiveProviderName,
    refreshProviderToken,
} from '../../delivery/deliveryManager.js';
import shiprocketProvider from '../../delivery/providers/shiprocket/shiprocketProvider.js';
import { sendOrderStatusEmail } from '../../../services/orderEmailNotification.service.js';

import { resolveSellerPickupLocation } from '../../vendor/controllers/vendorShipment.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve order by orderId string OR MongoDB _id. */
async function findOrder(paramId) {
    return Order.findOne({
        $or: [
            { orderId: paramId },
            ...(paramId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: paramId }] : []),
        ],
        isDeleted: { $ne: true },
    });
}

/**
 * Builds the unified ShipmentContext object from an Order document.
 * Includes dimensions, package attributes, pickup warehouse info, and item list.
 */
async function buildContext(order, overrides = {}) {
    const addr = order.shippingAddress || {};
    const firstVendorId = (order.vendorItems || [])[0]?.vendorId || null;
    const pickup = overrides.pickup || (firstVendorId ? await resolveSellerPickupLocation(firstVendorId) : null);

    return {
        orderId:         order.orderId,
        parentOrderId:   order.orderId,
        orderMongoId:    String(order._id),
        pickup:          pickup || {
            name:    process.env.SHIPROCKET_PICKUP_NAME    || 'Main Warehouse',
            phone:   process.env.SHIPROCKET_PICKUP_PHONE   || '9999999999',
            address: process.env.SHIPROCKET_PICKUP_ADDRESS || 'Warehouse address',
            city:    process.env.SHIPROCKET_PICKUP_CITY    || 'Delhi',
            state:   process.env.SHIPROCKET_PICKUP_STATE   || 'Delhi',
            pincode: process.env.SHIPROCKET_PICKUP_PINCODE || '110001',
        },
        drop: {
            name:    addr.name    || '',
            phone:   addr.phone   || '',
            email:   addr.email   || '',
            address: addr.address || '',
            city:    addr.city    || '',
            state:   addr.state   || '',
            pincode: addr.zipCode || '',
        },
        items: (order.items || []).map((item) => ({
            name:  item.name  || 'Item',
            sku:   String(item.productId || ''),
            qty:   item.quantity  || 1,
            value: item.price     || 0,
        })),
        paymentMode: String(order.paymentMethod || 'PREPAID').toUpperCase() === 'COD' ? 'COD' : 'PREPAID',
        totalValue:  Number(order.total || 0),
        weight:      Number(overrides.weight  || 0.5),
        length:      Number(overrides.length  || 10),
        breadth:     Number(overrides.breadth || 10),
        height:      Number(overrides.height  || 5),
        preferredProvider: overrides.provider || null,
        idempotencyKey: `shipment:admin:${order.orderId}:${getActiveProviderName()}`,
    };
}

// ─── POST /api/admin/orders/:id/shipment ─────────────────────────────────────

export const createOrderShipment = asyncHandler(async (req, res) => {
    const order = await findOrder(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found.');

    if (['cancelled', 'returned', 'delivered'].includes(order.status)) {
        throw new ApiError(409, `Cannot create shipment for a ${order.status} order.`);
    }

    // Prevent duplicate shipment creation
    const existing = await DeliveryShipment.findOne({
        orderId: order.orderId,
        status: { $nin: ['failed', 'cancelled'] },
    });
    if (existing) {
        throw new ApiError(409, `A shipment already exists for order ${order.orderId} (status: ${existing.status}).`);
    }

    const context  = await buildContext(order, req.body);
    const providerName = context.preferredProvider || getActiveProviderName();

    let shipmentResult;
    try {
        shipmentResult = await createShipment(context);
    } catch (err) {
        // Persist a failed shipment record for ops visibility
        await DeliveryShipment.create({
            orderId:      order.orderId,
            orderMongoId: order._id,
            providerName,
            status:        'failed',
            failureReason: err.message,
        });
        throw new ApiError(502, `Provider error (${providerName}): ${err.message}`);
    }

    const isAwbAssigned = Boolean(shipmentResult.isAwbAssigned && shipmentResult.awbCode);
    const resolvedPickupStatus = shipmentResult.pickupStatus || (isAwbAssigned ? 'SCHEDULED' : 'PENDING');
    const resolvedProviderStatus = shipmentResult.providerStatus || (isAwbAssigned ? 'PICKUP SCHEDULED' : 'CREATED');

    // Persist shipment record
    const shipment = await DeliveryShipment.create({
        orderId:              order.orderId,
        orderMongoId:         order._id,
        providerName,
        externalShipmentId:   shipmentResult.externalId           || null,
        shiprocketOrderId:    shipmentResult.shiprocketOrderId    || order.orderId,
        shiprocketShipmentId: shipmentResult.shiprocketShipmentId || null,
        awbCode:              shipmentResult.awbCode              || null,
        courierId:            shipmentResult.courierId            || null,
        courierName:          shipmentResult.courierName          || null,
        trackingUrl:          shipmentResult.trackingUrl          || null,
        labelUrl:             shipmentResult.labelUrl             || null,
        label:                shipmentResult.label                || null,
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

    // Update Order with provider info
    order.providerName          = providerName;
    order.externalShipmentId    = shipmentResult.externalId || null;
    order.awbCode               = shipmentResult.awbCode || null;
    order.courierId             = shipmentResult.courierId || null;
    order.courierName           = shipmentResult.courierName || null;
    order.shiprocketOrderId    = shipmentResult.shiprocketOrderId || order.orderId;
    order.shiprocketShipmentId = shipmentResult.shiprocketShipmentId || null;
    order.trackingUrl           = shipmentResult.trackingUrl || null;
    order.labelUrl              = shipmentResult.labelUrl || null;
    order.providerStatus        = resolvedProviderStatus;
    order.pickupStatus          = resolvedPickupStatus;
    order.shipmentCreatedAt     = new Date();

    const prevAdminShipmentStatus = order.status;
    if (isAwbAssigned) {
        order.status = 'shipped';
    } else if (order.status === 'pending') {
        order.status = 'processing';
    }
    await order.save();

    // Send email notification if order status changed
    if (isAwbAssigned) {
        sendOrderStatusEmail(order, prevAdminShipmentStatus, order.status).catch(() => {});
    }

    const responseMsg = isAwbAssigned
        ? `Shiprocket shipment created & pickup scheduled with ${shipmentResult.courierName || 'assigned courier'}.`
        : (shipmentResult.warning || 'Shipment registered. Courier assignment pending.');

    res.status(201).json(new ApiResponse(201, { order, shipment, providerResult: shipmentResult, isAwbAssigned, isWalletLow: shipmentResult.isWalletLow }, responseMsg));
});

// ─── POST /api/admin/orders/:id/shipment/pickup ───────────────────────────────
export const scheduleAdminPickup = asyncHandler(async (req, res) => {
    const order = await findOrder(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found.');

    const shipment = await DeliveryShipment.findOne({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
        status: { $nin: ['cancelled'] },
    });

    const srShipmentId = shipment?.shiprocketShipmentId || order.shiprocketShipmentId;
    const srOrderId = shipment?.shiprocketOrderId || order.shiprocketOrderId;

    if (!srShipmentId) {
        throw new ApiError(400, 'No existing Shiprocket shipment found. Please create shipment first.');
    }

    const context = await buildContext(order, req.body);
    context.shipmentId = Number(srShipmentId);
    context.orderId = srOrderId || order.orderId;

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

    order.awbCode = shipmentResult.awbCode;
    order.courierId = shipmentResult.courierId || order.courierId;
    order.courierName = shipmentResult.courierName || order.courierName;
    order.trackingUrl = shipmentResult.trackingUrl || order.trackingUrl;
    order.labelUrl = shipmentResult.labelUrl || order.labelUrl;
    order.providerStatus = 'PICKUP SCHEDULED';
    order.pickupStatus = 'SCHEDULED';

    const prevStatus = order.status;
    order.status = 'shipped';
    await order.save();

    sendOrderStatusEmail(order, prevStatus, order.status).catch(() => {});

    res.status(200).json(
        new ApiResponse(200, { order, shipment, shipmentResult }, 'Courier assigned and pickup scheduled successfully!')
    );
});

// ─── POST /api/admin/orders/:id/shipment/cancel ───────────────────────────────

export const cancelOrderShipment = asyncHandler(async (req, res) => {
    const order = await findOrder(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found.');

    if (['delivered'].includes(order.status)) {
        throw new ApiError(409, 'Cannot cancel a delivered order.');
    }

    const shipment = await DeliveryShipment.findOne({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
        status: { $nin: ['cancelled', 'failed'] },
    });

    const baseCtx = await buildContext(order);
    const context = {
        ...baseCtx,
        externalShipmentId: order.externalShipmentId || shipment?.externalShipmentId,
        shiprocketOrderId:  shipment?.shiprocketOrderId,
    };

    const result = await cancelShipment(context);

    if (shipment) {
        shipment.status             = 'cancelled';
        shipment.shipmentCancelledAt = new Date();
        shipment.timeline.push({ status: 'CANCELLED', timestamp: new Date() });
        await shipment.save();
    }

    order.shipmentCancelledAt = new Date();
    order.providerStatus      = 'CANCELLED';
    await order.save();

    res.status(200).json(new ApiResponse(200, { result, shipment }, 'Shipment cancellation requested.'));
});

// ─── GET /api/admin/orders/:id/shipment/tracking ─────────────────────────────

export const getOrderTracking = asyncHandler(async (req, res) => {
    const order = await findOrder(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found.');

    if (!order.externalShipmentId) {
        throw new ApiError(404, 'No shipment created yet for this order.');
    }

    const baseCtx = await buildContext(order);
    const context = {
        ...baseCtx,
        externalShipmentId: order.externalShipmentId,
    };

    const tracking = await getTrackingInfo(context);

    // Also return stored timeline from DeliveryShipment for completeness
    const shipment = await DeliveryShipment.findOne({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
    }).select('timeline webhookLog status externalShipmentId trackingUrl').lean();

    res.status(200).json(new ApiResponse(200, { liveTracking: tracking, shipment }, 'Tracking info fetched.'));
});

// ─── GET /api/admin/orders/:id/shipment/quote ─────────────────────────────────

export const getOrderQuote = asyncHandler(async (req, res) => {
    const order = await findOrder(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found.');

    const context = await buildContext(order, req.query);
    const quote   = await getQuote(context);

    res.status(200).json(new ApiResponse(200, quote, 'Quote fetched.'));
});

// ─── GET /api/admin/orders/:id/shipment ──────────────────────────────────────

export const getOrderShipment = asyncHandler(async (req, res) => {
    const order = await findOrder(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found.');

    const shipments = await DeliveryShipment.find({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
    }).sort({ createdAt: 1 }).lean();

    const shipment = shipments.length > 0 ? shipments[0] : null;

    res.status(200).json(new ApiResponse(200, { order, shipment, shipments }, 'Shipment fetched.'));
});

// ─── GET /api/admin/orders/:id/shipment/label ─────────────────────────────────
export const getOrderLabel = asyncHandler(async (req, res) => {
    const order = await findOrder(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found.');

    const shipment = await DeliveryShipment.findOne({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
    });

    let labelUrl = shipment?.labelUrl || order.labelUrl;
    if (!labelUrl && shipment?.shiprocketShipmentId) {
        labelUrl = await shiprocketProvider.generateLabel(shipment.shiprocketShipmentId);
        if (labelUrl) {
            shipment.labelUrl = labelUrl;
            order.labelUrl = labelUrl;
            await Promise.all([shipment.save(), order.save()]);
        }
    }

    if (!labelUrl) throw new ApiError(404, 'Shipping label not available yet.');
    res.status(200).json(new ApiResponse(200, { labelUrl }, 'Shipping label fetched.'));
});

// ─── GET /api/admin/orders/:id/shipment/manifest ──────────────────────────────
export const getOrderManifest = asyncHandler(async (req, res) => {
    const order = await findOrder(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found.');

    const shipment = await DeliveryShipment.findOne({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
    });

    let manifestUrl = shipment?.manifestUrl || order.manifestUrl;
    if (!manifestUrl && shipment?.shiprocketShipmentId) {
        manifestUrl = await shiprocketProvider.generateManifest(shipment.shiprocketShipmentId);
        if (manifestUrl) {
            shipment.manifestUrl = manifestUrl;
            order.manifestUrl = manifestUrl;
            await Promise.all([shipment.save(), order.save()]);
        }
    }

    if (!manifestUrl) throw new ApiError(404, 'Manifest document not available yet.');
    res.status(200).json(new ApiResponse(200, { manifestUrl }, 'Manifest fetched.'));
});

// ─── GET /api/admin/orders/:id/shipment/invoice ───────────────────────────────
export const getOrderInvoice = asyncHandler(async (req, res) => {
    const order = await findOrder(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found.');

    const shipment = await DeliveryShipment.findOne({
        $or: [{ orderId: order.orderId }, { orderMongoId: order._id }],
    });

    let invoiceUrl = shipment?.invoiceUrl || order.invoiceUrl;
    if (!invoiceUrl && (shipment?.shiprocketOrderId || order.shiprocketOrderId)) {
        const srOrderId = shipment?.shiprocketOrderId || order.shiprocketOrderId;
        invoiceUrl = await shiprocketProvider.generateInvoice(srOrderId);
        if (invoiceUrl) {
            shipment.invoiceUrl = invoiceUrl;
            order.invoiceUrl = invoiceUrl;
            await Promise.all([shipment.save(), order.save()]);
        }
    }

    if (!invoiceUrl) throw new ApiError(404, 'Invoice document not available yet.');
    res.status(200).json(new ApiResponse(200, { invoiceUrl }, 'Invoice fetched.'));
});

// ─── POST /api/admin/delivery/token/refresh ───────────────────────────────────

export const refreshDeliveryToken = asyncHandler(async (req, res) => {
    const providerName = String(req.body.provider || req.query.provider || getActiveProviderName());
    await refreshProviderToken(providerName);
    res.status(200).json(new ApiResponse(200, null, `Token refreshed for provider "${providerName}".`));
});
