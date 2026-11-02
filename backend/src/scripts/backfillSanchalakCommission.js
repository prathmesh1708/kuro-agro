import 'dotenv/config';
import mongoose from 'mongoose';
import SeedItem from '../models/SeedItem.model.js';
import { slugify } from '../utils/slugify.js';

/**
 * Fills in the Sanchalak commission band and the basis of payment on the seed catalog.
 *
 * ensureDefaultSeedItems() only seeds an empty collection, so installs created before the
 * Sanchalak tier existed keep a catalog with no Sanchalak rates. This matches the known items
 * by slug and fills them in. Idempotent: run it as often as you like.
 *
 * Items it does not recognise are left at zero and listed at the end, for admin to set from
 * Field Network → Seeds & Inputs. An item already carrying a rate is never overwritten unless
 * you pass --force.
 *
 *   node src/scripts/backfillSanchalakCommission.js [--force] [--dry-run]
 */

const RATES = [
    { name: 'Black Kuro Rice', perUnit: 10, min: 10, max: 10, basis: 'Verified quantity accepted by the company', basisHi: 'कंपनी द्वारा स्वीकृत सत्यापित मात्रा' },
    { name: 'Basmati Paddy Seed', perUnit: 5, min: 5, max: 5, basis: 'Verified quantity', basisHi: 'सत्यापित मात्रा' },
    { name: 'Wheat Seed', perUnit: 5, min: 5, max: 5, basis: 'Verified quantity', basisHi: 'सत्यापित मात्रा' },
    { name: 'Kuro Rice Seed', perUnit: 10, min: 10, max: 10, basis: 'Verified sales / distribution quantity', basisHi: 'सत्यापित बिक्री / वितरण मात्रा' },
    { name: 'Organic Fertilizer Kit', perUnit: 200, min: 200, max: 200, basis: 'Verified distribution and records', basisHi: 'सत्यापित वितरण एवं रिकॉर्ड' },
    { name: 'Green Vegetables', perUnit: 1, min: 1, max: 30, basis: 'As per crop, quality and approved rate', basisHi: 'फसल, गुणवत्ता और स्वीकृत दर के अनुसार' },
    { name: 'Mango / Guava & Other Fruit Plants', perUnit: 100, min: 100, max: 500, basis: 'Verified eligible plants / units', basisHi: 'सत्यापित योग्य पौधे / इकाई' },
];

const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    const items = await SeedItem.find().select('name slug unit sanchalakCommission basis').lean();
    const bySlug = new Map(items.map((item) => [item.slug, item]));
    const matched = new Set();
    let updated = 0;
    let skipped = 0;

    for (const rate of RATES) {
        const slug = slugify(rate.name);
        const item = bySlug.get(slug);
        if (!item) {
            console.log(`  not in catalog, nothing to fill: ${rate.name}`);
            continue;
        }
        matched.add(slug);

        const existing = item.sanchalakCommission?.perUnit || 0;
        if (existing > 0 && !force) {
            console.log(`  keeping ₹${existing}/${item.unit} already set on ${item.name} (use --force to replace)`);
            skipped += 1;
            continue;
        }

        const update = {
            sanchalakCommission: { perUnit: rate.perUnit, min: rate.min, max: rate.max },
            basis: rate.basis,
            basisHi: rate.basisHi,
        };
        const band = rate.min === rate.max ? `₹${rate.perUnit}` : `₹${rate.min}–₹${rate.max}`;
        console.log(`  ${dryRun ? 'would set' : 'set'} ${band} per ${item.unit} on ${item.name}`);
        if (!dryRun) {
            await SeedItem.updateOne({ _id: item._id }, { $set: update });
            updated += 1;
        }
    }

    const unknown = items.filter((item) => !matched.has(item.slug) && !(item.sanchalakCommission?.perUnit > 0));
    console.log(`\n${dryRun ? 'Dry run — nothing written.' : `Updated ${updated} item(s).`} Skipped ${skipped}.`);
    if (unknown.length) {
        console.log('\nNo Sanchalak rate set on these — add one in Field Network → Seeds & Inputs:');
        unknown.forEach((item) => console.log(`  • ${item.name} (per ${item.unit})`));
    }

    await mongoose.disconnect();
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
