import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import { slugify } from '../../../utils/slugify.js';
import SeedItem from '../../../models/SeedItem.model.js';
import SeedDispatch from '../../../models/SeedDispatch.model.js';
import SeedIssue from '../../../models/SeedIssue.model.js';
import SeedRemittance from '../../../models/SeedRemittance.model.js';
import SeedLedger from '../../../models/SeedLedger.model.js';
import SurveyorSeedStock from '../../../models/SurveyorSeedStock.model.js';
import Surveyor from '../../../models/Surveyor.model.js';
import Kisan from '../../../models/Kisan.model.js';
import { createNotification } from '../../../services/notification.service.js';
import {
    amountFor,
    formatSeedQty,
    getActiveSeedItemOrThrow,
    listSeedItems,
    resolveCommissionRate,
} from '../../../services/seedCatalog.service.js';
import {
    getSurveyorSeedAccount,
    getSurveyorSeedStock,
    listSeedRequests,
    toPlain,
} from '../../../services/seedDistribution.service.js';

const toObjectId = (id) => new mongoose.Types.ObjectId(id);
const SURVEYOR_POPULATE = { path: 'surveyor', select: 'name surveyorCode phone' };
const SANCHALAK_POPULATE = { path: 'sanchalak', select: 'name kendraName sanchalakCode' };

const findSurveyorIds = (pattern) =>
    Surveyor.find({ $or: [{ name: pattern }, { phone: pattern }, { surveyorCode: pattern }] }).distinct('_id');

// ─── Seed catalog ─────────────────────────────────────────────────────────────

/**
 * @desc    All seed items, including hidden ones
 * @route   GET /api/admin/seed-items
 * @access  Private (Admin)
 */
export const getSeedItems = asyncHandler(async (req, res) => {
    const items = await listSeedItems({ activeOnly: false });
    res.status(200).json(new ApiResponse(200, { items: items.map(toPlain) }, 'Seed items fetched.'));
});

const assertNameFree = async (name, excludeId) => {
    const clash = await SeedItem.exists({ slug: slugify(name), ...(excludeId && { _id: { $ne: excludeId } }) });
    if (clash) throw new ApiError(409, `${name} is already in the seed list.`);
};

const seedItemPayload = ({ name, nameHi = '', unit, produce, defaultPricePerUnit, commission, sortOrder }) => ({
    name,
    nameHi,
    slug: slugify(name),
    ...(unit && { unit }),
    produce: produce || undefined,
    ...(defaultPricePerUnit !== undefined && { defaultPricePerUnit }),
    ...(commission && { commission: { perUnit: commission.perUnit, min: commission.min ?? commission.perUnit, max: commission.max ?? commission.perUnit } }),
    ...(sortOrder !== undefined && { sortOrder }),
});

/**
 * @desc    Add a seed item to the catalog
 * @route   POST /api/admin/seed-items
 * @access  Private (Admin)
 */
export const createSeedItem = asyncHandler(async (req, res) => {
    await assertNameFree(req.body.name);
    const last = await SeedItem.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    const item = await SeedItem.create({
        ...seedItemPayload(req.body),
        sortOrder: req.body.sortOrder ?? (last?.sortOrder || 0) + 1,
    });
    res.status(201).json(new ApiResponse(201, toPlain(item), 'Seed item added.'));
});

/**
 * @desc    Edit a seed item. The unit is fixed once it has been dispatched.
 * @route   PUT /api/admin/seed-items/:id
 * @access  Private (Admin)
 */
export const updateSeedItem = asyncHandler(async (req, res) => {
    const item = await SeedItem.findById(req.params.id);
    if (!item) throw new ApiError(404, 'Seed item not found.');
    await assertNameFree(req.body.name, item._id);

    if (req.body.unit && req.body.unit !== item.unit) {
        const dispatched = await SeedDispatch.exists({ seedItem: item._id });
        if (dispatched) throw new ApiError(400, 'The unit cannot be changed after this seed has been dispatched.');
    }

    item.set(seedItemPayload(req.body));
    await item.save();
    res.status(200).json(new ApiResponse(200, toPlain(item), 'Seed item updated.'));
});

/**
 * @desc    Show or hide a seed item. Existing records are kept.
 * @route   PATCH /api/admin/seed-items/:id/status
 * @access  Private (Admin)
 */
export const updateSeedItemStatus = asyncHandler(async (req, res) => {
    const item = await SeedItem.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true });
    if (!item) throw new ApiError(404, 'Seed item not found.');
    res.status(200).json(new ApiResponse(200, toPlain(item), item.isActive ? 'Seed item shown.' : 'Seed item hidden.'));
});

// ─── Dispatches to surveyors ──────────────────────────────────────────────────

/**
 * @desc    Send seed to a surveyor. They confirm receipt before it enters their stock.
 * @route   POST /api/admin/seed-dispatches
 * @access  Private (Admin)
 */
export const createSeedDispatch = asyncHandler(async (req, res) => {
    const surveyor = await Surveyor.findById(req.body.surveyor).select('name surveyorCode sanchalak status isActive').lean();
    if (!surveyor) throw new ApiError(404, 'Surveyor not found.');
    if (surveyor.status !== 'approved' || !surveyor.isActive) {
        throw new ApiError(400, 'Seed can only be sent to an approved, active surveyor.');
    }

    const item = await getActiveSeedItemOrThrow(req.body.seedItem);
    const commissionPerUnit = resolveCommissionRate(item, req.body.commissionPerUnit);
    const { quantity, pricePerUnit } = req.body;

    const dispatch = await SeedDispatch.create({
        surveyor: surveyor._id,
        sanchalak: surveyor.sanchalak,
        seedItem: item._id,
        seedName: item.name,
        unit: item.unit,
        quantity,
        pricePerUnit,
        totalAmount: amountFor(quantity, pricePerUnit),
        commissionPerUnit,
        adminNote: req.body.note || '',
        sentBy: req.user.id,
        history: [{ action: 'sent', byType: 'admin', by: req.user.id, note: req.body.note || '' }],
    });

    await createNotification({
        recipientId: surveyor._id,
        recipientType: 'surveyor',
        title: 'Seed on the way',
        message: `Admin has sent you ${formatSeedQty(quantity, item.unit)} of ${item.name} at ₹${pricePerUnit}/${item.unit}. Please confirm when it arrives.`,
        type: 'system',
        data: { seedDispatchId: String(dispatch._id), dispatchCode: dispatch.dispatchCode },
    });

    res.status(201).json(new ApiResponse(201, toPlain(dispatch), `Sent to ${surveyor.name}.`));
});

/**
 * @desc    Seed dispatches, filterable by surveyor or Kendra
 * @route   GET /api/admin/seed-dispatches
 * @access  Private (Admin)
 */
export const getSeedDispatches = asyncHandler(async (req, res) => {
    const scope = {};
    ['surveyor', 'sanchalak'].forEach((key) => {
        if (req.query[key]) scope[key] = toObjectId(req.query[key]);
    });
    const data = await listSeedRequests(SeedDispatch, scope, req.query, {
        populate: [SURVEYOR_POPULATE, SANCHALAK_POPULATE],
        searchIdField: 'surveyor',
        findSearchIds: findSurveyorIds,
    });
    res.status(200).json(new ApiResponse(200, data, 'Seed dispatches fetched.'));
});

/**
 * @desc    One dispatch with its history
 * @route   GET /api/admin/seed-dispatches/:id
 * @access  Private (Admin)
 */
export const getSeedDispatchById = asyncHandler(async (req, res) => {
    const dispatch = await SeedDispatch.findById(req.params.id).populate([SURVEYOR_POPULATE, SANCHALAK_POPULATE]).lean();
    if (!dispatch) throw new ApiError(404, 'Dispatch not found.');
    res.status(200).json(new ApiResponse(200, toPlain(dispatch), 'Dispatch fetched.'));
});

/**
 * @desc    Withdraw a dispatch the surveyor has not responded to yet
 * @route   PATCH /api/admin/seed-dispatches/:id/cancel
 * @access  Private (Admin)
 */
export const cancelSeedDispatch = asyncHandler(async (req, res) => {
    const reason = req.body.reason || '';
    const dispatch = await SeedDispatch.findOneAndUpdate(
        { _id: req.params.id, status: 'pending' },
        {
            status: 'cancelled',
            decidedAt: new Date(),
            $push: { history: { action: 'cancelled', byType: 'admin', by: req.user.id, note: reason } },
        },
        { new: true }
    );
    if (!dispatch) {
        const exists = await SeedDispatch.exists({ _id: req.params.id });
        throw new ApiError(exists ? 409 : 404, exists ? 'The surveyor has already responded to this dispatch.' : 'Dispatch not found.');
    }

    await createNotification({
        recipientId: dispatch.surveyor,
        recipientType: 'surveyor',
        title: 'Seed dispatch cancelled',
        message: `Dispatch ${dispatch.dispatchCode} (${dispatch.seedName}) was cancelled by admin${reason ? `: ${reason}` : '.'}`,
        type: 'system',
        data: { seedDispatchId: String(dispatch._id), dispatchCode: dispatch.dispatchCode },
    });

    res.status(200).json(new ApiResponse(200, toPlain(dispatch), 'Dispatch cancelled.'));
});

// ─── Issues to farmers (read-only oversight) ──────────────────────────────────

/**
 * @desc    Seed given to farmers by surveyors, with the farmer's payment
 * @route   GET /api/admin/seed-issues
 * @access  Private (Admin)
 */
export const getSeedIssues = asyncHandler(async (req, res) => {
    const scope = {};
    ['surveyor', 'kisan', 'sanchalak'].forEach((key) => {
        if (req.query[key]) scope[key] = toObjectId(req.query[key]);
    });
    const data = await listSeedRequests(SeedIssue, scope, req.query, {
        populate: [SURVEYOR_POPULATE, { path: 'kisan', select: 'name kisanCode phone address' }],
        searchIdField: 'kisan',
        findSearchIds: (pattern) => Kisan.find({ $or: [{ name: pattern }, { phone: pattern }, { kisanCode: pattern }] }).distinct('_id'),
        codeField: 'issueCode',
    });
    res.status(200).json(new ApiResponse(200, data, 'Seed issues fetched.'));
});

/**
 * @desc    One seed issue with its history
 * @route   GET /api/admin/seed-issues/:id
 * @access  Private (Admin)
 */
export const getSeedIssueById = asyncHandler(async (req, res) => {
    const issue = await SeedIssue.findById(req.params.id)
        .populate([SURVEYOR_POPULATE, SANCHALAK_POPULATE, { path: 'kisan', select: 'name kisanCode phone address' }])
        .lean();
    if (!issue) throw new ApiError(404, 'Seed issue not found.');
    res.status(200).json(new ApiResponse(200, toPlain(issue), 'Seed issue fetched.'));
});

// ─── Remittances from surveyors ───────────────────────────────────────────────

/**
 * @desc    Money sent in by surveyors
 * @route   GET /api/admin/seed-remittances
 * @access  Private (Admin)
 */
export const getSeedRemittances = asyncHandler(async (req, res) => {
    const scope = {};
    ['surveyor', 'sanchalak'].forEach((key) => {
        if (req.query[key]) scope[key] = toObjectId(req.query[key]);
    });
    const data = await listSeedRequests(SeedRemittance, scope, req.query, {
        populate: [SURVEYOR_POPULATE, SANCHALAK_POPULATE],
        searchIdField: 'surveyor',
        findSearchIds: findSurveyorIds,
        codeField: 'remittanceCode',
    });
    res.status(200).json(new ApiResponse(200, data, 'Remittances fetched.'));
});

/**
 * @desc    Confirm or reject money a surveyor says they sent. Only a confirmed
 *          remittance comes off what the surveyor owes.
 * @route   PATCH /api/admin/seed-remittances/:id/decision
 * @access  Private (Admin)
 */
export const decideSeedRemittance = asyncHandler(async (req, res) => {
    const { decision, remark = '' } = req.body;
    const remittance = await SeedRemittance.findOneAndUpdate(
        { _id: req.params.id, status: 'pending' },
        {
            status: decision,
            decidedAt: new Date(),
            decidedBy: req.user.id,
            adminRemark: remark,
            $push: { history: { action: decision, byType: 'admin', by: req.user.id, note: remark } },
        },
        { new: true }
    );
    if (!remittance) {
        const exists = await SeedRemittance.exists({ _id: req.params.id });
        throw new ApiError(exists ? 409 : 404, exists ? 'This remittance has already been decided.' : 'Remittance not found.');
    }

    await createNotification({
        recipientId: remittance.surveyor,
        recipientType: 'surveyor',
        title: decision === 'received' ? 'Payment received by admin' : 'Payment not received',
        message:
            decision === 'received'
                ? `Admin confirmed ₹${remittance.amount} (${remittance.remittanceCode}). Your balance has been updated.`
                : `Admin marked ₹${remittance.amount} (${remittance.remittanceCode}) as not received: ${remark}`,
        type: 'payment',
        data: { seedRemittanceId: String(remittance._id), remittanceCode: remittance.remittanceCode, status: decision },
    });

    res.status(200).json(new ApiResponse(200, toPlain(remittance), decision === 'received' ? 'Marked as received.' : 'Marked as not received.'));
});

// ─── Stock and ledger ─────────────────────────────────────────────────────────

/**
 * @desc    Seed held across the field network, plus what is pending and owed
 * @route   GET /api/admin/seed-stock
 * @access  Private (Admin)
 */
export const getSeedStockOverview = asyncHandler(async (req, res) => {
    const [withSurveyors, pendingDispatches, pendingRemittances, collected] = await Promise.all([
        SurveyorSeedStock.aggregate([
            { $match: { quantity: { $gt: 0 } } },
            { $group: { _id: '$seedItem', seedName: { $first: '$seedName' }, unit: { $first: '$unit' }, quantity: { $sum: '$quantity' }, surveyors: { $sum: 1 } } },
            { $sort: { seedName: 1 } },
        ]),
        SeedDispatch.countDocuments({ status: 'pending' }),
        SeedRemittance.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        SeedIssue.aggregate([
            { $match: { status: 'received' } },
            {
                $group: {
                    _id: null,
                    issuedValue: { $sum: '$totalAmount' },
                    commission: { $sum: '$commissionAmount' },
                    collected: {
                        $sum: { $cond: [{ $and: [{ $eq: ['$payment.status', 'paid'] }, { $eq: ['$payment.confirmedBySurveyor', true] }] }, '$totalAmount', 0] },
                    },
                },
            },
        ]),
    ]);

    const money = collected[0] || {};
    const remitted = await SeedRemittance.aggregate([
        { $match: { status: 'received' } },
        { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            withSurveyors: withSurveyors.map((row) => ({ ...row, seedItem: row._id })),
            pendingDispatches,
            pendingRemittances: { amount: pendingRemittances[0]?.amount || 0, count: pendingRemittances[0]?.count || 0 },
            money: {
                issuedValue: money.issuedValue || 0,
                collected: money.collected || 0,
                commission: money.commission || 0,
                remitted: remitted[0]?.amount || 0,
                dueFromSurveyors: Math.max((money.collected || 0) - (money.commission || 0) - (remitted[0]?.amount || 0), 0),
            },
        }, 'Seed overview fetched.')
    );
});

/**
 * @desc    Seed stock and money summary for one surveyor
 * @route   GET /api/admin/surveyors/:id/seed-summary
 * @access  Private (Admin)
 */
export const getSurveyorSeedSummary = asyncHandler(async (req, res) => {
    const [stock, account] = await Promise.all([
        getSurveyorSeedStock(req.params.id),
        getSurveyorSeedAccount(req.params.id),
    ]);
    res.status(200).json(new ApiResponse(200, { stock, account }, 'Seed summary fetched.'));
});

/**
 * @desc    Seed stock movement history
 * @route   GET /api/admin/seed-ledger
 * @access  Private (Admin)
 */
export const getSeedLedger = asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = {};
    if (req.query.ownerType) filter.ownerType = req.query.ownerType;
    if (req.query.surveyor) filter.surveyor = toObjectId(req.query.surveyor);
    if (req.query.seedItem) filter.seedItem = toObjectId(req.query.seedItem);

    const [entries, total] = await Promise.all([
        SeedLedger.find(filter)
            .populate([{ path: 'surveyor', select: 'name surveyorCode' }])
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        SeedLedger.countDocuments(filter),
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            entries: entries.map(toPlain),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
        }, 'Seed ledger fetched.')
    );
});
