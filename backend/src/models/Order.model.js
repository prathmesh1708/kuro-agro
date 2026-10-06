import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', index: true },
    name: String,
    image: String,
    price: Number,
    quantity: Number,
    variant: { type: mongoose.Schema.Types.Mixed, default: {} },
    variantKey: String,
    gstSnapshot: {
        rate: { type: Number, default: 18 },
        amount: { type: Number, default: 0 },
        hsnCode: { type: String, default: '' },
        ruleType: { type: String, default: 'default_fallback' },
        basePrice: { type: Number },
        taxIncluded: { type: Boolean, default: false }
    }
});

const vendorItemGroupSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName: String,
    items: [orderItemSchema],
    subtotal: Number,
    shipping: Number,
    tax: Number,
    discount: Number,
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending',
    },

    // ─── Vendor-level Third-Party / Shiprocket Shipment Tracking ─────────────
    shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryShipment' },
    providerName: { type: String, default: 'shiprocket' },
    externalShipmentId: { type: String, sparse: true },
    shiprocketOrderId: { type: String, sparse: true },
    shiprocketShipmentId: { type: String, sparse: true },
    awbCode: { type: String, sparse: true },
    courierId: { type: Number },
    courierName: { type: String },
    trackingUrl: { type: String },
    labelUrl: { type: String },
    manifestUrl: { type: String },
    invoiceUrl: { type: String },
    pickupStatus: { type: String, default: 'PENDING' },
    providerStatus: { type: String },
    shipmentCreatedAt: { type: Date },
    shipmentCancelledAt: { type: Date },
});

const orderSchema = new mongoose.Schema(
    {
        orderId: { type: String, required: true, unique: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
        guestInfo: { name: String, email: String, phone: String },
        items: [orderItemSchema],
        vendorItems: [vendorItemGroupSchema],
        shippingAddress: {
            name: String,
            email: String,
            phone: String,
            address: String,
            city: String,
            state: String,
            zipCode: String,
            country: String,
        },
        paymentMethod: { type: String, enum: ['card', 'cash', 'bank', 'wallet', 'upi', 'cod', 'online', 'razorpay'] },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending',
        },
        razorpayOrderId: { type: String, index: true, sparse: true },
        razorpayPaymentId: { type: String, sparse: true },
        razorpaySignature: { type: String },
        status: {
            type: String,
            enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
            default: 'pending',
            index: true,
        },
        subtotal: { type: Number, default: 0 },
        shipping: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        couponCode: { type: String },
        couponDiscount: { type: Number, default: 0 },
        idempotencyKey: { type: String, sparse: true },
        idempotencyScope: { type: String, sparse: true },
        trackingNumber: { type: String, unique: true, sparse: true },
        deliveryBoyId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryBoy', index: true },
        deliveryOtpHash: { type: String, select: false },
        deliveryOtpExpiry: { type: Date, select: false },
        deliveryOtpSentAt: { type: Date, select: false },
        deliveryOtpDebug: { type: String, select: false },
        deliveryOtpVerifiedAt: Date,
        deliveryOtpAttempts: { type: Number, default: 0, select: false },

        // ─── Third-party provider tracking (additive — all optional) ─────────
        providerName: {
            type:    String,
            default: 'internal',
        },
        externalShipmentId: {
            type:   String,
            index:  true,
            sparse: true,   // AWB / tracking number from provider
        },
        awbCode:             { type: String, index: true, sparse: true },
        courierId:           { type: Number },
        courierName:         { type: String },
        shiprocketOrderId:   { type: String, index: true, sparse: true },
        shiprocketShipmentId:{ type: String, index: true, sparse: true },
        trackingUrl:         { type: String },
        labelUrl:            { type: String },
        manifestUrl:         { type: String },
        invoiceUrl:          { type: String },
        pickupStatus:        { type: String, default: 'PENDING' },
        shipmentStatus:      { type: String },
        lastTrackingUpdate:  { type: Date },
        providerStatus:      { type: String },   // raw provider status (before mapping)
        providerQuote:       { type: mongoose.Schema.Types.Mixed },   // price snapshot at booking
        shipmentCreatedAt:   { type: Date },
        shipmentCancelledAt: { type: Date },
        // ─────────────────────────────────────────────────────────────────────

        estimatedDelivery: Date,
        deliveredAt: Date,
        isCashSettled: { type: Boolean, default: false },
        settledAt: Date,
        cancelledAt: Date,
        cancellationReason: String,
        isDeleted: { type: Boolean, default: false, index: true },
        deletedAt: Date,
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    },
    { timestamps: true }
);

// Prevent duplicate order creation for the same retry key per actor (user/guest).
orderSchema.index(
    { idempotencyScope: 1, idempotencyKey: 1 },
    {
        unique: true,
        sparse: true,
        partialFilterExpression: {
            idempotencyScope: { $exists: true, $type: 'string' },
            idempotencyKey: { $exists: true, $type: 'string' },
        },
    }
);

const Order = mongoose.model('Order', orderSchema);
export { Order };
export default Order;
