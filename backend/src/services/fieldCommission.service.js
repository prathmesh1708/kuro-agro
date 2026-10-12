import mongoose from 'mongoose';
import Settings from '../models/Settings.model.js';
import FarmerRegistration from '../models/FarmerRegistration.model.js';

// Commission for the field network: a fixed ₹ amount per farmer the admin approves.
// The amount is copied onto the registration at approval, so later rate changes never rewrite history.

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
 * Commission summary for one Surveyor or Sanchalak.
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

    return {
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
};
