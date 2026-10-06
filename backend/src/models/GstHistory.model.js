import mongoose from 'mongoose';

const gstHistorySchema = new mongoose.Schema(
    {
        gstRuleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'GstRule',
            required: true,
            index: true
        },
        action: {
            type: String,
            required: true,
            enum: ['create', 'update', 'activate', 'deactivate', 'delete']
        },
        oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
        newValue: { type: mongoose.Schema.Types.Mixed, default: null },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
        reason: { type: String, trim: true, default: '' }
    },
    { timestamps: true }
);

const GstHistory = mongoose.model('GstHistory', gstHistorySchema);
export { GstHistory };
export default GstHistory;
