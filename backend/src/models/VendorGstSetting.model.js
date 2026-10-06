import mongoose from 'mongoose';

const vendorGstSettingSchema = new mongoose.Schema(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
        rate: { type: Number, required: true, min: 0, max: 100 }
    },
    { timestamps: true }
);

// Ensure a vendor can set only one default GST rate per category
vendorGstSettingSchema.index({ vendorId: 1, categoryId: 1 }, { unique: true });

const VendorGstSetting = mongoose.model('VendorGstSetting', vendorGstSettingSchema);
export { VendorGstSetting };
export default VendorGstSetting;
