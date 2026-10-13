import mongoose from 'mongoose';

// Kilograms in one pricing unit. Quantities are stored as whole kg everywhere; prices are per unit.
export const PRODUCE_UNITS = { quintal: 100, kg: 1 };

// A crop a Kisan can sell (Rice, Wheat, Jowar, …). Managed by admin; shown in the sell dropdowns.
const produceSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        nameHi: { type: String, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        unit: { type: String, enum: Object.keys(PRODUCE_UNITS), default: 'quintal' },
        isActive: { type: Boolean, default: true, index: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

const Produce = mongoose.model('Produce', produceSchema);
export { Produce };
export default Produce;
