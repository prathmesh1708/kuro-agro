import mongoose from 'mongoose';

export const STOCK_LEDGER_REASONS = [
    'kisan_purchase', // Sanchalak bought from a Kisan (+ on hand)
    'reserved_for_admin', // Sanchalak offered stock to admin (+ reserved)
    'reservation_released', // Offer cancelled or not received (- reserved)
    'sent_to_admin', // Admin received the offer (- on hand, - reserved)
    'received_from_sanchalak', // Admin stock in (+ on hand)
    'moved_to_product', // Admin moved stock into a store Product (- on hand)
];

// Append-only record of every stock change, for audit. Never updated or deleted.
const stockLedgerSchema = new mongoose.Schema(
    {
        ownerType: { type: String, enum: ['sanchalak', 'admin'], required: true },
        sanchalak: { type: mongoose.Schema.Types.ObjectId, ref: 'Sanchalak' }, // set when ownerType is 'sanchalak'
        produce: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce', required: true },
        produceName: { type: String, required: true },
        unit: { type: String, required: true },
        reason: { type: String, enum: STOCK_LEDGER_REASONS, required: true },
        changeKg: { type: Number, required: true }, // change to on-hand quantity (0 for reservations)
        reservedChangeKg: { type: Number, default: 0 },
        balanceKg: { type: Number, required: true }, // on-hand quantity after this entry
        amount: { type: Number, default: 0 },
        refModel: { type: String, enum: ['KisanSaleRequest', 'SanchalakSaleRequest', 'Product'] },
        refId: { type: mongoose.Schema.Types.ObjectId },
        productUnits: { type: Number }, // units added to the Product's stock, for 'moved_to_product'
        byType: { type: String, enum: ['kisan', 'sanchalak', 'surveyor', 'admin'], required: true },
        by: { type: mongoose.Schema.Types.ObjectId },
        note: { type: String, trim: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

stockLedgerSchema.index({ ownerType: 1, sanchalak: 1, createdAt: -1 });
stockLedgerSchema.index({ produce: 1, createdAt: -1 });

const StockLedger = mongoose.model('StockLedger', stockLedgerSchema);
export { StockLedger };
export default StockLedger;
