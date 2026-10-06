/**
 * DeliveryShipment.model.js
 * ──────────────────────────
 * Tracks the provider-side shipment lifecycle for each order.
 * This is separate from the Order model so the order record stays clean
 * and provider-specific data doesn't pollute the core order schema.
 *
 * One DeliveryShipment per order (one-to-one in normal flow).
 * Re-created if an order is re-shipped with a different provider.
 */

import mongoose from 'mongoose';

// ─── Timeline event sub-document ─────────────────────────────────────────────
const timelineEventSchema = new mongoose.Schema({
    status:    { type: String },
    timestamp: { type: Date,   default: () => new Date() },
    location:  { type: String },
    raw:       { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

// ─── Webhook log entry sub-document ──────────────────────────────────────────
const webhookLogSchema = new mongoose.Schema({
    receivedAt: { type: Date, default: () => new Date() },
    payload:    { type: mongoose.Schema.Types.Mixed },
    processed:  { type: Boolean, default: false },
    eventId:    { type: String },    // provider's unique event/notification ID
}, { _id: false });

// ─── Main schema ─────────────────────────────────────────────────────────────
const deliveryShipmentSchema = new mongoose.Schema(
    {
        orderId: {
            type:     String,
            required: true,
            index:    true,
        },
        orderMongoId: {
            type: mongoose.Schema.Types.ObjectId,
            ref:  'Order',
            index: true,
        },
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref:  'Vendor',
            index: true,
        },
        providerName: {
            type:     String,
            required: true,
            default:  'internal',
        },

        // Provider-side identifiers
        externalShipmentId: {
            type:   String,
            index:  true,
            sparse: true,
        },
        shiprocketOrderId: {
            type:   String,
            sparse: true,
        },
        shiprocketShipmentId: {
            type:   String,
            sparse: true,
        },
        awbCode: {
            type:   String,
            index:  true,
            sparse: true,
        },
        courierId:   { type: Number },
        courierName: { type: String },

        // Tracking & Documents
        trackingUrl: { type: String },
        label:       { type: String },   // base64-encoded PDF label (nullable)
        labelUrl:    { type: String },
        manifestUrl: { type: String },
        invoiceUrl:  { type: String },
        pickupStatus: { type: String, default: 'PENDING' },
        pickupScheduledDate: { type: Date },

        // Status
        status: {
            type: String,
            enum: ['pending', 'created', 'in_transit', 'delivered', 'cancelled', 'failed'],
            default: 'pending',
        },

        // Quote snapshot taken at booking time
        quote: { type: mongoose.Schema.Types.Mixed },

        // Append-only status timeline
        timeline: [timelineEventSchema],

        // Raw webhook payloads
        webhookLog: [webhookLogSchema],

        // ETA
        etaTimestamp: { type: Date },

        // Idempotency — prevents double-creating a shipment on retry
        idempotencyKey: {
            type:   String,
            unique: true,
            sparse: true,
        },

        // Lifecycle timestamps
        shipmentCreatedAt:   { type: Date },
        shipmentCancelledAt: { type: Date },

        // Failure tracking
        failureReason: { type: String },
        retryCount:    { type: Number, default: 0 },
    },
    { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
deliveryShipmentSchema.index({ orderId: 1, providerName: 1 });

const DeliveryShipment = mongoose.model('DeliveryShipment', deliveryShipmentSchema);
export { DeliveryShipment };
export default DeliveryShipment;
