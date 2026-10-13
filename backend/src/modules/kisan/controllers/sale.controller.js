import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Kisan from '../../../models/Kisan.model.js';
import Sanchalak from '../../../models/Sanchalak.model.js';
import KisanSaleRequest from '../../../models/KisanSaleRequest.model.js';
import { createNotification } from '../../../services/notification.service.js';
import { amountFor, getActiveProduceOrThrow, listProduce, toKg } from '../../../services/produce.service.js';
import { formatQuantity, listTradeRequests, toPlain } from '../../../services/produceTrade.service.js';

const SANCHALAK_POPULATE = { path: 'sanchalak', select: 'name kendraName sanchalakCode phone' };

// GET /api/kisan/produce
export const getProduceList = asyncHandler(async (req, res) => {
    const produce = await listProduce();
    res.status(200).json(new ApiResponse(200, { produce: produce.map(toPlain) }, 'Produce fetched.'));
});

// GET /api/kisan/dashboard
export const getDashboard = asyncHandler(async (req, res) => {
    const kisanId = new mongoose.Types.ObjectId(req.user.id);
    const [byStatus, unpaid] = await Promise.all([
        KisanSaleRequest.aggregate([
            { $match: { kisan: kisanId } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    quantityKg: { $sum: { $ifNull: ['$purchased.quantityKg', 0] } },
                    amount: { $sum: { $ifNull: ['$purchased.totalAmount', 0] } },
                },
            },
        ]),
        KisanSaleRequest.aggregate([
            { $match: { kisan: kisanId, status: 'purchased', 'payment.status': 'unpaid' } },
            { $group: { _id: null, amount: { $sum: '$purchased.totalAmount' }, count: { $sum: 1 } } },
        ]),
    ]);
    const statusCounts = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
    const sold = byStatus.find((row) => row._id === 'purchased');

    res.status(200).json(
        new ApiResponse(200, {
            statusCounts,
            sold: { count: sold?.count || 0, amount: sold?.amount || 0 },
            paymentDue: { count: unpaid[0]?.count || 0, amount: unpaid[0]?.amount || 0 },
        }, 'Dashboard fetched.')
    );
});

// POST /api/kisan/sale-requests
export const createSaleRequest = asyncHandler(async (req, res) => {
    const kisan = await Kisan.findById(req.user.id).lean();
    const sanchalak = await Sanchalak.findById(kisan.sanchalak).select('name kendraName status isActive').lean();
    if (!sanchalak || sanchalak.status !== 'approved' || !sanchalak.isActive) {
        throw new ApiError(403, 'Your Kendra is not accepting produce right now. Please contact your Sanchalak.');
    }

    const produce = await getActiveProduceOrThrow(req.body.produce);
    const quantityKg = toKg(req.body.quantity, produce.unit);
    if (quantityKg < 1) throw new ApiError(400, 'Quantity is too small.');

    const request = await KisanSaleRequest.create({
        kisan: kisan._id,
        registration: kisan.registration,
        sanchalak: kisan.sanchalak,
        surveyor: kisan.surveyor,
        produce: produce._id,
        produceName: produce.name,
        unit: produce.unit,
        quantityKg,
        pricePerUnit: req.body.pricePerUnit,
        totalAmount: amountFor(quantityKg, req.body.pricePerUnit, produce.unit),
        kisanNote: req.body.note || '',
        history: [{ action: 'submitted', byType: 'kisan', by: kisan._id, note: req.body.note || '' }],
    });

    await createNotification({
        recipientId: kisan.sanchalak,
        recipientType: 'sanchalak',
        title: 'New produce offer',
        message: `${kisan.name} wants to sell ${formatQuantity(quantityKg, produce.unit)} of ${produce.name} at ₹${req.body.pricePerUnit}/${produce.unit}.`,
        type: 'system',
        data: { kisanSaleRequestId: String(request._id), requestCode: request.requestCode },
    });

    res.status(201).json(new ApiResponse(201, toPlain(request), 'Your offer has been sent to the Kendra.'));
});

// GET /api/kisan/sale-requests
export const getSaleRequests = asyncHandler(async (req, res) => {
    const data = await listTradeRequests(KisanSaleRequest, { kisan: new mongoose.Types.ObjectId(req.user.id) }, req.query, {
        populate: [SANCHALAK_POPULATE],
    });
    res.status(200).json(new ApiResponse(200, data, 'Requests fetched.'));
});

// GET /api/kisan/sale-requests/:id
export const getSaleRequestById = asyncHandler(async (req, res) => {
    const request = await KisanSaleRequest.findOne({ _id: req.params.id, kisan: req.user.id }).populate(SANCHALAK_POPULATE).lean();
    if (!request) throw new ApiError(404, 'Request not found.');
    res.status(200).json(new ApiResponse(200, toPlain(request), 'Request fetched.'));
});

// PATCH /api/kisan/sale-requests/:id/cancel — only while the Kendra has not decided yet
export const cancelSaleRequest = asyncHandler(async (req, res) => {
    const reason = req.body.reason || '';
    const request = await KisanSaleRequest.findOneAndUpdate(
        { _id: req.params.id, kisan: req.user.id, status: 'pending' },
        {
            status: 'cancelled',
            decidedAt: new Date(),
            $push: { history: { action: 'cancelled', byType: 'kisan', by: req.user.id, note: reason } },
        },
        { new: true }
    );
    if (!request) {
        const exists = await KisanSaleRequest.exists({ _id: req.params.id, kisan: req.user.id });
        throw new ApiError(exists ? 409 : 404, exists ? 'This request has already been decided.' : 'Request not found.');
    }

    await createNotification({
        recipientId: request.sanchalak,
        recipientType: 'sanchalak',
        title: 'Produce offer cancelled',
        message: `Offer ${request.requestCode} (${request.produceName}) was cancelled by the farmer.`,
        type: 'system',
        data: { kisanSaleRequestId: String(request._id), requestCode: request.requestCode },
    });

    res.status(200).json(new ApiResponse(200, toPlain(request), 'Request cancelled.'));
});
