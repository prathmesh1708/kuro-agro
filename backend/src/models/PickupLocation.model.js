import mongoose from 'mongoose';

const pickupLocationSchema = new mongoose.Schema(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
        name: { type: String, required: true, trim: true },
        email: { type: String, trim: true },
        phone: { type: String, trim: true },
        address: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        zipCode: { type: String, trim: true },
        country: { type: String, default: 'India', trim: true },
        isDefault: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        operatingHours: { type: mongoose.Schema.Types.Mixed },

        // ─── Shiprocket Sync Fields ──────────────────────────────────────────
        shiprocketLocationName: { type: String, trim: true, index: true },
        isSyncedWithShiprocket: { type: Boolean, default: false },
        syncStatus: {
            type: String,
            enum: ['pending', 'synced', 'failed'],
            default: 'pending',
        },
        syncError: { type: String, default: '' },
        syncedAt: { type: Date },
    },
    { timestamps: true }
);

pickupLocationSchema.index({ vendorId: 1, isDefault: 1 });
pickupLocationSchema.index({ vendorId: 1, shiprocketLocationName: 1 });

const PickupLocation = mongoose.model('PickupLocation', pickupLocationSchema);
export { PickupLocation };
export default PickupLocation;
