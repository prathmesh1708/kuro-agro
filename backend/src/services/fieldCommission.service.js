import mongoose from 'mongoose';
import Settings from '../models/Settings.model.js';
import FarmerRegistration from '../models/FarmerRegistration.model.js';
import { commissionBand, listSeedItems } from './seedCatalog.service.js';
import { getSeedCommission } from './seedDistribution.service.js';

// Commission for the field network, from two sources:
//   • a fixed ₹ amount per farmer the admin approves (both roles), and
//   • ₹ per unit of seed / inputs distributed in the field (see seedDistribution.service.js).
// Either way the amount is copied onto the record when it is earned, so later rate changes
// never rewrite history.

const SETTINGS_KEY = 'fieldCommission';
const DEFAULT_RATES = { surveyorPerFarmer: 0, sanchalakPerFarmer: 0 };

export const getFieldCommissionRates = async () => {
    const doc = await Settings.findOne({ key: SETTINGS_KEY }).lean();
    return { ...DEFAULT_RATES, ...(doc?.value || {}) };
};

export const saveFieldCommissionRates = async ({ surveyorPerFarmer, sanchalakPerFarmer }) => {
    const value = { surveyorPerFarmer, sanchalakPerFarmer };
    await Settings.findOneAndUpdate({ key: SETTINGS_KEY }, { value }, { upsert: true, new: true });
    return value;
};

/** Amounts to lock onto a registration when it is approved. */
export const commissionForApproval = async () => {
    const rates = await getFieldCommissionRates();
    return { surveyor: rates.surveyorPerFarmer, sanchalak: rates.sanchalakPerFarmer };
};

/**
 * The earning model for a role: every active item they earn commission on, with the agreed rate
 * or band and what it is paid on.
 */
const rateCardFor = async (role) => {
    const items = await listSeedItems();
    return items
        .map((item) => ({
            id: item._id,
            name: item.name,
            nameHi: item.nameHi || '',
            unit: item.unit,
            commission: commissionBand(item, role),
            basis: item.basis || '',
            basisHi: item.basisHi || '',
        }))
        // An item with no agreed rate for this role is not part of their earning model.
        .filter((row) => row.commission.perUnit > 0 || row.commission.max > 0);
};

const addUp = (...parts) => ({
    amount: parts.reduce((sum, part) => sum + (part?.amount || 0), 0),
    count: parts.reduce((sum, part) => sum + (part?.count || 0), 0),
});

/**
 * Everything one Surveyor or Sanchalak has earned, from both sources: the per-farmer registration
 * commission and the per-unit seed distribution commission, plus their rate card and the combined
 * total. `earned` / `pending` / `history` stay the registration figures on their own, so callers
 * can still show the split.
 *
 * @param {'surveyor'|'sanchalak'} role
 * @param {string} accountId
 */
export const getCommissionSummary = async (role, accountId) => {
    const scope = { [role]: new mongoose.Types.ObjectId(accountId) };
    const amountField = `$commission.${role}`;
    const rateKey = role === 'surveyor' ? 'surveyorPerFarmer' : 'sanchalakPerFarmer';

    const [rates, totals, history] = await Promise.all([
        getFieldCommissionRates(),
        FarmerRegistration.aggregate([
            { $match: { ...scope, status: { $in: ['approved', 'submitted'] } } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    amount: { $sum: { $ifNull: [amountField, 0] } },
                },
            },
        ]),
        FarmerRegistration.find({ ...scope, status: 'approved' })
            .select(`registrationCode name village district reviewedAt commission.${role}`)
            .sort({ reviewedAt: -1 })
            .limit(50)
            .lean(),
    ]);

    const byStatus = Object.fromEntries(totals.map((t) => [t._id, t]));
    const rate = rates[rateKey];
    const pendingCount = byStatus.submitted?.count || 0;

    const summary = {
        ratePerFarmer: rate,
        earned: { amount: byStatus.approved?.amount || 0, count: byStatus.approved?.count || 0 },
        // Not earned yet: what the farmers awaiting verification would pay at today's rate.
        pending: { amount: pendingCount * rate, count: pendingCount },
        history: history.map((h) => ({
            id: h._id,
            registrationCode: h.registrationCode,
            farmerName: h.name,
            location: [h.village, h.district].filter(Boolean).join(', '),
            amount: h.commission?.[role] || 0,
            earnedAt: h.reviewedAt,
        })),
    };

    const [rateCard, seed] = await Promise.all([rateCardFor(role), getSeedCommission(role, accountId)]);
    return {
        ...summary,
        rateCard,
        seed,
        total: {
            earned: addUp(summary.earned, seed.earned),
            pending: addUp(summary.pending, seed.pending),
        },
    };
};
