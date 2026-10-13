import Joi from 'joi';
import { PRODUCE_UNITS } from '../models/Produce.model.js';
import { PAYMENT_METHODS } from '../models/shared/tradeRequest.js';
import { KISAN_SALE_STATUSES } from '../models/KisanSaleRequest.model.js';
import { SANCHALAK_SALE_STATUSES } from '../models/SanchalakSaleRequest.model.js';

// Request schemas for the Kisan → Sanchalak → Admin produce flow.
// Quantities are entered in the produce's unit (e.g. 12.5 quintal); prices are ₹ per that unit.

const objectId = Joi.string().trim().hex().length(24);
const quantity = Joi.number().min(0.01).max(100000).precision(2);
const price = Joi.number().min(0).max(10000000).precision(2);
const note = Joi.string().trim().max(500).allow('');

export const idParamSchema = Joi.object({
    id: objectId.required(),
});

export const produceSaleSchema = Joi.object({
    produce: objectId.required().label('Produce'),
    quantity: quantity.required().label('Quantity'),
    pricePerUnit: price.required().label('Price'),
    note: note.optional(),
});

const listQuery = (statuses) => Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().trim().allow('').max(100).optional(),
    status: Joi.string().valid(...statuses).optional(),
});

export const kisanSaleListQuerySchema = listQuery(KISAN_SALE_STATUSES);
export const sanchalakSaleListQuerySchema = listQuery(SANCHALAK_SALE_STATUSES);

export const adminKisanSaleListQuerySchema = kisanSaleListQuerySchema.keys({
    sanchalak: objectId.optional(),
    kisan: objectId.optional(),
    registration: objectId.optional(),
});

export const adminProcurementListQuerySchema = sanchalakSaleListQuerySchema.keys({
    sanchalak: objectId.optional(),
});

// The Sanchalak may correct quantity and price after weighing; both default to the farmer's offer.
export const kisanSaleDecisionSchema = Joi.object({
    decision: Joi.string().valid('purchased', 'not_purchased').required(),
    quantity: quantity.optional(),
    pricePerUnit: price.optional(),
    remark: note.optional(),
}).custom((value, helpers) => {
    if (value.decision === 'not_purchased' && !value.remark) {
        return helpers.message('Please give the farmer a reason for not purchasing.');
    }
    return value;
});

export const procurementDecisionSchema = Joi.object({
    decision: Joi.string().valid('received', 'not_received').required(),
    remark: note.optional(),
}).custom((value, helpers) => {
    if (value.decision === 'not_received' && !value.remark) {
        return helpers.message('Please give the Sanchalak a reason.');
    }
    return value;
});

export const cancelRequestSchema = Joi.object({
    reason: note.optional(),
});

export const paymentUpdateSchema = Joi.object({
    status: Joi.string().valid('paid', 'unpaid').required(),
    method: Joi.string().valid(...PAYMENT_METHODS).when('status', { is: 'paid', then: Joi.required(), otherwise: Joi.forbidden() }),
    reference: Joi.string().trim().max(120).allow('').optional(),
    paidAt: Joi.date().max('now').optional(),
});

export const produceSchema = Joi.object({
    name: Joi.string().trim().min(2).max(60).required(),
    nameHi: Joi.string().trim().max(60).allow('').optional(),
    unit: Joi.string().valid(...Object.keys(PRODUCE_UNITS)).optional(),
    sortOrder: Joi.number().integer().min(0).max(10000).optional(),
});

export const produceStatusSchema = Joi.object({
    isActive: Joi.boolean().required(),
});

export const moveToProductSchema = Joi.object({
    productId: objectId.required().label('Product'),
    quantity: quantity.required().label('Quantity'),
    productUnits: Joi.number().integer().min(1).max(10000000).required().label('Product units'),
    note: note.optional(),
});

export const stockLedgerQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    ownerType: Joi.string().valid('sanchalak', 'admin').optional(),
    sanchalak: objectId.optional(),
    produce: objectId.optional(),
});

export const kisanListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().trim().allow('').max(100).optional(),
    sanchalak: objectId.optional(),
    registration: objectId.optional(),
});

export const kisanStatusSchema = Joi.object({
    status: Joi.string().valid('active', 'suspended').required(),
    reason: note.optional(),
}).custom((value, helpers) => {
    if (value.status === 'suspended' && !value.reason) {
        return helpers.message('A reason is required when suspending.');
    }
    return value;
});
