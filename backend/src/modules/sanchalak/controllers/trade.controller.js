import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Kisan from '../../../models/Kisan.model.js';
import Sanchalak from '../../../models/Sanchalak.model.js';
import KisanSaleRequest from '../../../models/KisanSaleRequest.model.js';
import SanchalakSaleRequest from '../../../models/SanchalakSaleRequest.model.js';
import SanchalakStock from '../../../models/SanchalakStock.model.js';
import { createNotification } from '../../../services/notification.service.js';
import { notifyAdmins } from '../../../services/fieldAccountAuth.service.js';
import { amountFor, getActiveProduceOrThrow, listProduce, toKg } from '../../../services/produce.service.js';
import {
    addKisanPurchaseToStock,
    applyPaymentUpdate,
    formatQuantity,
    getSanchalakStockSummary,
    listTradeRequests,
    releaseSanchalakReservation,
    reserveSanchalakStock,
    runInTransaction,
    toPlain,
} from '../../../services/produceTrade.service.js';

// Produce trade for a Sanchalak: buy from their Kendra's farmers, hold stock, sell on to admin.

const KISAN_POPULATE = { path: 'kisan', select: 'name kisanCode phone address' };

const sanchalakId = (req) => new mongoose.Types.ObjectId(req.user.id);

// Kisans of this Kendra matching a search, for request searches by farmer name / phone / code.
const findKendraKisanIds = (req) => async (pattern) =>
    Kisan.find({ sanchalak: req.user.id, $or: [{ name: pattern }, { phone: pattern }, { kisanCode: pattern }] }).distinct('_id');

// ─── Purchases from Kisans ────────────────────────────────────────────────────

// GET /api/sanchalak/purchase-requests
export const getPurchaseRequests = asyncHandler(async (req, res) => {
    const data = await listTradeRequests(KisanSaleRequest, { sanchalak: sanchalakId(req) }, req.query, {
        populate: [KISAN_POPULATE],
        searchIdField: 'kisan',
        findSearchIds: findKendraKisanIds(req),
    });
    res.status(200).json(new ApiResponse(200, data, 'Purchase requests fetched.'));
});

// GET /api/sanchalak/purchase-requests/:id
export const getPurchaseRequestById = asyncHandler(async (req, res) => {
    const request = await KisanSaleRequest.findOne({ _id: req.params.id, sanchalak: req.user.id })
        .populate([KISAN_POPULATE, { path: 'surveyor', select: 'name surveyorCode phone' }])
        .lean();
    if (!request) throw new ApiError(404, 'Request not found.');
    res.status(200).json(new ApiResponse(200, toPlain(request), 'Purchase request fetched.'));
});

// PATCH /api/sanchalak/purchase-requests/:id/decision
// Purchased: the Sanchalak may correct quantity / price after weighing; stock is added to the warehouse.
export const decidePurchaseRequest = asyncHandler(async (req, res) => {
    const { decision, remark = '' } = req.body;

    const request = await runInTransaction(async (session) => {
        const current = await KisanSaleRequest.findOne({ _id: req.params.id, sanchalak: req.user.id }).session(session);
        if (!current) throw new ApiError(404, 'Request not found.');
        if (current.status !== 'pending') throw new ApiError(409, 'This request has already been decided.');

        current.status = decision;
        current.decidedAt = new Date();
        current.sanchalakRemark = remark;

        let note = remark;
        if (decision === 'purchased') {
            const quantityKg = req.body.quantity !== undefined ? toKg(req.body.quantity, current.unit) : current.quantityKg;
            if (quantityKg < 1) throw new ApiError(400, 'Quantity is too small.');
            const pricePerUnit = req.body.pricePerUnit ?? current.pricePerUnit;
            current.purchased = { quantityKg, pricePerUnit, totalAmount: amountFor(quantityKg, pricePerUnit, current.unit) };

            const changed = quantityKg !== current.quantityKg || pricePerUnit !== current.pricePerUnit;
            if (changed) {
                note = [`Bought ${formatQuantity(quantityKg, current.unit)} at ₹${pricePerUnit}/${current.unit}`, remark].filter(Boolean).join(' · ');
            }
        }
        current.history.push({ action: decision, byType: 'sanchalak', by: req.user.id, note });

        // The status check above runs inside the transaction, so a double click cannot add stock twice.
        await current.save({ session });
        if (decision === 'purchased') await addKisanPurchaseToStock(session, current, req.user.id);
        return current;
    });

    const message =
        decision === 'purchased'
            ? `Your ${request.produceName} (${formatQuantity(request.purchased.quantityKg, request.unit)}) was purchased for ₹${request.purchased.totalAmount}.`
            : `Your ${request.produceName} offer was not purchased${remark ? `: ${remark}` : '.'}`;
    await createNotification({
        recipientId: request.kisan,
        recipientType: 'kisan',
        title: decision === 'purchased' ? 'Produce purchased' : 'Produce not purchased',
        message,
        type: 'system',
        data: { kisanSaleRequestId: String(request._id), requestCode: request.requestCode, status: decision },
    });

    res.status(200).json(new ApiResponse(200, toPlain(request), decision === 'purchased' ? 'Marked as purchased.' : 'Marked as not purchased.'));
});

// PATCH /api/sanchalak/purchase-requests/:id/payment — has the Sanchalak paid the farmer?
export const updatePurchasePayment = asyncHandler(async (req, res) => {
    const request = await KisanSaleRequest.findOne({ _id: req.params.id, sanchalak: req.user.id });
    if (!request) throw new ApiError(404, 'Request not found.');
    if (request.status !== 'purchased') throw new ApiError(400, 'Payment can only be recorded for a purchased request.');

    applyPaymentUpdate(request, req.body, { byType: 'sanchalak', by: req.user.id });
    await request.save();

    if (req.body.status === 'paid') {
        await createNotification({
            recipientId: request.kisan,
            recipientType: 'kisan',
            title: 'Payment received',
            message: `The Kendra has paid ₹${request.purchased.totalAmount} for your ${request.produceName} (${request.requestCode}).`,
            type: 'payment',
            data: { kisanSaleRequestId: String(request._id), requestCode: request.requestCode },
        });
    }

    res.status(200).json(new ApiResponse(200, toPlain(request), 'Payment updated.'));
});

// ─── Warehouse ────────────────────────────────────────────────────────────────

// GET /api/sanchalak/stock
export const getStock = asyncHandler(async (req, res) => {
    const summary = await getSanchalakStockSummary(req.user.id);
    res.status(200).json(new ApiResponse(200, summary, 'Stock fetched.'));
});

// GET /api/sanchalak/stock/by-kisan — what was bought from each farmer, per produce
export const getStockByKisan = asyncHandler(async (req, res) => {
    const rows = await KisanSaleRequest.aggregate([
        { $match: { sanchalak: sanchalakId(req), status: 'purchased' } },
        {
            $group: {
                _id: { kisan: '$kisan', produce: '$produce' },
                produceName: { $last: '$produceName' },
                unit: { $last: '$unit' },
                quantityKg: { $sum: '$purchased.quantityKg' },
                amount: { $sum: '$purchased.totalAmount' },
                unpaidAmount: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, 0, '$purchased.totalAmount'] } },
                purchases: { $sum: 1 },
                lastPurchasedAt: { $max: '$decidedAt' },
            },
        },
        { $sort: { lastPurchasedAt: -1 } },
        {
            $group: {
                _id: '$_id.kisan',
                amount: { $sum: '$amount' },
                unpaidAmount: { $sum: '$unpaidAmount' },
                lastPurchasedAt: { $max: '$lastPurchasedAt' },
                produce: {
                    $push: {
                        produce: '$_id.produce',
                        produceName: '$produceName',
                        unit: '$unit',
                        quantityKg: '$quantityKg',
                        amount: '$amount',
                        purchases: '$purchases',
                    },
                },
            },
        },
        { $sort: { lastPurchasedAt: -1 } },
        { $lookup: { from: Kisan.collection.name, localField: '_id', foreignField: '_id', as: 'kisan' } },
        { $unwind: '$kisan' },
        {
            $project: {
                _id: 0,
                kisan: { id: '$kisan._id', name: '$kisan.name', kisanCode: '$kisan.kisanCode', phone: '$kisan.phone', village: '$kisan.address.village' },
                amount: 1,
                unpaidAmount: 1,
                lastPurchasedAt: 1,
                produce: 1,
            },
        },
    ]);
    res.status(200).json(new ApiResponse(200, { kisans: rows }, 'Purchases by farmer fetched.'));
});

// ─── Sales to Admin ───────────────────────────────────────────────────────────

// GET /api/sanchalak/produce — produce list (the sell form only offers what is in stock)
export const getProduceList = asyncHandler(async (req, res) => {
    const produce = await listProduce();
    res.status(200).json(new ApiResponse(200, { produce: produce.map(toPlain) }, 'Produce fetched.'));
});

// POST /api/sanchalak/sale-requests — offer warehouse stock to admin; the quantity is reserved
export const createSaleRequest = asyncHandler(async (req, res) => {
    const produce = await getActiveProduceOrThrow(req.body.produce);
    const quantityKg = toKg(req.body.quantity, produce.unit);
    if (quantityKg < 1) throw new ApiError(400, 'Quantity is too small.');

    const request = await runInTransaction(async (session) => {
        const [created] = await SanchalakSaleRequest.create([{
            sanchalak: req.user.id,
            produce: produce._id,
            produceName: produce.name,
            unit: produce.unit,
            quantityKg,
            pricePerUnit: req.body.pricePerUnit,
            totalAmount: amountFor(quantityKg, req.body.pricePerUnit, produce.unit),
            sanchalakNote: req.body.note || '',
            history: [{ action: 'submitted', byType: 'sanchalak', by: req.user.id, note: req.body.note || '' }],
        }], { session });
        await reserveSanchalakStock(session, created);
        return created;
    });

    const sanchalak = await Sanchalak.findById(req.user.id).select('name kendraName sanchalakCode').lean();
    await notifyAdmins({
        title: 'New produce from a Kendra',
        message: `${sanchalak.kendraName} (${sanchalak.sanchalakCode}) is sending ${formatQuantity(quantityKg, produce.unit)} of ${produce.name} at ₹${req.body.pricePerUnit}/${produce.unit}.`,
        data: { sanchalakSaleRequestId: String(request._id), requestCode: request.requestCode },
    });

    res.status(201).json(new ApiResponse(201, toPlain(request), 'Sent to admin.'));
});

// GET /api/sanchalak/sale-requests
export const getSaleRequests = asyncHandler(async (req, res) => {
    const data = await listTradeRequests(SanchalakSaleRequest, { sanchalak: sanchalakId(req) }, req.query);
    res.status(200).json(new ApiResponse(200, data, 'Sale requests fetched.'));
});

// GET /api/sanchalak/sale-requests/:id
export const getSaleRequestById = asyncHandler(async (req, res) => {
    const request = await SanchalakSaleRequest.findOne({ _id: req.params.id, sanchalak: req.user.id }).lean();
    if (!request) throw new ApiError(404, 'Request not found.');
    res.status(200).json(new ApiResponse(200, toPlain(request), 'Sale request fetched.'));
});

// PATCH /api/sanchalak/sale-requests/:id/cancel — withdraw a pending offer and free the stock
export const cancelSaleRequest = asyncHandler(async (req, res) => {
    const reason = req.body.reason || '';
    const request = await runInTransaction(async (session) => {
        const current = await SanchalakSaleRequest.findOne({ _id: req.params.id, sanchalak: req.user.id }).session(session);
        if (!current) throw new ApiError(404, 'Request not found.');
        if (current.status !== 'pending') throw new ApiError(409, 'This request has already been decided.');

        current.status = 'cancelled';
        current.decidedAt = new Date();
        current.history.push({ action: 'cancelled', byType: 'sanchalak', by: req.user.id, note: reason });
        await current.save({ session });
        await releaseSanchalakReservation(session, current, { byType: 'sanchalak', by: req.user.id, note: reason });
        return current;
    });
    res.status(200).json(new ApiResponse(200, toPlain(request), 'Request cancelled.'));
});

// Dashboard numbers for the produce trade, merged into GET /api/sanchalak/dashboard.
export const getTradeDashboard = async (id) => {
    const scope = new mongoose.Types.ObjectId(id);
    const [pendingPurchases, pendingSales, unpaid, stock] = await Promise.all([
        KisanSaleRequest.countDocuments({ sanchalak: scope, status: 'pending' }),
        SanchalakSaleRequest.countDocuments({ sanchalak: scope, status: 'pending' }),
        KisanSaleRequest.aggregate([
            { $match: { sanchalak: scope, status: 'purchased', 'payment.status': 'unpaid' } },
            { $group: { _id: null, amount: { $sum: '$purchased.totalAmount' }, count: { $sum: 1 } } },
        ]),
        SanchalakStock.find({ sanchalak: scope, quantityKg: { $gt: 0 } }).select('produceName unit quantityKg reservedKg').sort({ produceName: 1 }).lean(),
    ]);
    return {
        pendingPurchases,
        pendingSales,
        unpaidToKisans: { amount: unpaid[0]?.amount || 0, count: unpaid[0]?.count || 0 },
        stock: stock.map(toPlain),
    };
};
