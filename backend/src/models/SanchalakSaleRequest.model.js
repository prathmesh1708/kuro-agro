import mongoose from 'mongoose';
import { applyUniqueCode } from './shared/uniqueCode.js';
import { tradeRequestFields } from './shared/tradeRequest.js';

export const SANCHALAK_SALE_STATUSES = ['pending', 'received', 'not_received', 'cancelled'];

// A Sanchalak's offer to send produce from their Kendra warehouse to admin.
// While pending, the quantity is reserved in SanchalakStock so it cannot be offered twice.
const sanchalakSaleRequestSchema = new mongoose.Schema(
    {
        requestCode: { type: String, unique: true, uppercase: true, trim: true },
        sanchalak: { type: mongoose.Schema.Types.ObjectId, ref: 'Sanchalak', required: true, index: true },
        ...tradeRequestFields(),
        sanchalakNote: { type: String, trim: true },
        status: { type: String, enum: SANCHALAK_SALE_STATUSES, default: 'pending', index: true },
        decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        adminRemark: { type: String, trim: true },
    },
    { timestamps: true }
);

sanchalakSaleRequestSchema.index({ sanchalak: 1, status: 1, createdAt: -1 });
sanchalakSaleRequestSchema.index({ status: 1, createdAt: -1 });

applyUniqueCode(sanchalakSaleRequestSchema, { codeField: 'requestCode', codePrefix: 'SSR' });

const SanchalakSaleRequest = mongoose.model('SanchalakSaleRequest', sanchalakSaleRequestSchema);
export { SanchalakSaleRequest };
export default SanchalakSaleRequest;
