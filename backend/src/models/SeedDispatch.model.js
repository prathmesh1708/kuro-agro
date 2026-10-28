import mongoose from 'mongoose';
import { applyUniqueCode } from './shared/uniqueCode.js';
import { seedRequestFields } from './shared/seedRequest.js';

export const SEED_DISPATCH_STATUSES = ['pending', 'received', 'not_received', 'cancelled'];

// Seed admin sends to a Surveyor. The surveyor confirms receipt before it lands in their stock.
// `commissionPerUnit` is the rate at the moment of dispatch; every issue made from this stock
// inherits it, so a later rate change never rewrites what the surveyor was promised.
const seedDispatchSchema = new mongoose.Schema(
    {
        dispatchCode: { type: String, unique: true, uppercase: true, trim: true },
        surveyor: { type: mongoose.Schema.Types.ObjectId, ref: 'Surveyor', required: true, index: true },
        // Copied from the surveyor so admin can filter a Kendra's dispatches in one indexed query.
        sanchalak: { type: mongoose.Schema.Types.ObjectId, ref: 'Sanchalak', required: true, index: true },
        ...seedRequestFields(),
        commissionPerUnit: { type: Number, default: 0, min: 0 },
        adminNote: { type: String, trim: true },
        surveyorRemark: { type: String, trim: true },
        status: { type: String, enum: SEED_DISPATCH_STATUSES, default: 'pending', index: true },
        sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    },
    { timestamps: true }
);

seedDispatchSchema.index({ surveyor: 1, status: 1, createdAt: -1 });
seedDispatchSchema.index({ status: 1, createdAt: -1 });

applyUniqueCode(seedDispatchSchema, { codeField: 'dispatchCode', codePrefix: 'SD' });

const SeedDispatch = mongoose.model('SeedDispatch', seedDispatchSchema);
export { SeedDispatch };
export default SeedDispatch;
