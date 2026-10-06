import mongoose from 'mongoose';

const warningSchema = new mongoose.Schema({
    reason: { type: String, required: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    issuedAt: { type: Date, default: Date.now }
});

const blacklistEventSchema = new mongoose.Schema({
    action: { type: String, enum: ['blacklisted', 'whitelisted'], required: true },
    reason: { type: String, required: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    timestamp: { type: Date, default: Date.now }
});

const codStatsSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
        totalCodOrders: { type: Number, default: 0 },
        deliveredCodOrders: { type: Number, default: 0 },
        cancelledCodOrders: { type: Number, default: 0 },
        cancellationRate: { type: Number, default: 0 }, // percentage (cancelledCodOrders / totalCodOrders * 100)
        warningCount: { type: Number, default: 0 },
        warnings: [warningSchema],
        isCodBlacklisted: { type: Boolean, default: false },
        blacklistHistory: [blacklistEventSchema],
    },
    { timestamps: true }
);

// Calculate cancellation rate before saving
codStatsSchema.pre('save', function (next) {
    if (this.totalCodOrders > 0) {
        this.cancellationRate = parseFloat(
            ((this.cancelledCodOrders / this.totalCodOrders) * 100).toFixed(2)
        );
    } else {
        this.cancellationRate = 0;
    }
    next();
});

const CodStats = mongoose.model('CodStats', codStatsSchema);
export { CodStats };
export default CodStats;
