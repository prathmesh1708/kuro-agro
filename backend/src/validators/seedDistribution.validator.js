import Joi from 'joi';
import { SEED_UNITS } from '../models/SeedItem.model.js';
import { PAYMENT_METHODS } from '../models/shared/tradeRequest.js';
import { SEED_DISPATCH_STATUSES } from '../models/SeedDispatch.model.js';
import { SEED_ISSUE_STATUSES } from '../models/SeedIssue.model.js';
import { SEED_REMITTANCE_STATUSES } from '../models/SeedRemittance.model.js';

// Request schemas for the Admin → Surveyor → Kisan seed flow.
// Quantities are in the seed item's own unit (kg, kit, plant…); prices are ₹ per that unit.

const objectId = Joi.string().trim().hex().length(24);
const quantity = Joi.number().min(0.01).max(1000000).precision(2);
const price = Joi.number().min(0).max(10000000).precision(2);
const note = Joi.string().trim().max(500).allow('');

export const idParamSchema = Joi.object({ id: objectId.required() });

const listQuery = (statuses) => Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().trim().allow('').max(100).optional(),
    status: Joi.string().valid(...statuses).optional(),
});

// ─── Seed catalog (admin) ─────────────────────────────────────────────────────

export const seedItemSchema = Joi.object({
    name: Joi.string().trim().min(2).max(80).required().label('Name'),
    nameHi: Joi.string().trim().max(80).allow('').optional(),
    unit: Joi.string().valid(...SEED_UNITS).optional(),
    produce: objectId.allow('', null).optional().label('Linked crop'),
    defaultPricePerUnit: price.optional(),
    commission: Joi.object({
        perUnit: price.required().label('Commission'),
        min: price.optional(),
        max: price.optional(),
    })
        .optional()
        .custom((value, helpers) => {
            const { perUnit, min = 0, max = 0 } = value;
            if (max && min > max) return helpers.message('Commission minimum cannot be above the maximum.');
            if (max && (perUnit < min || perUnit > max)) {
                return helpers.message('The commission rate must sit between the minimum and maximum.');
            }
            return value;
        }),
    sortOrder: Joi.number().integer().min(0).max(10000).optional(),
});

export const seedItemStatusSchema = Joi.object({ isActive: Joi.boolean().required() });

// ─── Admin → Surveyor dispatch ────────────────────────────────────────────────

export const seedDispatchSchema = Joi.object({
    surveyor: objectId.required().label('Surveyor'),
    seedItem: objectId.required().label('Seed'),
    quantity: quantity.required().label('Quantity'),
    pricePerUnit: price.required().label('Price'),
    commissionPerUnit: price.optional().label('Commission'),
    note: note.optional(),
});

export const seedDispatchListQuerySchema = listQuery(SEED_DISPATCH_STATUSES).keys({
    surveyor: objectId.optional(),
    sanchalak: objectId.optional(),
});

export const seedDispatchDecisionSchema = Joi.object({
    decision: Joi.string().valid('received', 'not_received').required(),
    remark: note.optional(),
}).custom((value, helpers) => {
    if (value.decision === 'not_received' && !value.remark) {
        return helpers.message('Please tell admin why the seed was not received.');
    }
    return value;
});

// ─── Surveyor → Kisan issue ───────────────────────────────────────────────────

export const seedIssueSchema = Joi.object({
    kisan: objectId.required().label('Farmer'),
    seedItem: objectId.required().label('Seed'),
    quantity: quantity.required().label('Quantity'),
    pricePerUnit: price.required().label('Price'),
    note: note.optional(),
});

export const seedIssueListQuerySchema = listQuery(SEED_ISSUE_STATUSES).keys({
    surveyor: objectId.optional(),
    kisan: objectId.optional(),
    sanchalak: objectId.optional(),
});

export const seedIssueDecisionSchema = Joi.object({
    decision: Joi.string().valid('received', 'not_received').required(),
    remark: note.optional(),
}).custom((value, helpers) => {
    if (value.decision === 'not_received' && !value.remark) {
        return helpers.message('Please tell the surveyor why you did not receive the seed.');
    }
    return value;
});

// The farmer reports what they paid the surveyor. The amount is the full issue total;
// only the method and reference are theirs to enter.
export const seedPaymentSchema = Joi.object({
    status: Joi.string().valid('paid', 'unpaid').required(),
    method: Joi.string().valid(...PAYMENT_METHODS).when('status', { is: 'paid', then: Joi.required(), otherwise: Joi.forbidden() }),
    reference: Joi.string().trim().max(120).allow('').optional(),
    paidAt: Joi.date().max('now').optional(),
});

export const confirmCollectionSchema = Joi.object({
    confirmed: Joi.boolean().required(),
    remark: note.optional(),
});

export const cancelSeedRequestSchema = Joi.object({ reason: note.optional() });

// ─── Surveyor → Admin remittance ──────────────────────────────────────────────

export const seedRemittanceSchema = Joi.object({
    amount: Joi.number().min(1).max(100000000).precision(2).required().label('Amount'),
    method: Joi.string().valid(...PAYMENT_METHODS).required().label('Method'),
    reference: Joi.string().trim().max(120).allow('').optional(),
    paidAt: Joi.date().max('now').optional(),
    note: note.optional(),
});

export const seedRemittanceListQuerySchema = listQuery(SEED_REMITTANCE_STATUSES).keys({
    surveyor: objectId.optional(),
    sanchalak: objectId.optional(),
});

export const seedRemittanceDecisionSchema = Joi.object({
    decision: Joi.string().valid('received', 'not_received').required(),
    remark: note.optional(),
}).custom((value, helpers) => {
    if (value.decision === 'not_received' && !value.remark) {
        return helpers.message('Please give the surveyor a reason.');
    }
    return value;
});

export const seedLedgerQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    ownerType: Joi.string().valid('admin', 'surveyor').optional(),
    surveyor: objectId.optional(),
    seedItem: objectId.optional(),
});
