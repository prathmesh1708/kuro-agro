import mongoose from 'mongoose';

const gstRuleSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        rate: { type: Number, required: true, min: 0, max: 100 },
        hsnCode: { type: String, trim: true, default: '' },
        type: {
            type: String,
            required: true,
            enum: ['global', 'category', 'product'],
            index: true
        },
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            default: null,
            index: true
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            default: null,
            index: true
        },
        isActive: { type: Boolean, default: true, index: true },
        description: { type: String, trim: true, default: '' },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
    },
    { timestamps: true }
);

const GstRule = mongoose.model('GstRule', gstRuleSchema);
export { GstRule };
export default GstRule;
