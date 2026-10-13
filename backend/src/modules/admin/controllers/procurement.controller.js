import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import { slugify } from '../../../utils/slugify.js';
import Produce from '../../../models/Produce.model.js';
import Kisan from '../../../models/Kisan.model.js';
import Sanchalak from '../../../models/Sanchalak.model.js';
import KisanSaleRequest from '../../../models/KisanSaleRequest.model.js';
import SanchalakSaleRequest from '../../../models/SanchalakSaleRequest.model.js';
import SanchalakStock from '../../../models/SanchalakStock.model.js';
import AdminStock from '../../../models/AdminStock.model.js';
import StockLedger from '../../../models/StockLedger.model.js';
import { createNotification } from '../../../services/notification.service.js';
import { listProduce, toKg } from '../../../services/produce.service.js';
import {
    applyPaymentUpdate,
    formatQuantity,
    listTradeRequests,
    moveAdminStockToProduct,
    releaseSanchalakReservation,
    runInTransaction,
    toPlain,
    transferSanchalakStockToAdmin,
} from '../../../services/produceTrade.service.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toObjectId = (id) => new mongoose.Types.ObjectId(id);
const SANCHALAK_POPULATE = { path: 'sanchalak', select: 'name kendraName sanchalakCode phone' };

// ─── Produce list ─────────────────────────────────────────────────────────────

/**
 * @desc    All produce, including hidden ones
 * @route   GET /api/admin/produce
 * @access  Private (Admin)
 */
export const getProduce = asyncHandler(async (req, res) => {
    const produce = await listProduce({ activeOnly: false });
    res.status(200).json(new ApiResponse(200, { produce: produce.map(toPlain) }, 'Produce fetched.'));
});

const assertNameFree = async (name, excludeId) => {
    const clash = await Produce.exists({ slug: slugify(name), ...(excludeId && { _id: { $ne: excludeId } }) });
    if (clash) throw new ApiError(409, `${name} is already in the produce list.`);
};

/**
 * @desc    Add a produce to the list
 * @route   POST /api/admin/produce
 * @access  Private (Admin)
 */
export const createProduce = asyncHandler(async (req, res) => {
    const { name, nameHi = '', unit = 'quintal', sortOrder } = req.body;
    await assertNameFree(name);
    const last = await Produce.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    const produce = await Produce.create({ name, nameHi, unit, slug: slugify(name), sortOrder: sortOrder ?? (last?.sortOrder || 0) + 1 });
    res.status(201).json(new ApiResponse(201, toPlain(produce), 'Produce added.'));
});

/**
 * @desc    Rename or reorder a produce. The unit is fixed once it has been traded.
 * @route   PUT /api/admin/produce/:id
 * @access  Private (Admin)
 */
export const updateProduce = asyncHandler(async (req, res) => {
    const produce = await Produce.findById(req.params.id);
    if (!produce) throw new ApiError(404, 'Produce not found.');

    const { name, nameHi, unit, sortOrder } = req.body;
    await assertNameFree(name, produce._id);

    if (unit && unit !== produce.unit) {
        const traded = await KisanSaleRequest.exists({ produce: produce._id });
        if (traded) throw new ApiError(400, 'The unit cannot be changed after this produce has been traded.');
        produce.unit = unit;
    }
    produce.name = name;
    produce.slug = slugify(name);
    if (nameHi !== undefined) produce.nameHi = nameHi;
    if (sortOrder !== undefined) produce.sortOrder = sortOrder;
    await produce.save();

    res.status(200).json(new ApiResponse(200, toPlain(produce), 'Produce updated.'));
});

/**
 * @desc    Show or hide a produce in the sell dropdowns. Existing records are kept.
 * @route   PATCH /api/admin/produce/:id/status
 * @access  Private (Admin)
 */
export const updateProduceStatus = asyncHandler(async (req, res) => {
    const produce = await Produce.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true });
    if (!produce) throw new ApiError(404, 'Produce not found.');
    res.status(200).json(new ApiResponse(200, toPlain(produce), produce.isActive ? 'Produce shown.' : 'Produce hidden.'));
});

// ─── Kisan → Sanchalak purchases (read-only for admin) ────────────────────────

/**
 * @desc    Produce offers from Kisans to Kendras, filterable by Sanchalak, Kisan or registration
 * @route   GET /api/admin/kisan-sale-requests
 * @access  Private (Admin)
 */
export const getKisanSaleRequests = asyncHandler(async (req, res) => {
    const scope = {};
    ['sanchalak', 'kisan', 'registration'].forEach((key) => {
        if (req.query[key]) scope[key] = toObjectId(req.query[key]);
    });
    const data = await listTradeRequests(KisanSaleRequest, scope, req.query, {
        populate: [{ path: 'kisan', select: 'name kisanCode phone address' }, SANCHALAK_POPULATE],
        searchIdField: 'kisan',
        findSearchIds: (pattern) => Kisan.find({ $or: [{ name: pattern }, { phone: pattern }, { kisanCode: pattern }] }).distinct('_id'),
    });
    res.status(200).json(new ApiResponse(200, data, 'Kisan sale requests fetched.'));
});

// ─── Sanchalak → Admin procurement ────────────────────────────────────────────

/**
 * @desc    Produce offered to admin by Sanchalaks
 * @route   GET /api/admin/procurement-requests
 * @access  Private (Admin)
 */
export const getProcurementRequests = asyncHandler(async (req, res) => {
    const scope = req.query.sanchalak ? { sanchalak: toObjectId(req.query.sanchalak) } : {};
    const data = await listTradeRequests(SanchalakSaleRequest, scope, req.query, {
        populate: [SANCHALAK_POPULATE],
        searchIdField: 'sanchalak',
        findSearchIds: (pattern) =>
            Sanchalak.find({ $or: [{ name: pattern }, { kendraName: pattern }, { sanchalakCode: pattern }] }).distinct('_id'),
    });
    res.status(200).json(new ApiResponse(200, data, 'Procurement requests fetched.'));
});

/**
 * @desc    One procurement request with its history
 * @route   GET /api/admin/procurement-requests/:id
 * @access  Private (Admin)
 */
export const getProcurementRequestById = asyncHandler(async (req, res) => {
    const request = await SanchalakSaleRequest.findById(req.params.id)
        .populate({ path: 'sanchalak', select: 'name kendraName sanchalakCode phone address' })
        .lean();
    if (!request) throw new ApiError(404, 'Request not found.');
    res.status(200).json(new ApiResponse(200, toPlain(request), 'Procurement request fetched.'));
});

/**
 * @desc    Received: stock moves from the Kendra into admin stock. Not received: the Kendra's stock is freed.
 * @route   PATCH /api/admin/procurement-requests/:id/decision
 * @access  Private (Admin)
 */
export const decideProcurementRequest = asyncHandler(async (req, res) => {
    const { decision, remark = '' } = req.body;

    const request = await runInTransaction(async (session) => {
        const current = await SanchalakSaleRequest.findById(req.params.id).session(session);
        if (!current) throw new ApiError(404, 'Request not found.');
        if (current.status !== 'pending') throw new ApiError(409, 'This request has already been decided.');

        current.status = decision;
        current.decidedAt = new Date();
        current.decidedBy = req.user.id;
        current.adminRemark = remark;
        current.history.push({ action: decision, byType: 'admin', by: req.user.id, note: remark });
        await current.save({ session });

        if (decision === 'received') {
            await transferSanchalakStockToAdmin(session, current, req.user.id);
        } else {
            await releaseSanchalakReservation(session, current, { byType: 'admin', by: req.user.id, note: remark });
        }
        return current;
    });

    const quantity = formatQuantity(request.quantityKg, request.unit);
    await createNotification({
        recipientId: request.sanchalak,
        recipientType: 'sanchalak',
        title: decision === 'received' ? 'Produce received by admin' : 'Produce not received',
        message:
            decision === 'received'
                ? `Admin received ${quantity} of ${request.produceName} (${request.requestCode}) worth ₹${request.totalAmount}.`
                : `Admin marked ${quantity} of ${request.produceName} (${request.requestCode}) as not received: ${remark}. The stock is back in your warehouse.`,
        type: 'system',
        data: { sanchalakSaleRequestId: String(request._id), requestCode: request.requestCode, status: decision },
    });

    res.status(200).json(new ApiResponse(200, toPlain(request), decision === 'received' ? 'Marked as received.' : 'Marked as not received.'));
});

/**
 * @desc    Record whether admin has paid the Sanchalak for a received request
 * @route   PATCH /api/admin/procurement-requests/:id/payment
 * @access  Private (Admin)
 */
export const updateProcurementPayment = asyncHandler(async (req, res) => {
    const request = await SanchalakSaleRequest.findById(req.params.id);
    if (!request) throw new ApiError(404, 'Request not found.');
    if (request.status !== 'received') throw new ApiError(400, 'Payment can only be recorded for a received request.');

    applyPaymentUpdate(request, req.body, { byType: 'admin', by: req.user.id });
    await request.save();

    if (req.body.status === 'paid') {
        await createNotification({
            recipientId: request.sanchalak,
            recipientType: 'sanchalak',
            title: 'Payment received',
            message: `Admin has paid ₹${request.totalAmount} for ${request.produceName} (${request.requestCode}).`,
            type: 'payment',
            data: { sanchalakSaleRequestId: String(request._id), requestCode: request.requestCode },
        });
    }

    res.status(200).json(new ApiResponse(200, toPlain(request), 'Payment updated.'));
});

// ─── Procured stock ───────────────────────────────────────────────────────────

/**
 * @desc    Admin stock per produce, plus what is still held in Kendra warehouses
 * @route   GET /api/admin/admin-stock
 * @access  Private (Admin)
 */
export const getAdminStock = asyncHandler(async (req, res) => {
    const [items, inKendras, pending, unpaid] = await Promise.all([
        AdminStock.find().sort({ produceName: 1 }).lean(),
        SanchalakStock.aggregate([
            { $match: { quantityKg: { $gt: 0 } } },
            { $group: { _id: '$produce', produceName: { $first: '$produceName' }, unit: { $first: '$unit' }, quantityKg: { $sum: '$quantityKg' }, kendras: { $sum: 1 } } },
            { $sort: { produceName: 1 } },
        ]),
        SanchalakSaleRequest.countDocuments({ status: 'pending' }),
        SanchalakSaleRequest.aggregate([
            { $match: { status: 'received', 'payment.status': 'unpaid' } },
            { $group: { _id: null, amount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        ]),
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            items: items.map(toPlain),
            inKendras: inKendras.map((row) => ({ ...row, produce: row._id })),
            pendingRequests: pending,
            unpaidToSanchalaks: { amount: unpaid[0]?.amount || 0, count: unpaid[0]?.count || 0 },
        }, 'Procured stock fetched.')
    );
});

/**
 * @desc    Move procured stock into a store Product's stock (e.g. 1 quintal → 100 packs)
 * @route   POST /api/admin/admin-stock/:id/move-to-product   (:id is the produce id)
 * @access  Private (Admin)
 */
export const moveStockToProduct = asyncHandler(async (req, res) => {
    const produce = await Produce.findById(req.params.id).lean();
    if (!produce) throw new ApiError(404, 'Produce not found.');
    const quantityKg = toKg(req.body.quantity, produce.unit);
    if (quantityKg < 1) throw new ApiError(400, 'Quantity is too small.');

    const { adminStock, product } = await runInTransaction((session) =>
        moveAdminStockToProduct(session, {
            produceId: produce._id,
            quantityKg,
            productId: req.body.productId,
            productUnits: req.body.productUnits,
            adminId: req.user.id,
            note: req.body.note || '',
        })
    );

    res.status(200).json(
        new ApiResponse(200, {
            stock: toPlain(adminStock),
            product: { id: product._id, name: product.name, stockQuantity: product.stockQuantity, unit: product.unit },
        }, `Added ${req.body.productUnits} to ${product.name}.`)
    );
});

/**
 * @desc    Stock movement history
 * @route   GET /api/admin/stock-ledger
 * @access  Private (Admin)
 */
export const getStockLedger = asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = {};
    if (req.query.ownerType) filter.ownerType = req.query.ownerType;
    if (req.query.sanchalak) filter.sanchalak = toObjectId(req.query.sanchalak);
    if (req.query.produce) filter.produce = toObjectId(req.query.produce);

    const [entries, total] = await Promise.all([
        StockLedger.find(filter)
            .populate([{ path: 'sanchalak', select: 'name kendraName sanchalakCode' }])
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        StockLedger.countDocuments(filter),
    ]);

    // Product names for "moved to product" entries.
    const productIds = entries.filter((e) => e.refModel === 'Product').map((e) => e.refId);
    const products = productIds.length
        ? await mongoose.model('Product').find({ _id: { $in: productIds } }).select('name').lean()
        : [];
    const productNames = new Map(products.map((p) => [String(p._id), p.name]));

    res.status(200).json(
        new ApiResponse(200, {
            entries: entries.map((e) => ({ ...toPlain(e), productName: e.refModel === 'Product' ? productNames.get(String(e.refId)) : undefined })),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
        }, 'Stock ledger fetched.')
    );
});

// ─── Kisan accounts ───────────────────────────────────────────────────────────

/**
 * @desc    Kisan (farmer) login accounts
 * @route   GET /api/admin/kisans
 * @access  Private (Admin)
 */
export const getKisans = asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = {};
    if (req.query.sanchalak) filter.sanchalak = toObjectId(req.query.sanchalak);
    if (req.query.registration) filter.registration = toObjectId(req.query.registration);
    if (req.query.search) {
        const pattern = { $regex: escapeRegex(req.query.search), $options: 'i' };
        filter.$or = [{ name: pattern }, { phone: pattern }, { kisanCode: pattern }, { 'address.village': pattern }];
    }

    const [kisans, total] = await Promise.all([
        Kisan.find(filter).populate(SANCHALAK_POPULATE).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Kisan.countDocuments(filter),
    ]);
    res.status(200).json(
        new ApiResponse(200, { kisans: kisans.map(toPlain), pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } }, 'Kisans fetched.')
    );
});

/**
 * @desc    Suspend or reactivate a Kisan account
 * @route   PATCH /api/admin/kisans/:id/status
 * @access  Private (Admin)
 */
export const updateKisanStatus = asyncHandler(async (req, res) => {
    const { status, reason = '' } = req.body;
    const kisan = await Kisan.findById(req.params.id);
    if (!kisan) throw new ApiError(404, 'Kisan not found.');

    kisan.status = status;
    kisan.rejectionReason = status === 'suspended' ? reason : '';
    if (status === 'suspended') {
        // Signed out on the next token refresh.
        kisan.refreshTokenHash = undefined;
        kisan.refreshTokenExpiresAt = undefined;
    }
    await kisan.save({ validateBeforeSave: false });

    res.status(200).json(new ApiResponse(200, toPlain(kisan), status === 'suspended' ? 'Kisan suspended.' : 'Kisan reactivated.'));
});
