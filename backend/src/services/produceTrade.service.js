import mongoose from 'mongoose';
import SanchalakStock from '../models/SanchalakStock.model.js';
import AdminStock from '../models/AdminStock.model.js';
import StockLedger from '../models/StockLedger.model.js';
import Product from '../models/Product.model.js';
import ApiError from '../utils/ApiError.js';
import { PRODUCE_UNITS } from '../models/Produce.model.js';

// Stock movements for the Kisan → Sanchalak → Admin produce flow.
// Every function here takes a transaction `session` so a request's status change and the stock it moves
// commit together or not at all.

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const formatQuantity = (kg, unit) => `${Number((kg / PRODUCE_UNITS[unit]).toFixed(2))} ${unit}`;

/**
 * Runs `work(session)` in a MongoDB transaction and returns its result.
 * The driver may call `work` again on a transient write conflict, so it must not have side effects
 * outside the session (send notifications after this resolves).
 */
export const runInTransaction = async (work) => {
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await work(session);
        });
        return result;
    } finally {
        await session.endSession();
    }
};

const writeLedger = (session, entries) => StockLedger.create(entries, { session, ordered: true });

/** Sanchalak bought from a Kisan: add the purchased quantity to the Kendra warehouse. */
export const addKisanPurchaseToStock = async (session, request, sanchalakId) => {
    const { quantityKg, totalAmount } = request.purchased;
    const stock = await SanchalakStock.findOneAndUpdate(
        { sanchalak: request.sanchalak, produce: request.produce },
        {
            $inc: { quantityKg, purchasedKg: quantityKg, purchasedValue: totalAmount },
            $set: { produceName: request.produceName, unit: request.unit, lastPurchasedAt: new Date() },
        },
        { upsert: true, new: true, session, setDefaultsOnInsert: true }
    );

    await writeLedger(session, [{
        ownerType: 'sanchalak',
        sanchalak: request.sanchalak,
        produce: request.produce,
        produceName: request.produceName,
        unit: request.unit,
        reason: 'kisan_purchase',
        changeKg: quantityKg,
        balanceKg: stock.quantityKg,
        amount: totalAmount,
        refModel: 'KisanSaleRequest',
        refId: request._id,
        byType: 'sanchalak',
        by: sanchalakId,
    }]);
};

/** Holds stock for a new offer to admin. Fails when the free (unreserved) quantity is too small. */
export const reserveSanchalakStock = async (session, request) => {
    const { quantityKg } = request;
    const stock = await SanchalakStock.findOneAndUpdate(
        {
            sanchalak: request.sanchalak,
            produce: request.produce,
            $expr: { $gte: [{ $subtract: ['$quantityKg', '$reservedKg'] }, quantityKg] },
        },
        { $inc: { reservedKg: quantityKg } },
        { new: true, session }
    );

    if (!stock) {
        const current = await SanchalakStock.findOne({ sanchalak: request.sanchalak, produce: request.produce }).session(session).lean();
        const freeKg = current ? Math.max(current.quantityKg - current.reservedKg, 0) : 0;
        throw new ApiError(400, `Only ${formatQuantity(freeKg, request.unit)} of ${request.produceName} is available to sell.`);
    }

    await writeLedger(session, [{
        ownerType: 'sanchalak',
        sanchalak: request.sanchalak,
        produce: request.produce,
        produceName: request.produceName,
        unit: request.unit,
        reason: 'reserved_for_admin',
        changeKg: 0,
        reservedChangeKg: quantityKg,
        balanceKg: stock.quantityKg,
        amount: request.totalAmount,
        refModel: 'SanchalakSaleRequest',
        refId: request._id,
        byType: 'sanchalak',
        by: request.sanchalak,
    }]);
};

/** Offer cancelled by the Sanchalak or marked not received by admin: free the reserved stock again. */
export const releaseSanchalakReservation = async (session, request, { byType, by, note }) => {
    const stock = await SanchalakStock.findOneAndUpdate(
        { sanchalak: request.sanchalak, produce: request.produce, reservedKg: { $gte: request.quantityKg } },
        { $inc: { reservedKg: -request.quantityKg } },
        { new: true, session }
    );
    if (!stock) throw new ApiError(409, 'Reserved stock for this request was not found. Please contact support.');

    await writeLedger(session, [{
        ownerType: 'sanchalak',
        sanchalak: request.sanchalak,
        produce: request.produce,
        produceName: request.produceName,
        unit: request.unit,
        reason: 'reservation_released',
        changeKg: 0,
        reservedChangeKg: -request.quantityKg,
        balanceKg: stock.quantityKg,
        refModel: 'SanchalakSaleRequest',
        refId: request._id,
        byType,
        by,
        note,
    }]);
};

/** Admin received an offer: move the reserved quantity out of the Kendra warehouse into admin stock. */
export const transferSanchalakStockToAdmin = async (session, request, adminId) => {
    const { quantityKg, totalAmount } = request;
    const now = new Date();

    const stock = await SanchalakStock.findOneAndUpdate(
        {
            sanchalak: request.sanchalak,
            produce: request.produce,
            reservedKg: { $gte: quantityKg },
            quantityKg: { $gte: quantityKg },
        },
        {
            $inc: { quantityKg: -quantityKg, reservedKg: -quantityKg, soldKg: quantityKg, soldValue: totalAmount },
            $set: { lastSoldAt: now },
        },
        { new: true, session }
    );
    if (!stock) throw new ApiError(409, 'Reserved stock for this request was not found. Please contact support.');

    const adminStock = await AdminStock.findOneAndUpdate(
        { produce: request.produce },
        {
            $inc: { quantityKg, receivedKg: quantityKg, receivedValue: totalAmount },
            $set: { produceName: request.produceName, unit: request.unit, lastReceivedAt: now },
        },
        { upsert: true, new: true, session, setDefaultsOnInsert: true }
    );

    const common = {
        produce: request.produce,
        produceName: request.produceName,
        unit: request.unit,
        amount: totalAmount,
        refModel: 'SanchalakSaleRequest',
        refId: request._id,
        byType: 'admin',
        by: adminId,
    };
    await writeLedger(session, [
        {
            ...common,
            ownerType: 'sanchalak',
            sanchalak: request.sanchalak,
            reason: 'sent_to_admin',
            changeKg: -quantityKg,
            reservedChangeKg: -quantityKg,
            balanceKg: stock.quantityKg,
        },
        { ...common, ownerType: 'admin', reason: 'received_from_sanchalak', changeKg: quantityKg, balanceKg: adminStock.quantityKg },
    ]);
};

/**
 * Admin packs procured stock for the store: take `quantityKg` out of admin stock and add `productUnits`
 * to the Product's stock (e.g. 1 quintal → 100 packs of 1 kg).
 */
export const moveAdminStockToProduct = async (session, { produceId, quantityKg, productId, productUnits, adminId, note }) => {
    const adminStock = await AdminStock.findOneAndUpdate(
        { produce: produceId, quantityKg: { $gte: quantityKg } },
        { $inc: { quantityKg: -quantityKg, movedToProductsKg: quantityKg } },
        { new: true, session }
    );
    if (!adminStock) {
        const current = await AdminStock.findOne({ produce: produceId }).session(session).lean();
        if (!current) throw new ApiError(404, 'No procured stock found for this produce.');
        throw new ApiError(400, `Only ${formatQuantity(current.quantityKg, current.unit)} of ${current.produceName} is in stock.`);
    }

    const product = await Product.findById(productId).session(session);
    if (!product) throw new ApiError(404, 'Product not found.');
    // A variant product's total is recalculated from its per-variant stock on every edit, so it would lose these units.
    if (product.variants?.stockMap?.size > 0) {
        throw new ApiError(400, `${product.name} tracks stock per variant. Add the units to a variant from the product page instead.`);
    }
    product.stockQuantity += productUnits;
    product.stock = product.stockQuantity <= product.lowStockThreshold ? 'low_stock' : 'in_stock';
    await product.save({ session, validateBeforeSave: false });

    await writeLedger(session, [{
        ownerType: 'admin',
        produce: produceId,
        produceName: adminStock.produceName,
        unit: adminStock.unit,
        reason: 'moved_to_product',
        changeKg: -quantityKg,
        balanceKg: adminStock.quantityKg,
        refModel: 'Product',
        refId: product._id,
        productUnits,
        byType: 'admin',
        by: adminId,
        note,
    }]);

    return { adminStock, product };
};

// ─── Listing ──────────────────────────────────────────────────────────────────

const paginate = ({ page = 1, limit = 20 }) => {
    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 20;
    return { page: numericPage, limit: numericLimit, skip: (numericPage - 1) * numericLimit };
};

export const toPlain = (doc) => {
    const plain = typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc };
    const { __v, ...rest } = plain;
    return { ...rest, id: plain._id };
};

/**
 * Paginated request list with per-status counts.
 * `scope` limits whose requests are listed (e.g. { sanchalak: id }); counts ignore the status filter.
 * `search` matches the request code and produce name, plus `searchIds` (e.g. matching Kisans) on `searchIdField`.
 */
export const listTradeRequests = async (Model, scope, query, { populate = [], searchIdField, findSearchIds } = {}) => {
    const { page, limit, skip } = paginate(query);
    const filter = { ...scope };
    const countFilter = { ...scope };

    if (query.status) filter.status = query.status;
    if (query.search) {
        const pattern = { $regex: escapeRegex(query.search), $options: 'i' };
        filter.$or = [{ requestCode: pattern }, { produceName: pattern }];
        if (findSearchIds) {
            const ids = await findSearchIds(pattern);
            if (ids.length) filter.$or.push({ [searchIdField]: { $in: ids } });
        }
    }

    const [requests, total, statusCounts] = await Promise.all([
        Model.find(filter).select('-history').populate(populate).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Model.countDocuments(filter),
        Model.aggregate([{ $match: countFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    return {
        requests: requests.map(toPlain),
        statusCounts: Object.fromEntries(statusCounts.map((c) => [c._id, c.count])),
        pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
};

/** Kendra warehouse lines for one Sanchalak, with totals across produce. */
export const getSanchalakStockSummary = async (sanchalakId) => {
    const items = await SanchalakStock.find({ sanchalak: sanchalakId }).sort({ produceName: 1 }).lean();
    const totals = items.reduce(
        (acc, item) => ({
            purchasedValue: acc.purchasedValue + item.purchasedValue,
            soldValue: acc.soldValue + item.soldValue,
        }),
        { purchasedValue: 0, soldValue: 0 }
    );
    return {
        items: items.map((item) => ({ ...toPlain(item), availableKg: Math.max(item.quantityKg - item.reservedKg, 0) })),
        totals,
    };
};

/** Records a payment change on an accepted request. `payment` is { status, method, reference, paidAt }. */
export const applyPaymentUpdate = (request, payment, { byType, by }) => {
    request.payment = payment.status === 'paid'
        ? { status: 'paid', method: payment.method, reference: payment.reference || '', paidAt: payment.paidAt || new Date() }
        : { status: 'unpaid' };
    request.history.push({
        action: payment.status === 'paid' ? 'payment_marked_paid' : 'payment_marked_unpaid',
        byType,
        by,
        note: payment.status === 'paid' ? [payment.method, payment.reference].filter(Boolean).join(' · ') : '',
    });
};
