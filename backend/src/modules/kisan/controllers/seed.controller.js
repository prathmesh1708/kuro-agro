import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import SeedIssue from '../../../models/SeedIssue.model.js';
import { createNotification } from '../../../services/notification.service.js';
import { formatSeedQty } from '../../../services/seedCatalog.service.js';
import {
    issueStockToKisan,
    listSeedRequests,
    releaseSurveyorReservation,
    runInTransaction,
    toPlain,
} from '../../../services/seedDistribution.service.js';

// Seed a farmer is given by their surveyor: confirm it arrived, then record the payment made.

const SURVEYOR_POPULATE = { path: 'surveyor', select: 'name surveyorCode phone' };

// GET /api/kisan/seed-issues
export const getSeedIssues = asyncHandler(async (req, res) => {
    const data = await listSeedRequests(SeedIssue, { kisan: new mongoose.Types.ObjectId(req.user.id) }, req.query, {
        populate: [SURVEYOR_POPULATE],
        codeField: 'issueCode',
    });
    res.status(200).json(new ApiResponse(200, data, 'Seed requests fetched.'));
});

// GET /api/kisan/seed-issues/:id
export const getSeedIssueById = asyncHandler(async (req, res) => {
    const issue = await SeedIssue.findOne({ _id: req.params.id, kisan: req.user.id }).populate(SURVEYOR_POPULATE).lean();
    if (!issue) throw new ApiError(404, 'Seed request not found.');
    res.status(200).json(new ApiResponse(200, toPlain(issue), 'Seed request fetched.'));
});

/**
 * PATCH /api/kisan/seed-issues/:id/decision
 * Received: the seed leaves the surveyor's stock for good and their commission is earned.
 * Not received: the surveyor gets the quantity back.
 */
export const decideSeedIssue = asyncHandler(async (req, res) => {
    const { decision, remark = '' } = req.body;

    const issue = await runInTransaction(async (session) => {
        const current = await SeedIssue.findOne({ _id: req.params.id, kisan: req.user.id }).session(session);
        if (!current) throw new ApiError(404, 'Seed request not found.');
        if (current.status !== 'pending') throw new ApiError(409, 'You have already responded to this.');

        current.status = decision;
        current.decidedAt = new Date();
        current.kisanRemark = remark;
        current.history.push({ action: decision, byType: 'kisan', by: req.user.id, note: remark });

        // The status check above runs inside the transaction, so a double tap cannot move stock twice.
        await current.save({ session });
        if (decision === 'received') {
            await issueStockToKisan(session, current);
        } else {
            await releaseSurveyorReservation(session, current, { byType: 'kisan', by: req.user.id, note: remark });
        }
        return current;
    });

    const quantity = formatSeedQty(issue.quantity, issue.unit);
    await createNotification({
        recipientId: issue.surveyor,
        recipientType: 'surveyor',
        title: decision === 'received' ? 'Seed received by farmer' : 'Seed not received',
        message:
            decision === 'received'
                ? `The farmer received ${quantity} of ${issue.seedName} (${issue.issueCode}). ₹${issue.totalAmount} is due from them.`
                : `The farmer did not receive ${quantity} of ${issue.seedName} (${issue.issueCode}): ${remark}. The seed is back in your stock.`,
        type: 'system',
        data: { seedIssueId: String(issue._id), issueCode: issue.issueCode, status: decision },
    });

    res.status(200).json(new ApiResponse(200, toPlain(issue), decision === 'received' ? 'Marked as received.' : 'Marked as not received.'));
});

/**
 * PATCH /api/kisan/seed-issues/:id/payment
 * The farmer records that they have paid the surveyor, and by which method.
 * The surveyor confirms it before it counts towards what they owe admin.
 */
export const updateSeedPayment = asyncHandler(async (req, res) => {
    const issue = await SeedIssue.findOne({ _id: req.params.id, kisan: req.user.id });
    if (!issue) throw new ApiError(404, 'Seed request not found.');
    if (issue.status !== 'received') throw new ApiError(400, 'Mark the seed as received first.');
    if (issue.payment?.confirmedBySurveyor) throw new ApiError(409, 'Your surveyor has already confirmed this payment.');

    const paid = req.body.status === 'paid';
    issue.payment = paid
        ? {
              status: 'paid',
              method: req.body.method,
              reference: req.body.reference || '',
              paidAt: req.body.paidAt || new Date(),
              reportedAt: new Date(),
              confirmedBySurveyor: false,
          }
        : { status: 'unpaid' };
    issue.history.push({
        action: paid ? 'payment_reported' : 'payment_cleared',
        byType: 'kisan',
        by: req.user.id,
        note: paid ? [req.body.method, req.body.reference].filter(Boolean).join(' · ') : '',
    });
    await issue.save();

    if (paid) {
        await createNotification({
            recipientId: issue.surveyor,
            recipientType: 'surveyor',
            title: 'Payment reported by a farmer',
            message: `The farmer says they paid ₹${issue.totalAmount} by ${req.body.method} for ${issue.seedName} (${issue.issueCode}). Please confirm.`,
            type: 'payment',
            data: { seedIssueId: String(issue._id), issueCode: issue.issueCode },
        });
    }

    res.status(200).json(new ApiResponse(200, toPlain(issue), paid ? 'Payment recorded. Your surveyor will confirm it.' : 'Payment cleared.'));
});

// Seed numbers for GET /api/kisan/dashboard.
export const getSeedDashboard = async (id) => {
    const kisan = new mongoose.Types.ObjectId(id);
    const [pending, due] = await Promise.all([
        SeedIssue.countDocuments({ kisan, status: 'pending' }),
        SeedIssue.aggregate([
            { $match: { kisan, status: 'received', 'payment.status': { $ne: 'paid' } } },
            { $group: { _id: null, amount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        ]),
    ]);
    return { pendingSeedRequests: pending, seedPaymentDue: { amount: due[0]?.amount || 0, count: due[0]?.count || 0 } };
};
