import mongoose from 'mongoose';
import { applyUniqueCode } from './shared/uniqueCode.js';
import { tradeRequestFields } from './shared/tradeRequest.js';

export const KISAN_SALE_STATUSES = ['pending', 'purchased', 'not_purchased', 'cancelled'];

// A Kisan's offer to sell produce to their Kendra. quantityKg / pricePerUnit / totalAmount are the
// farmer's offer; `purchased` holds what the Sanchalak actually bought (they may correct it on weighing).
const kisanSaleRequestSchema = new mongoose.Schema(
    {
        requestCode: { type: String, unique: true, uppercase: true, trim: true },
        kisan: { type: mongoose.Schema.Types.ObjectId, ref: 'Kisan', required: true, index: true },
        registration: { type: mongoose.Schema.Types.ObjectId, ref: 'FarmerRegistration', required: true, index: true },
        sanchalak: { type: mongoose.Schema.Types.ObjectId, ref: 'Sanchalak', required: true, index: true },
        surveyor: { type: mongoose.Schema.Types.ObjectId, ref: 'Surveyor', required: true, index: true },
        ...tradeRequestFields(),
        kisanNote: { type: String, trim: true },
        status: { type: String, enum: KISAN_SALE_STATUSES, default: 'pending', index: true },
        purchased: {
            quantityKg: { type: Number, min: 1 },
            pricePerUnit: { type: Number, min: 0 },
            totalAmount: { type: Number, min: 0 },
        },
        sanchalakRemark: { type: String, trim: true },
    },
    { timestamps: true }
);

kisanSaleRequestSchema.index({ sanchalak: 1, status: 1, createdAt: -1 });
kisanSaleRequestSchema.index({ kisan: 1, createdAt: -1 });

applyUniqueCode(kisanSaleRequestSchema, { codeField: 'requestCode', codePrefix: 'KSR' });

const KisanSaleRequest = mongoose.model('KisanSaleRequest', kisanSaleRequestSchema);
export { KisanSaleRequest };
export default KisanSaleRequest;
