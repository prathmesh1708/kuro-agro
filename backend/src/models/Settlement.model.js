import mongoose from 'mongoose';

const settlementSchema = new mongoose.Schema(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
        commissionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Commission' }],
        amount: { type: Number, required: true },
        paymentMethod: { type: String, enum: ['bank_transfer', 'wallet', 'upi'], default: 'bank_transfer' },
        transactionId: String,
        notes: String,
        status: { type: String, enum: ['completed', 'failed', 'pending', 'released', 'on_hold', 'cancelled'], default: 'pending' },
        reason: { type: String, default: '' },
        platformFee: { type: Number, default: 0 },
        shippingDeduction: { type: Number, default: 0 },
        commission: { type: Number, default: 0 },
        netPayable: { type: Number, required: true },
        ordersIncludedCount: { type: Number, default: 1 },
        orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    },
    { timestamps: true }
);

const Settlement = mongoose.model('Settlement', settlementSchema);
export default Settlement;
