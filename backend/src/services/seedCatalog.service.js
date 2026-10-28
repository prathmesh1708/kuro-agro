import SeedItem from '../models/SeedItem.model.js';
import ApiError from '../utils/ApiError.js';
import { slugify } from '../utils/slugify.js';

// Starting catalog, created the first time the seed list is read. Admin can add, edit or hide items.
// Commission is the surveyor's ₹ per unit; min/max record the agreed band for range-priced items.
const DEFAULT_SEED_ITEMS = [
    { name: 'Black Kuro Rice', nameHi: 'ब्लैक कुरो चावल', unit: 'kg', commission: { perUnit: 16, min: 16, max: 16 } },
    { name: 'Basmati Paddy Seed', nameHi: 'बासमती धान बीज', unit: 'kg', commission: { perUnit: 5, min: 5, max: 5 } },
    { name: 'Wheat Seed', nameHi: 'गेहूं बीज', unit: 'kg', commission: { perUnit: 5, min: 5, max: 5 } },
    { name: 'Kuro Rice Seed', nameHi: 'कुरो चावल बीज', unit: 'kg', commission: { perUnit: 25, min: 25, max: 25 } },
    { name: 'Organic Fertilizer Kit', nameHi: 'जैविक खाद किट', unit: 'kit', commission: { perUnit: 500, min: 500, max: 500 } },
    { name: 'Green Vegetables', nameHi: 'हरी सब्जियां', unit: 'kg', commission: { perUnit: 1, min: 1, max: 50 } },
    { name: 'Mango / Guava & Other Fruit Plants', nameHi: 'आम / अमरूद व अन्य फलदार पौधे', unit: 'plant', commission: { perUnit: 500, min: 500, max: 1000 } },
];

export const ensureDefaultSeedItems = async () => {
    if (await SeedItem.estimatedDocumentCount()) return;
    await SeedItem.insertMany(
        DEFAULT_SEED_ITEMS.map((item, index) => ({ ...item, slug: slugify(item.name), sortOrder: index + 1 })),
        { ordered: false }
    ).catch((err) => {
        // Another request seeded the catalog at the same moment.
        if (err?.code !== 11000) throw err;
    });
};

export const listSeedItems = async ({ activeOnly = true } = {}) => {
    await ensureDefaultSeedItems();
    return SeedItem.find(activeOnly ? { isActive: true } : {}).sort({ sortOrder: 1, name: 1 }).lean();
};

export const getActiveSeedItemOrThrow = async (id) => {
    const item = await SeedItem.findById(id).lean();
    if (!item || !item.isActive) throw new ApiError(400, 'Please choose a seed from the list.');
    return item;
};

const round2 = (value) => Math.round(value * 100) / 100;

/** Amount for `quantity` of an item at `pricePerUnit` (₹ per the item's own unit). */
export const amountFor = (quantity, pricePerUnit) => round2(Number(quantity) * Number(pricePerUnit));

/** Quantity as shown to people, e.g. "12 kg", "2 kit". */
export const formatSeedQty = (quantity, unit) => `${Number(Number(quantity).toFixed(2))} ${unit}`;

/**
 * Checks a commission rate against the item's agreed band.
 * Admin may set any rate within [min, max]; outside it the dispatch is refused.
 */
export const resolveCommissionRate = (item, requested) => {
    const { perUnit = 0, min = 0, max = 0 } = item.commission || {};
    if (requested === undefined || requested === null || requested === '') return perUnit;
    const rate = Number(requested);
    const floor = Math.min(min || 0, perUnit);
    const ceiling = Math.max(max || 0, perUnit);
    if (rate < floor || rate > ceiling) {
        throw new ApiError(400, `Commission for ${item.name} must be between ₹${floor} and ₹${ceiling} per ${item.unit}.`);
    }
    return rate;
};
