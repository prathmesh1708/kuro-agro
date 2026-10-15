import Produce, { PRODUCE_UNITS } from '../models/Produce.model.js';
import ApiError from '../utils/ApiError.js';
import { slugify } from '../utils/slugify.js';

// Starting list, created the first time the produce list is read. Admin can add, rename or hide items.
const DEFAULT_PRODUCE = [
    { name: 'Rice', nameHi: 'चावल' },
    { name: 'Paddy', nameHi: 'धान' },
    { name: 'Wheat', nameHi: 'गेहूं' },
    { name: 'Jowar', nameHi: 'ज्वार' },
    { name: 'Bajra', nameHi: 'बाजरा' },
    { name: 'Maize', nameHi: 'मक्का' },
    { name: 'Soybean', nameHi: 'सोयाबीन' },
    { name: 'Chana', nameHi: 'चना' },
    { name: 'Tur (Arhar)', nameHi: 'अरहर' },
    { name: 'Moong', nameHi: 'मूंग' },
    { name: 'Urad', nameHi: 'उड़द' },
    { name: 'Mustard', nameHi: 'सरसों' },
    { name: 'Groundnut', nameHi: 'मूंगफली' },
];

export const ensureDefaultProduce = async () => {
    if (await Produce.estimatedDocumentCount()) return;
    await Produce.insertMany(
        DEFAULT_PRODUCE.map((item, index) => ({ ...item, slug: slugify(item.name), unit: 'quintal', sortOrder: index + 1 })),
        { ordered: false }
    ).catch((err) => {
        // Another request seeded the list at the same moment.
        if (err?.code !== 11000) throw err;
    });
};

export const listProduce = async ({ activeOnly = true } = {}) => {
    await ensureDefaultProduce();
    return Produce.find(activeOnly ? { isActive: true } : {}).sort({ sortOrder: 1, name: 1 }).lean();
};

export const getActiveProduceOrThrow = async (id) => {
    const produce = await Produce.findById(id).lean();
    if (!produce || !produce.isActive) throw new ApiError(400, 'Please choose a produce from the list.');
    return produce;
};

/**
 * Normalises crops entered on a farmer registration: a listed produce keeps its id and current name;
 * a typed-in name that matches a listed produce (e.g. "wheat") is linked to it; anything else stays
 * as written. Duplicates are dropped.
 */
export const resolveCrops = async (crops = []) => {
    await ensureDefaultProduce();
    const ids = crops.map((c) => c.produce).filter(Boolean);
    const slugs = crops.map((c) => slugify(c.name));
    const known = await Produce.find({ $or: [{ _id: { $in: ids } }, { slug: { $in: slugs } }] }).select('name slug').lean();
    const byId = new Map(known.map((p) => [String(p._id), p]));
    const bySlug = new Map(known.map((p) => [p.slug, p]));

    const seen = new Set();
    return crops.reduce((list, crop) => {
        const match = (crop.produce && byId.get(String(crop.produce))) || bySlug.get(slugify(crop.name));
        const entry = match ? { produce: match._id, name: match.name } : { name: crop.name.trim().replace(/\s+/g, ' ') };
        const key = entry.name.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            list.push(entry);
        }
        return list;
    }, []);
};

const round2 = (value) => Math.round(value * 100) / 100;

/** Converts a quantity entered in the produce's unit (e.g. 12.5 quintal) to whole kg. */
export const toKg = (quantity, unit) => Math.round(Number(quantity) * PRODUCE_UNITS[unit]);

/** Amount for `quantityKg` at `pricePerUnit` (₹ per quintal / kg), rounded to paise. */
export const amountFor = (quantityKg, pricePerUnit, unit) => round2((quantityKg / PRODUCE_UNITS[unit]) * Number(pricePerUnit));
