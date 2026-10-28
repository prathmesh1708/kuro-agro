import mongoose from 'mongoose';
import { applyUniqueCode } from './shared/uniqueCode.js';
import { PAYMENT_METHODS, SEED_ACTOR_TYPES } from './shared/seedRequest.js';

export const SEED_REMITTANCE_STATUSES = ['pending', 'received', 'not_received'];

// Money a Surveyor sends to admin: what they collected from farmers, less their commission.
// Admin confirms receipt before it comes off the surveyor's balance.
const seedRemittanceSchema = new mongoose.Schema(
    {
        remittanceCode: { type: String, unique: true, uppercase: true, trim: true },
        surveyor: { type: mongoose.Schema.Types.ObjectId, ref: 'Surveyor', required: true, index: true },
        sanchalak: { type: mongoose.Schema.Types.ObjectId, ref: 'Sanchalak', required: true, index: true },
        amount: { type: Number, required: true, min: 1 },
        method: { type: String, enum: PAYMENT_METHODS, required: true },
        reference: { type: String, trim: true },
        paidAt: { type: Date, default: Date.now },
        surveyorNote: { type: String, trim: true },
        status: { type: String, enum: SEED_REMITTANCE_STATUSES, default: 'pending', index: true },
        decidedAt: { type: Date },
        decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        adminRemark: { type: String, trim: true },
        history: [
            {
                _id: false,
                action: { type: String, required: true },
                byType: { type: String, enum: SEED_ACTOR_TYPES, required: true },
                by: { type: mongoose.Schema.Types.ObjectId },
                note: { type: String, trim: true },
                at: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

seedRemittanceSchema.index({ surveyor: 1, status: 1, createdAt: -1 });
seedRemittanceSchema.index({ status: 1, createdAt: -1 });

applyUniqueCode(seedRemittanceSchema, { codeField: 'remittanceCode', codePrefix: 'SRM' });

const SeedRemittance = mongoose.model('SeedRemittance', seedRemittanceSchema);
export { SeedRemittance };
export default SeedRemittance;
