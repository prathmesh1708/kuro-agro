import mongoose from 'mongoose';

// Units a seed / input is handed out in. Unlike produce, quantities are stored in this unit
// as entered — a kit or a plant does not convert to kg.
export const SEED_UNITS = ['kg', 'packet', 'kit', 'plant', 'litre', 'bag'];

// An item admin distributes through the field network (seed, fertilizer kit, sapling).
// `produce` optionally links it to the crop list, so a surveyor issuing seed to a farmer
// sees the items matching the crops on that farmer's registration first.
const seedItemSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        nameHi: { type: String, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        unit: { type: String, enum: SEED_UNITS, default: 'kg' },
        produce: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce' },
        defaultPricePerUnit: { type: Number, default: 0, min: 0 },

        // Surveyor commission in ₹ per unit. `perUnit` is the rate used; min/max record the
        // agreed band for items priced on a range (e.g. ₹1–₹50 per kg of green vegetables).
        commission: {
            perUnit: { type: Number, default: 0, min: 0 },
            min: { type: Number, default: 0, min: 0 },
            max: { type: Number, default: 0, min: 0 },
        },

        // Sanchalak commission in Rs per unit, earned on verified distribution inside their Kendra.
        // Kept beside `commission` rather than nested under it so existing records need no migration.
        sanchalakCommission: {
            perUnit: { type: Number, default: 0, min: 0 },
            min: { type: Number, default: 0, min: 0 },
            max: { type: Number, default: 0, min: 0 },
        },

        // What the commission is paid on, shown as the "Basis of Payment" on the earning model card.
        basis: { type: String, trim: true },
        basisHi: { type: String, trim: true },

        isActive: { type: Boolean, default: true, index: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

const SeedItem = mongoose.model('SeedItem', seedItemSchema);
export { SeedItem };
export default SeedItem;
