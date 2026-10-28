import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { applyUniqueCode } from './uniqueCode.js';

export const FIELD_ACCOUNT_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];

/**
 * Fields shared by field-network accounts (Sanchalak, Surveyor).
 * Returned from a function so every schema gets its own definition objects.
 */
export const fieldAccountFields = () => ({
    name: { type: String, required: true, trim: true },
    // Optional: accounts register with a verified phone; email is kept for older accounts.
    email: { type: String, lowercase: true, trim: true },
    // Required at registration (validator); not here, so older accounts without a phone still save.
    phone: { type: String, trim: true },
    password: { type: String, required: true, select: false },
    avatar: { type: String },
    address: {
        village: { type: String, trim: true },
        gramPanchayat: { type: String, trim: true },
        block: { type: String, trim: true },
        district: { type: String, trim: true },
        state: { type: String, trim: true },
        pincode: { type: String, trim: true },
    },
    isPhoneVerified: { type: Boolean, default: false },
    status: { type: String, enum: FIELD_ACCOUNT_STATUSES, default: 'pending', index: true },
    rejectionReason: { type: String, trim: true },
    statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    statusUpdatedAt: { type: Date },
    approvedAt: { type: Date },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    resetOtp: { type: String, select: false },
    resetOtpExpiry: { type: Date, select: false },
    resetOtpVerified: { type: Boolean, default: false, select: false },
    refreshTokenHash: { type: String, select: false },
    refreshTokenExpiresAt: { type: Date, select: false },
    fcmTokens: { type: [String], default: [] },
    fcmTokenMobile: { type: [String], default: [] },
});

/**
 * Adds the login code generator (e.g. SAN-482913), password hashing and comparePassword.
 */
export const applyFieldAccountBehaviour = (schema, { codeField, codePrefix }) => {
    applyUniqueCode(schema, { codeField, codePrefix });

    // Unique only when present, so phone-only accounts can leave email out.
    schema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
    schema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });

    schema.pre('save', async function (next) {
        if (!this.isModified('password')) return next();
        this.password = await bcrypt.hash(this.password, 12);
        next();
    });

    schema.methods.comparePassword = async function (candidatePassword) {
        return bcrypt.compare(candidatePassword, this.password);
    };
};
