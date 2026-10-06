import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const vendorSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, index: true },
        password: { type: String, select: false },
        phone: { type: String },
        storeName: { type: String, required: true },
        storeLogo: { type: String },
        storeDescription: { type: String },
        status: {
            type: String,
            enum: ['pending', 'approved', 'suspended', 'rejected', 'action_required'],
            default: 'pending',
            index: true,
        },
        suspensionReason: { type: String },
        commissionRate: { type: Number, default: 10, min: 0, max: 100 },
        isVerified: { type: Boolean, default: false },
        rating: { type: Number, default: 0 },
        reviewCount: { type: Number, default: 0 },
        totalSales: { type: Number, default: 0 },
        totalEarnings: { type: Number, default: 0 },
        shippingEnabled: { type: Boolean, default: true },
        freeShippingThreshold: { type: Number, default: 100, min: 0 },
        defaultShippingRate: { type: Number, default: 5, min: 0 },
        shippingMethods: {
            type: [{ type: String, enum: ['standard', 'express', 'overnight'] }],
            default: ['standard'],
        },
        handlingTime: { type: Number, default: 1, min: 0 },
        processingTime: { type: Number, default: 1, min: 0 },
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String,
        },
        businessAddress: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String,
        },
        businessType: {
            type: String,
            enum: ['gst', 'non-gst'],
            default: 'non-gst',
        },
        legalBusinessName: { type: String },
        gstin: { type: String },
        panNumber: { type: String },
        gstCertificate: { type: String },
        panCardDocument: { type: String },
        verificationTimeline: [
            {
                status: String,
                remarks: String,
                updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
                updatedByName: String,
                updatedAt: { type: Date, default: Date.now },
            }
        ],
        verificationAuditLog: [
            {
                action: String,
                details: String,
                performedBy: {
                    id: mongoose.Schema.Types.ObjectId,
                    name: String,
                    role: String,
                },
                timestamp: { type: Date, default: Date.now },
            }
        ],
        bankDetails: {
            type: {
                accountName: { type: String, default: '' },
                accountNumber: { type: String, default: '' },
                bankName: { type: String, default: '' },
                ifscCode: { type: String, default: '' },
                branchName: { type: String, default: '' },
                upiId: { type: String, default: '' },
                cancelledCheque: { type: String, default: '' },
                panNumber: { type: String, default: '' },
                gstNumber: { type: String, default: '' },
                status: {
                    type: String,
                    enum: ['not_submitted', 'pending', 'approved', 'rejected', 'action_required'],
                    default: 'not_submitted',
                },
                remarks: { type: String, default: '' },
                submittedAt: { type: Date },
            },
            select: false,
        },
        documents: {
            gst: String,
            pan: String,
            aadhar: String,
            businessLicense: String,
        },
        otp: { type: String, select: false },
        otpExpiry: { type: Date, select: false },
        resetOtp: { type: String, select: false },
        resetOtpExpiry: { type: Date, select: false },
        resetOtpVerified: { type: Boolean, default: false, select: false },
        refreshTokenHash: { type: String, select: false },
        refreshTokenExpiresAt: { type: Date, select: false },
        joinDate: { type: Date, default: Date.now },
        fcmTokens: { type: [String], default: [] },
        fcmTokenMobile: { type: [String], default: [] },
        categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
        fssaiLicenseNumber: { type: String },
        fssaiLicenseDocument: { type: String },
    },
    { timestamps: true }
);

vendorSchema.pre('save', async function (next) {
    if (!this.password || !this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

vendorSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const Vendor = mongoose.model('Vendor', vendorSchema);
export { Vendor };
export default Vendor;
