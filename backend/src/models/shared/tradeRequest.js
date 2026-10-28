import mongoose from 'mongoose';

export const PAYMENT_STATUSES = ['unpaid', 'paid'];
export const PAYMENT_METHODS = ['cash', 'upi', 'bank_transfer', 'cheque', 'other'];

/**
 * Fields shared by produce sale requests (Kisan → Sanchalak, Sanchalak → Admin).
 * Produce name and unit are copied in so old records stay correct if the produce is renamed.
 */
export const tradeRequestFields = () => ({
    produce: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce', required: true, index: true },
    produceName: { type: String, required: true, trim: true },
    unit: { type: String, required: true },
    quantityKg: { type: Number, required: true, min: 1 },
    pricePerUnit: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    decidedAt: { type: Date },

    // Who has paid whom for this request, once it is accepted.
    payment: {
        status: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid' },
        method: { type: String, enum: PAYMENT_METHODS },
        reference: { type: String, trim: true },
        paidAt: { type: Date },
    },

    // Every status or payment change, newest last.
    history: [
        {
            _id: false,
            action: { type: String, required: true },
            byType: { type: String, enum: ['kisan', 'sanchalak', 'surveyor', 'admin'], required: true },
            by: { type: mongoose.Schema.Types.ObjectId },
            note: { type: String, trim: true },
            at: { type: Date, default: Date.now },
        },
    ],
});
