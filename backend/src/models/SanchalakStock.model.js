import mongoose from 'mongoose';

// One Kendra warehouse line: how much of one produce a Sanchalak holds.
// quantityKg is on hand; reservedKg of it is offered to admin in pending requests.
const sanchalakStockSchema = new mongoose.Schema(
    {
        sanchalak: { type: mongoose.Schema.Types.ObjectId, ref: 'Sanchalak', required: true },
        produce: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce', required: true },
        produceName: { type: String, required: true, trim: true },
        unit: { type: String, required: true },
        quantityKg: { type: Number, default: 0, min: 0 },
        reservedKg: { type: Number, default: 0, min: 0 },
        purchasedKg: { type: Number, default: 0, min: 0 },
        purchasedValue: { type: Number, default: 0, min: 0 },
        soldKg: { type: Number, default: 0, min: 0 },
        soldValue: { type: Number, default: 0, min: 0 },
        lastPurchasedAt: { type: Date },
        lastSoldAt: { type: Date },
    },
    { timestamps: true }
);

sanchalakStockSchema.index({ sanchalak: 1, produce: 1 }, { unique: true });

const SanchalakStock = mongoose.model('SanchalakStock', sanchalakStockSchema);
export { SanchalakStock };
export default SanchalakStock;
