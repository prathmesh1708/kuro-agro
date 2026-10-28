import mongoose from 'mongoose';
import { SEED_ACTOR_TYPES } from './shared/seedRequest.js';

export const SEED_LEDGER_REASONS = [
    'dispatched_to_surveyor', // Admin sent seed out (admin side, informational)
    'received_from_admin', // Surveyor confirmed a dispatch (+ on hand)
    'dispatch_rejected', // Surveyor marked a dispatch not received (no stock change)
    'reserved_for_kisan', // Surveyor offered seed to a farmer (+ reserved)
    'reservation_released', // Issue cancelled or farmer did not receive (- reserved)
    'issued_to_kisan', // Farmer confirmed receipt (- on hand, - reserved)
];

// Append-only record of every seed stock change, for audit. Never updated or deleted.
const seedLedgerSchema = new mongoose.Schema(
    {
        ownerType: { type: String, enum: ['admin', 'surveyor'], required: true },
        surveyor: { type: mongoose.Schema.Types.ObjectId, ref: 'Surveyor' }, // set when ownerType is 'surveyor'
        seedItem: { type: mongoose.Schema.Types.ObjectId, ref: 'SeedItem', required: true },
        seedName: { type: String, required: true },
        unit: { type: String, required: true },
        reason: { type: String, enum: SEED_LEDGER_REASONS, required: true },
        changeQty: { type: Number, required: true }, // change to on-hand quantity (0 for reservations)
        reservedChangeQty: { type: Number, default: 0 },
        balanceQty: { type: Number, required: true }, // on-hand quantity after this entry
        amount: { type: Number, default: 0 },
        refModel: { type: String, enum: ['SeedDispatch', 'SeedIssue'] },
        refId: { type: mongoose.Schema.Types.ObjectId },
        byType: { type: String, enum: SEED_ACTOR_TYPES, required: true },
        by: { type: mongoose.Schema.Types.ObjectId },
        note: { type: String, trim: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

seedLedgerSchema.index({ ownerType: 1, surveyor: 1, createdAt: -1 });
seedLedgerSchema.index({ seedItem: 1, createdAt: -1 });

const SeedLedger = mongoose.model('SeedLedger', seedLedgerSchema);
export { SeedLedger };
export default SeedLedger;
