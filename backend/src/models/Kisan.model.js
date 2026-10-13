import mongoose from 'mongoose';
import { applyUniqueCode } from './shared/uniqueCode.js';

export const KISAN_STATUSES = ['active', 'suspended'];

// Farmer (Kisan) login account. Created when admin approves the farmer's registration;
// the farmer logs in with the registered mobile number and an OTP (no password).
const kisanSchema = new mongoose.Schema(
    {
        kisanCode: { type: String, unique: true, uppercase: true, trim: true },
        registration: { type: mongoose.Schema.Types.ObjectId, ref: 'FarmerRegistration', required: true, unique: true },
        surveyor: { type: mongoose.Schema.Types.ObjectId, ref: 'Surveyor', required: true, index: true },
        sanchalak: { type: mongoose.Schema.Types.ObjectId, ref: 'Sanchalak', required: true, index: true },

        name: { type: String, required: true, trim: true },
        fatherName: { type: String, trim: true },
        phone: { type: String, required: true, unique: true, trim: true },
        email: { type: String, lowercase: true, trim: true },
        address: {
            village: { type: String, trim: true },
            panchayat: { type: String, trim: true },
            block: { type: String, trim: true },
            district: { type: String, trim: true },
        },

        // The mobile number was verified by the surveyor at registration; every login is an OTP.
        isPhoneVerified: { type: Boolean, default: true },
        status: { type: String, enum: KISAN_STATUSES, default: 'active', index: true },
        rejectionReason: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
        lastLoginAt: { type: Date },

        otp: { type: String, select: false },
        otpExpiry: { type: Date, select: false },
        refreshTokenHash: { type: String, select: false },
        refreshTokenExpiresAt: { type: Date, select: false },
        fcmTokens: { type: [String], default: [] },
        fcmTokenMobile: { type: [String], default: [] },
    },
    { timestamps: true }
);

applyUniqueCode(kisanSchema, { codeField: 'kisanCode', codePrefix: 'KIS' });

const Kisan = mongoose.model('Kisan', kisanSchema);
export { Kisan };
export default Kisan;
