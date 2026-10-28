import mongoose from 'mongoose';

// How much of one seed item a Surveyor holds.
// `quantity` is on hand; `reserved` of it is promised to farmers in pending issues.
const surveyorSeedStockSchema = new mongoose.Schema(
    {
        surveyor: { type: mongoose.Schema.Types.ObjectId, ref: 'Surveyor', required: true },
        seedItem: { type: mongoose.Schema.Types.ObjectId, ref: 'SeedItem', required: true },
        seedName: { type: String, required: true, trim: true },
        unit: { type: String, required: true },
        quantity: { type: Number, default: 0, min: 0 },
        reserved: { type: Number, default: 0, min: 0 },
        receivedQty: { type: Number, default: 0, min: 0 },
        receivedValue: { type: Number, default: 0, min: 0 },
        issuedQty: { type: Number, default: 0, min: 0 },
        issuedValue: { type: Number, default: 0, min: 0 },
        lastReceivedAt: { type: Date },
        lastIssuedAt: { type: Date },
    },
    { timestamps: true }
);

surveyorSeedStockSchema.index({ surveyor: 1, seedItem: 1 }, { unique: true });

const SurveyorSeedStock = mongoose.model('SurveyorSeedStock', surveyorSeedStockSchema);
export { SurveyorSeedStock };
export default SurveyorSeedStock;
