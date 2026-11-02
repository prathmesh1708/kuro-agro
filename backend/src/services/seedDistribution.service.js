import mongoose from 'mongoose';
import SurveyorSeedStock from '../models/SurveyorSeedStock.model.js';
import SeedLedger from '../models/SeedLedger.model.js';
import SeedIssue from '../models/SeedIssue.model.js';
import SeedRemittance from '../models/SeedRemittance.model.js';
// Imported so the models this file populates are registered wherever it is used.
import '../models/Kisan.model.js';
import '../models/Surveyor.model.js';
import ApiError from '../utils/ApiError.js';
import { formatSeedQty } from './seedCatalog.service.js';
import { runInTransaction, toPlain } from './produceTrade.service.js';

// Stock and money movements for the Admin → Surveyor → Kisan seed flow.
// Every stock function takes a transaction `session` so a request's status change and the stock
// it moves commit together or not at all.

export { runInTransaction, toPlain };

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const writeLedger = (session, entries) => SeedLedger.create(entries, { session, ordered: true });

/** Surveyor confirmed a dispatch: add the quantity to their stock. */
export const addDispatchToSurveyorStock = async (session, dispatch) => {
    const { quantity, totalAmount } = dispatch;
    const stock = await SurveyorSeedStock.findOneAndUpdate(
        { surveyor: dispatch.surveyor, seedItem: dispatch.seedItem },
        {
            $inc: { quantity, receivedQty: quantity, receivedValue: totalAmount },
            $set: { seedName: dispatch.seedName, unit: dispatch.unit, lastReceivedAt: new Date() },
        },
        { upsert: true, new: true, session, setDefaultsOnInsert: true }
    );

    await writeLedger(session, [{
        ownerType: 'surveyor',
        surveyor: dispatch.surveyor,
        seedItem: dispatch.seedItem,
        seedName: dispatch.seedName,
        unit: dispatch.unit,
        reason: 'received_from_admin',
        changeQty: quantity,
        balanceQty: stock.quantity,
        amount: totalAmount,
        refModel: 'SeedDispatch',
        refId: dispatch._id,
        byType: 'surveyor',
        by: dispatch.surveyor,
    }]);
};

/** Holds stock for a new issue to a farmer. Fails when the free (unreserved) quantity is too small. */
export const reserveSurveyorStock = async (session, issue) => {
    const { quantity } = issue;
    const stock = await SurveyorSeedStock.findOneAndUpdate(
        {
            surveyor: issue.surveyor,
            seedItem: issue.seedItem,
            $expr: { $gte: [{ $subtract: ['$quantity', '$reserved'] }, quantity] },
        },
        { $inc: { reserved: quantity } },
        { new: true, session }
    );

    if (!stock) {
        const current = await SurveyorSeedStock.findOne({ surveyor: issue.surveyor, seedItem: issue.seedItem }).session(session).lean();
        const free = current ? Math.max(current.quantity - current.reserved, 0) : 0;
        throw new ApiError(400, `Only ${formatSeedQty(free, issue.unit)} of ${issue.seedName} is available to give out.`);
    }

    await writeLedger(session, [{
        ownerType: 'surveyor',
        surveyor: issue.surveyor,
        seedItem: issue.seedItem,
        seedName: issue.seedName,
        unit: issue.unit,
        reason: 'reserved_for_kisan',
        changeQty: 0,
        reservedChangeQty: quantity,
        balanceQty: stock.quantity,
        amount: issue.totalAmount,
        refModel: 'SeedIssue',
        refId: issue._id,
        byType: 'surveyor',
        by: issue.surveyor,
    }]);
};

/** Issue cancelled by the surveyor, or the farmer did not receive it: free the reserved stock. */
export const releaseSurveyorReservation = async (session, issue, { byType, by, note }) => {
    const stock = await SurveyorSeedStock.findOneAndUpdate(
        { surveyor: issue.surveyor, seedItem: issue.seedItem, reserved: { $gte: issue.quantity } },
        { $inc: { reserved: -issue.quantity } },
        { new: true, session }
    );
    if (!stock) throw new ApiError(409, 'Reserved seed for this request was not found. Please contact support.');

    await writeLedger(session, [{
        ownerType: 'surveyor',
        surveyor: issue.surveyor,
        seedItem: issue.seedItem,
        seedName: issue.seedName,
        unit: issue.unit,
        reason: 'reservation_released',
        changeQty: 0,
        reservedChangeQty: -issue.quantity,
        balanceQty: stock.quantity,
        refModel: 'SeedIssue',
        refId: issue._id,
        byType,
        by,
        note,
    }]);
};

/** Farmer confirmed receipt: the reserved quantity leaves the surveyor's stock for good. */
export const issueStockToKisan = async (session, issue) => {
    const { quantity, totalAmount } = issue;
    const stock = await SurveyorSeedStock.findOneAndUpdate(
        {
            surveyor: issue.surveyor,
            seedItem: issue.seedItem,
            reserved: { $gte: quantity },
            quantity: { $gte: quantity },
        },
        {
            $inc: { quantity: -quantity, reserved: -quantity, issuedQty: quantity, issuedValue: totalAmount },
            $set: { lastIssuedAt: new Date() },
        },
        { new: true, session }
    );
    if (!stock) throw new ApiError(409, 'Reserved seed for this request was not found. Please contact support.');

    await writeLedger(session, [{
        ownerType: 'surveyor',
        surveyor: issue.surveyor,
        seedItem: issue.seedItem,
        seedName: issue.seedName,
        unit: issue.unit,
        reason: 'issued_to_kisan',
        changeQty: -quantity,
        reservedChangeQty: -quantity,
        balanceQty: stock.quantity,
        amount: totalAmount,
        refModel: 'SeedIssue',
        refId: issue._id,
        byType: 'kisan',
        by: issue.kisan,
    }]);
};

// ─── Summaries ────────────────────────────────────────────────────────────────

/** Seed stock lines for one surveyor, with totals. */
export const getSurveyorSeedStock = async (surveyorId) => {
    const items = await SurveyorSeedStock.find({ surveyor: surveyorId }).sort({ seedName: 1 }).lean();
    const totals = items.reduce(
        (acc, item) => ({
            receivedValue: acc.receivedValue + item.receivedValue,
            issuedValue: acc.issuedValue + item.issuedValue,
        }),
        { receivedValue: 0, issuedValue: 0 }
    );
    return {
        items: items.map((item) => ({ ...toPlain(item), available: Math.max(item.quantity - item.reserved, 0) })),
        totals,
    };
};

/**
 * What a surveyor has collected, earned and still owes admin.
 *
 *   payableToAdmin = collected − commissionEarned − remitted − remittancePending
 *
 * `collected` counts only payments the surveyor has confirmed, so a farmer's mistyped entry
 * cannot move the surveyor's balance on its own.
 */
export const getSurveyorSeedAccount = async (surveyorId) => {
    const surveyor = new mongoose.Types.ObjectId(surveyorId);

    const [issueRows, remittanceRows] = await Promise.all([
        SeedIssue.aggregate([
            { $match: { surveyor, status: 'received' } },
            {
                $group: {
                    _id: null,
                    issuedValue: { $sum: '$totalAmount' },
                    commissionEarned: { $sum: '$commissionAmount' },
                    issues: { $sum: 1 },
                    collected: {
                        $sum: {
                            $cond: [{ $and: [{ $eq: ['$payment.status', 'paid'] }, { $eq: ['$payment.confirmedBySurveyor', true] }] }, '$totalAmount', 0],
                        },
                    },
                    reportedUnconfirmed: {
                        $sum: {
                            $cond: [{ $and: [{ $eq: ['$payment.status', 'paid'] }, { $ne: ['$payment.confirmedBySurveyor', true] }] }, '$totalAmount', 0],
                        },
                    },
                    unpaidCount: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, 0, 1] } },
                    unpaidAmount: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, 0, '$totalAmount'] } },
                },
            },
        ]),
        SeedRemittance.aggregate([
            { $match: { surveyor, status: { $in: ['pending', 'received'] } } },
            { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
    ]);

    const t = issueRows[0] || {};
    const byStatus = Object.fromEntries(remittanceRows.map((r) => [r._id, r]));
    const collected = t.collected || 0;
    const commissionEarned = t.commissionEarned || 0;
    const remitted = byStatus.received?.amount || 0;
    const remittancePending = byStatus.pending?.amount || 0;

    return {
        issuedValue: t.issuedValue || 0,
        issues: t.issues || 0,
        collected,
        commissionEarned,
        remitted,
        remittancePending,
        payableToAdmin: Math.max(collected - commissionEarned - remitted - remittancePending, 0),
        awaitingConfirmation: { amount: t.reportedUnconfirmed || 0 },
        outstandingFromFarmers: { amount: t.unpaidAmount || 0, count: t.unpaidCount || 0 },
    };
};

// Which fields on a SeedIssue hold each role's commission.
const COMMISSION_FIELDS = {
    surveyor: { amount: 'commissionAmount', rate: 'commissionPerUnit' },
    sanchalak: { amount: 'sanchalakCommissionAmount', rate: 'sanchalakCommissionPerUnit' },
};

/**
 * Seed commission for one Surveyor or Sanchalak: the surveyor earns for giving seed out, the
 * Sanchalak for the same distribution happening inside their Kendra.
 *
 * Earned on `received`, the moment the farmer confirms the seed arrived. Pending sums the amounts
 * already locked onto the open issues, so it needs no rate lookup and cannot drift if a rate changes.
 *
 * This is commission earned, not money owed. For a surveyor the same figure is also deducted from
 * what they must remit to admin — see getSurveyorSeedAccount().
 *
 * @param {'surveyor'|'sanchalak'} role
 * @param {string} accountId
 */
export const getSeedCommission = async (role, accountId) => {
    const { amount: amountField, rate: rateField } = COMMISSION_FIELDS[role];
    const scope = { [role]: new mongoose.Types.ObjectId(accountId) };
    const amount = { $sum: { $ifNull: [`$${amountField}`, 0] } };

    const [byItem, pendingRows, history] = await Promise.all([
        SeedIssue.aggregate([
            { $match: { ...scope, status: 'received' } },
            {
                $group: {
                    _id: '$seedItem',
                    seedName: { $first: '$seedName' },
                    unit: { $first: '$unit' },
                    quantity: { $sum: '$quantity' },
                    amount,
                    issues: { $sum: 1 },
                },
            },
            { $sort: { amount: -1 } },
        ]),
        SeedIssue.aggregate([
            { $match: { ...scope, status: 'pending' } },
            { $group: { _id: null, amount, count: { $sum: 1 } } },
        ]),
        SeedIssue.find({ ...scope, status: 'received' })
            .select(`issueCode seedName unit quantity ${rateField} ${amountField} decidedAt kisan surveyor`)
            .populate([
                { path: 'kisan', select: 'name kisanCode' },
                // Named on a Sanchalak's history so they can see which surveyor earned it.
                ...(role === 'sanchalak' ? [{ path: 'surveyor', select: 'name surveyorCode' }] : []),
            ])
            .sort({ decidedAt: -1 })
            .limit(50)
            .lean(),
    ]);

    const earned = byItem.reduce(
        (acc, row) => ({ amount: acc.amount + row.amount, count: acc.count + row.issues }),
        { amount: 0, count: 0 }
    );

    return {
        earned,
        pending: { amount: pendingRows[0]?.amount || 0, count: pendingRows[0]?.count || 0 },
        byItem: byItem.map((row) => ({ ...row, seedItem: row._id, id: row._id })),
        history: history.map((issue) => ({
            id: issue._id,
            issueCode: issue.issueCode,
            seedName: issue.seedName,
            quantity: issue.quantity,
            unit: issue.unit,
            ratePerUnit: issue[rateField] || 0,
            amount: issue[amountField] || 0,
            earnedAt: issue.decidedAt,
            farmerName: issue.kisan?.name || '',
            surveyorName: issue.surveyor?.name || '',
        })),
    };
};

// ─── Listing ──────────────────────────────────────────────────────────────────

/**
 * Paginated seed request list with per-status counts, mirroring listTradeRequests.
 * `scope` limits whose requests are listed; counts ignore the status filter.
 */
export const listSeedRequests = async (Model, scope, query, { populate = [], searchIdField, findSearchIds, codeField = 'dispatchCode' } = {}) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const filter = { ...scope };
    const countFilter = { ...scope };

    if (query.status) filter.status = query.status;
    if (query.search) {
        const pattern = { $regex: escapeRegex(query.search), $options: 'i' };
        filter.$or = [{ [codeField]: pattern }, { seedName: pattern }];
        if (findSearchIds) {
            const ids = await findSearchIds(pattern);
            if (ids.length) filter.$or.push({ [searchIdField]: { $in: ids } });
        }
    }

    const [requests, total, statusCounts] = await Promise.all([
        Model.find(filter).select('-history').populate(populate).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Model.countDocuments(filter),
        Model.aggregate([{ $match: countFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    return {
        requests: requests.map(toPlain),
        statusCounts: Object.fromEntries(statusCounts.map((c) => [c._id, c.count])),
        pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
};
