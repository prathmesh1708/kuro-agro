import mongoose from 'mongoose';
import { applyUniqueCode } from './shared/uniqueCode.js';
import { seedRequestFields, PAYMENT_METHODS } from './shared/seedRequest.js';

export const SEED_ISSUE_STATUSES = ['pending', 'received', 'not_received', 'cancelled'];

// Seed a Surveyor gives to one of their farmers. While pending, the quantity is reserved in
// SurveyorSeedStock so it cannot be promised twice.
//
// Money: the farmer reports the payment they made to the surveyor; the surveyor confirms it.
// Only a confirmed payment counts towards what the surveyor owes admin, so a farmer's slip
// cannot move the surveyor's balance on its own.
const seedIssueSchema = new mongoose.Schema(
    {
        issueCode: { type: String, unique: true, uppercase: true, trim: true },
        surveyor: { type: mongoose.Schema.Types.ObjectId, ref: 'Surveyor', required: true, index: true },
        sanchalak: { type: mongoose.Schema.Types.ObjectId, ref: 'Sanchalak', required: true, index: true },
        kisan: { type: mongoose.Schema.Types.ObjectId, ref: 'Kisan', required: true, index: true },
        registration: { type: mongoose.Schema.Types.ObjectId, ref: 'FarmerRegistration', required: true, index: true },
        dispatch: { type: mongoose.Schema.Types.ObjectId, ref: 'SeedDispatch' },
        ...seedRequestFields(),

        // Locked in when the issue is created, from the rate on the surveyor's stock.
        commissionPerUnit: { type: Number, default: 0, min: 0 },
        commissionAmount: { type: Number, default: 0, min: 0 },

        surveyorNote: { type: String, trim: true },
        kisanRemark: { type: String, trim: true },
        status: { type: String, enum: SEED_ISSUE_STATUSES, default: 'pending', index: true },

        payment: {
            status: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
            method: { type: String, enum: PAYMENT_METHODS },
            reference: { type: String, trim: true },
            paidAt: { type: Date },
            reportedAt: { type: Date },
            confirmedBySurveyor: { type: Boolean, default: false },
            confirmedAt: { type: Date },
        },
    },
    { timestamps: true }
);

seedIssueSchema.index({ surveyor: 1, status: 1, createdAt: -1 });
seedIssueSchema.index({ kisan: 1, status: 1, createdAt: -1 });
seedIssueSchema.index({ sanchalak: 1, createdAt: -1 });

applyUniqueCode(seedIssueSchema, { codeField: 'issueCode', codePrefix: 'SI' });

const SeedIssue = mongoose.model('SeedIssue', seedIssueSchema);
export { SeedIssue };
export default SeedIssue;
