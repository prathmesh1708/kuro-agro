import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Surveyor from '../../../models/Surveyor.model.js';
import Kisan from '../../../models/Kisan.model.js';
import FarmerRegistration from '../../../models/FarmerRegistration.model.js';
import SeedDispatch from '../../../models/SeedDispatch.model.js';
import SeedIssue from '../../../models/SeedIssue.model.js';
import SeedRemittance from '../../../models/SeedRemittance.model.js';
import SurveyorSeedStock from '../../../models/SurveyorSeedStock.model.js';
import { createNotification } from '../../../services/notification.service.js';
import { notifyAdmins } from '../../../services/fieldAccountAuth.service.js';
import { amountFor, formatSeedQty, getActiveSeedItemOrThrow } from '../../../services/seedCatalog.service.js';
import {
    addDispatchToSurveyorStock,
    getSurveyorSeedAccount,
    getSurveyorSeedStock,
    listSeedRequests,
    releaseSurveyorReservation,
    reserveSurveyorStock,
    runInTransaction,
    toPlain,
} from '../../../services/seedDistribution.service.js';

// Seed distribution for a Surveyor: take delivery from admin, give it to their farmers,
// then send what they collect (less commission) back to admin.

const surveyorId = (req) => new mongoose.Types.ObjectId(req.user.id);
const KISAN_POPULATE = { path: 'kisan', select: 'name kisanCode phone address' };

const round2 = (value) => Math.round(value * 100) / 100;

// Farmers of this surveyor matching a search, for request searches by farmer name / phone / code.
const findMyKisanIds = (req) => async (pattern) =>
    Kisan.find({ surveyor: req.user.id, $or: [{ name: pattern }, { phone: pattern }, { kisanCode: pattern }] }).distinct('_id');

// ─── Dispatches from admin ────────────────────────────────────────────────────

// GET /api/surveyor/seed-dispatches
export const getSeedDispatches = asyncHandler(async (req, res) => {
    const data = await listSeedRequests(SeedDispatch, { surveyor: surveyorId(req) }, req.query);
    res.status(200).json(new ApiResponse(200, data, 'Seed dispatches fetched.'));
});

// GET /api/surveyor/seed-dispatches/:id
export const getSeedDispatchById = asyncHandler(async (req, res) => {
    const dispatch = await SeedDispatch.findOne({ _id: req.params.id, surveyor: req.user.id }).lean();
    if (!dispatch) throw new ApiError(404, 'Dispatch not found.');
    res.status(200).json(new ApiResponse(200, toPlain(dispatch), 'Dispatch fetched.'));
});

// PATCH /api/surveyor/seed-dispatches/:id/decision — received adds the seed to the surveyor's stock
export const decideSeedDispatch = asyncHandler(async (req, res) => {
    const { decision, remark = '' } = req.body;

    const dispatch = await runInTransaction(async (session) => {
        const current = await SeedDispatch.findOne({ _id: req.params.id, surveyor: req.user.id }).session(session);
        if (!current) throw new ApiError(404, 'Dispatch not found.');
        if (current.status !== 'pending') throw new ApiError(409, 'You have already responded to this dispatch.');

        current.status = decision;
        current.decidedAt = new Date();
        current.surveyorRemark = remark;
        current.history.push({ action: decision, byType: 'surveyor', by: req.user.id, note: remark });

        // The status check above runs inside the transaction, so a double tap cannot add stock twice.
        await current.save({ session });
        if (decision === 'received') await addDispatchToSurveyorStock(session, current);
        return current;
    });

    const surveyor = await Surveyor.findById(req.user.id).select('name surveyorCode').lean();
    const quantity = formatSeedQty(dispatch.quantity, dispatch.unit);
    await notifyAdmins({
        title: decision === 'received' ? 'Seed received by surveyor' : 'Seed not received',
        message:
            decision === 'received'
                ? `${surveyor.name} (${surveyor.surveyorCode}) received ${quantity} of ${dispatch.seedName} (${dispatch.dispatchCode}).`
                : `${surveyor.name} (${surveyor.surveyorCode}) did not receive ${quantity} of ${dispatch.seedName} (${dispatch.dispatchCode}): ${remark}`,
        data: { seedDispatchId: String(dispatch._id), dispatchCode: dispatch.dispatchCode, status: decision },
    });

    res.status(200).json(new ApiResponse(200, toPlain(dispatch), decision === 'received' ? 'Marked as received.' : 'Marked as not received.'));
});

// ─── Stock ────────────────────────────────────────────────────────────────────

// GET /api/surveyor/seed-stock
export const getSeedStock = asyncHandler(async (req, res) => {
    const stock = await getSurveyorSeedStock(req.user.id);
    res.status(200).json(new ApiResponse(200, stock, 'Seed stock fetched.'));
});

/**
 * GET /api/surveyor/my-kisans
 * Farmers this surveyor can give seed to: those with an active login account, which exists
 * only once admin has approved the registration. Their registered crops come along so the
 * issue form can surface the matching seed first.
 */
export const getMyKisans = asyncHandler(async (req, res) => {
    const kisans = await Kisan.find({ surveyor: req.user.id, status: 'active', isActive: true })
        .select('name kisanCode phone address registration')
        .sort({ name: 1 })
        .lean();

    const registrations = await FarmerRegistration.find({ _id: { $in: kisans.map((k) => k.registration) } })
        .select('crops')
        .lean();
    const cropsByRegistration = new Map(registrations.map((r) => [String(r._id), r.crops || []]));

    res.status(200).json(
        new ApiResponse(200, {
            kisans: kisans.map((k) => ({
                ...toPlain(k),
                crops: cropsByRegistration.get(String(k.registration)) || [],
            })),
        }, 'Farmers fetched.')
    );
});

// ─── Issues to farmers ────────────────────────────────────────────────────────

// POST /api/surveyor/seed-issues — give seed to a farmer; the quantity is reserved until they confirm
export const createSeedIssue = asyncHandler(async (req, res) => {
    const kisan = await Kisan.findOne({ _id: req.body.kisan, surveyor: req.user.id }).select('name kisanCode registration sanchalak status isActive').lean();
    if (!kisan) throw new ApiError(404, 'That farmer is not registered under you.');
    if (kisan.status !== 'active' || !kisan.isActive) throw new ApiError(400, `${kisan.name}'s account is not active.`);

    const item = await getActiveSeedItemOrThrow(req.body.seedItem);
    const { quantity, pricePerUnit } = req.body;

    // The commission rate the surveyor was promised when admin dispatched this seed to them.
    const lastDispatch = await SeedDispatch.findOne({ surveyor: req.user.id, seedItem: item._id, status: 'received' })
        .sort({ decidedAt: -1 })
        .select('commissionPerUnit')
        .lean();
    const commissionPerUnit = lastDispatch?.commissionPerUnit ?? item.commission?.perUnit ?? 0;

    const issue = await runInTransaction(async (session) => {
        const [created] = await SeedIssue.create([{
            surveyor: req.user.id,
            sanchalak: kisan.sanchalak,
            kisan: kisan._id,
            registration: kisan.registration,
            seedItem: item._id,
            seedName: item.name,
            unit: item.unit,
            quantity,
            pricePerUnit,
            totalAmount: amountFor(quantity, pricePerUnit),
            commissionPerUnit,
            commissionAmount: round2(quantity * commissionPerUnit),
            surveyorNote: req.body.note || '',
            history: [{ action: 'sent', byType: 'surveyor', by: req.user.id, note: req.body.note || '' }],
        }], { session });
        await reserveSurveyorStock(session, created);
        return created;
    });

    await createNotification({
        recipientId: kisan._id,
        recipientType: 'kisan',
        title: 'Seed on the way',
        message: `Your surveyor is sending you ${formatSeedQty(quantity, item.unit)} of ${item.name} for ₹${issue.totalAmount}. Please confirm when you receive it.`,
        type: 'system',
        data: { seedIssueId: String(issue._id), issueCode: issue.issueCode },
    });

    res.status(201).json(new ApiResponse(201, toPlain(issue), `Sent to ${kisan.name}.`));
});

// GET /api/surveyor/seed-issues
export const getSeedIssues = asyncHandler(async (req, res) => {
    const data = await listSeedRequests(SeedIssue, { surveyor: surveyorId(req) }, req.query, {
        populate: [KISAN_POPULATE],
        searchIdField: 'kisan',
        findSearchIds: findMyKisanIds(req),
        codeField: 'issueCode',
    });
    res.status(200).json(new ApiResponse(200, data, 'Seed issues fetched.'));
});

// GET /api/surveyor/seed-issues/:id
export const getSeedIssueById = asyncHandler(async (req, res) => {
    const issue = await SeedIssue.findOne({ _id: req.params.id, surveyor: req.user.id }).populate(KISAN_POPULATE).lean();
    if (!issue) throw new ApiError(404, 'Seed issue not found.');
    res.status(200).json(new ApiResponse(200, toPlain(issue), 'Seed issue fetched.'));
});

// PATCH /api/surveyor/seed-issues/:id/cancel — withdraw before the farmer responds; frees the stock
export const cancelSeedIssue = asyncHandler(async (req, res) => {
    const reason = req.body.reason || '';
    const issue = await runInTransaction(async (session) => {
        const current = await SeedIssue.findOne({ _id: req.params.id, surveyor: req.user.id }).session(session);
        if (!current) throw new ApiError(404, 'Seed issue not found.');
        if (current.status !== 'pending') throw new ApiError(409, 'The farmer has already responded to this.');

        current.status = 'cancelled';
        current.decidedAt = new Date();
        current.history.push({ action: 'cancelled', byType: 'surveyor', by: req.user.id, note: reason });
        await current.save({ session });
        await releaseSurveyorReservation(session, current, { byType: 'surveyor', by: req.user.id, note: reason });
        return current;
    });

    await createNotification({
        recipientId: issue.kisan,
        recipientType: 'kisan',
        title: 'Seed request cancelled',
        message: `${issue.seedName} (${issue.issueCode}) was cancelled by your surveyor${reason ? `: ${reason}` : '.'}`,
        type: 'system',
        data: { seedIssueId: String(issue._id), issueCode: issue.issueCode },
    });

    res.status(200).json(new ApiResponse(200, toPlain(issue), 'Seed issue cancelled.'));
});

/**
 * PATCH /api/surveyor/seed-issues/:id/confirm-payment
 * The farmer reports what they paid; the surveyor confirms they actually received it.
 * Only a confirmed payment counts towards what the surveyor owes admin.
 */
export const confirmSeedPayment = asyncHandler(async (req, res) => {
    const { confirmed, remark = '' } = req.body;
    const issue = await SeedIssue.findOne({ _id: req.params.id, surveyor: req.user.id });
    if (!issue) throw new ApiError(404, 'Seed issue not found.');
    if (issue.status !== 'received') throw new ApiError(400, 'The farmer has not confirmed receiving this seed yet.');
    if (issue.payment?.status !== 'paid') throw new ApiError(400, 'The farmer has not reported a payment for this yet.');

    issue.payment.confirmedBySurveyor = confirmed;
    issue.payment.confirmedAt = confirmed ? new Date() : undefined;
    issue.history.push({
        action: confirmed ? 'payment_confirmed' : 'payment_disputed',
        byType: 'surveyor',
        by: req.user.id,
        note: remark,
    });
    await issue.save();

    await createNotification({
        recipientId: issue.kisan,
        recipientType: 'kisan',
        title: confirmed ? 'Payment confirmed' : 'Payment not confirmed',
        message: confirmed
            ? `Your surveyor confirmed the ₹${issue.totalAmount} you paid for ${issue.seedName} (${issue.issueCode}).`
            : `Your surveyor could not confirm the payment for ${issue.seedName} (${issue.issueCode}): ${remark}`,
        type: 'payment',
        data: { seedIssueId: String(issue._id), issueCode: issue.issueCode },
    });

    res.status(200).json(new ApiResponse(200, toPlain(issue), confirmed ? 'Payment confirmed.' : 'Payment marked as not received.'));
});

// ─── Money owed to admin ──────────────────────────────────────────────────────

// GET /api/surveyor/seed-account
export const getSeedAccount = asyncHandler(async (req, res) => {
    const account = await getSurveyorSeedAccount(req.user.id);
    res.status(200).json(new ApiResponse(200, account, 'Seed account fetched.'));
});

// POST /api/surveyor/seed-remittances — tell admin money is on its way; admin confirms it
export const createSeedRemittance = asyncHandler(async (req, res) => {
    const surveyor = await Surveyor.findById(req.user.id).select('name surveyorCode sanchalak').lean();
    const account = await getSurveyorSeedAccount(req.user.id);
    if (account.payableToAdmin <= 0) throw new ApiError(400, 'You have nothing to send to admin right now.');
    if (req.body.amount > account.payableToAdmin) {
        throw new ApiError(400, `You can send at most ₹${account.payableToAdmin} right now.`);
    }

    const remittance = await SeedRemittance.create({
        surveyor: surveyor._id,
        sanchalak: surveyor.sanchalak,
        amount: req.body.amount,
        method: req.body.method,
        reference: req.body.reference || '',
        paidAt: req.body.paidAt || new Date(),
        surveyorNote: req.body.note || '',
        history: [{ action: 'sent', byType: 'surveyor', by: req.user.id, note: req.body.note || '' }],
    });

    await notifyAdmins({
        title: 'Seed payment from a surveyor',
        message: `${surveyor.name} (${surveyor.surveyorCode}) has sent ₹${remittance.amount} by ${remittance.method} (${remittance.remittanceCode}).`,
        data: { seedRemittanceId: String(remittance._id), remittanceCode: remittance.remittanceCode },
    });

    res.status(201).json(new ApiResponse(201, toPlain(remittance), 'Sent to admin for confirmation.'));
});

// GET /api/surveyor/seed-remittances
export const getSeedRemittances = asyncHandler(async (req, res) => {
    const data = await listSeedRequests(SeedRemittance, { surveyor: surveyorId(req) }, req.query, { codeField: 'remittanceCode' });
    res.status(200).json(new ApiResponse(200, data, 'Remittances fetched.'));
});

// Seed numbers for GET /api/surveyor/dashboard.
export const getSeedDashboard = async (id) => {
    const scope = new mongoose.Types.ObjectId(id);
    const [pendingDispatches, pendingIssues, awaitingConfirmation, account, stock] = await Promise.all([
        SeedDispatch.countDocuments({ surveyor: scope, status: 'pending' }),
        SeedIssue.countDocuments({ surveyor: scope, status: 'pending' }),
        SeedIssue.countDocuments({ surveyor: scope, status: 'received', 'payment.status': 'paid', 'payment.confirmedBySurveyor': { $ne: true } }),
        getSurveyorSeedAccount(id),
        SurveyorSeedStock.find({ surveyor: scope, quantity: { $gt: 0 } }).select('seedName unit quantity reserved').sort({ seedName: 1 }).lean(),
    ]);
    return { pendingDispatches, pendingIssues, awaitingConfirmation, account, stock: stock.map(toPlain) };
};
