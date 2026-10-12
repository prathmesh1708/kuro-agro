import crypto from 'crypto';
import mongoose from 'mongoose';

// Farmer (Kisan) registration submitted by a Surveyor; fields follow the Kuro Rice farmer registration form.
export const LAND_TYPES = ['own', 'lease'];
export const IRRIGATION_TYPES = ['canal', 'bore', 'pond', 'rain'];
export const FARMING_METHODS = ['natural'];
export const REGISTRATION_STATUSES = ['submitted', 'approved', 'rejected'];
export const AGREEMENT_VERSION = 'kuro-farmer-agreement-v1';

const farmerRegistrationSchema = new mongoose.Schema(
    {
        registrationCode: { type: String, unique: true, uppercase: true, trim: true },
        surveyor: { type: mongoose.Schema.Types.ObjectId, ref: 'Surveyor', required: true, index: true },
        // Copied from the surveyor so a Sanchalak's list is a single indexed query.
        sanchalak: { type: mongoose.Schema.Types.ObjectId, ref: 'Sanchalak', required: true, index: true },

        // Basic details
        aadhaarEnc: { type: String, required: true, select: false },
        aadhaarHash: { type: String, required: true, select: false, index: true },
        aadhaarLast4: { type: String, required: true },
        name: { type: String, required: true, trim: true },
        fatherName: { type: String, required: true, trim: true },
        village: { type: String, required: true, trim: true },
        panchayat: { type: String, required: true, trim: true },
        block: { type: String, required: true, trim: true },
        district: { type: String, required: true, trim: true },
        mobile: { type: String, required: true, trim: true, index: true },
        altMobile: { type: String, required: true, trim: true },
        email: { type: String, required: true, lowercase: true, trim: true },

        // Land details
        landTotalAcres: { type: Number, required: true, min: 0 },
        landProposedAcres: { type: Number, required: true, min: 0 },
        landType: { type: String, enum: LAND_TYPES, required: true },
        irrigation: { type: String, enum: IRRIGATION_TYPES, required: true },
        farmingMethod: { type: String, enum: FARMING_METHODS, required: true },

        // Agreement (Parts 3–5 + declaration)
        agreement: {
            accepted: { type: Boolean, required: true },
            version: { type: String, required: true },
            acceptedAt: { type: Date, required: true },
        },

        status: { type: String, enum: REGISTRATION_STATUSES, default: 'submitted', index: true },
        submittedAt: { type: Date, default: Date.now },
        resubmitCount: { type: Number, default: 0 },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        reviewedAt: { type: Date },
        adminRemark: { type: String, trim: true },

        // Commission locked in at approval (₹), from the admin rates at that moment.
        commission: {
            surveyor: { type: Number, default: 0 },
            sanchalak: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

farmerRegistrationSchema.index({ sanchalak: 1, status: 1, createdAt: -1 });
farmerRegistrationSchema.index({ surveyor: 1, status: 1, createdAt: -1 });

farmerRegistrationSchema.pre('validate', async function (next) {
    if (this.registrationCode) return next();
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = `FR-${crypto.randomInt(100000, 1000000)}`;
        // eslint-disable-next-line no-await-in-loop
        if (!(await this.constructor.exists({ registrationCode: candidate }))) {
            this.registrationCode = candidate;
            return next();
        }
    }
    return next(new Error('Could not generate a unique registration code.'));
});

const FarmerRegistration = mongoose.model('FarmerRegistration', farmerRegistrationSchema);
export { FarmerRegistration };
export default FarmerRegistration;
