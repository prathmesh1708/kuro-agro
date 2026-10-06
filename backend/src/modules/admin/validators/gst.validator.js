import Joi from 'joi';

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

export const createGstRuleSchema = Joi.object({
    name: Joi.string().trim().min(3).max(100).required(),
    rate: Joi.number().min(0).max(100).required(),
    hsnCode: Joi.string().trim().allow('').optional(),
    type: Joi.string().valid('global', 'category', 'product').required(),
    categoryId: objectId.allow(null, '').optional(),
    productId: objectId.allow(null, '').optional(),
    description: Joi.string().trim().allow('').optional(),
    reason: Joi.string().trim().allow('').optional()
});

export const updateGstRuleSchema = Joi.object({
    name: Joi.string().trim().min(3).max(100).optional(),
    rate: Joi.number().min(0).max(100).optional(),
    hsnCode: Joi.string().trim().allow('').optional(),
    description: Joi.string().trim().allow('').optional(),
    categoryId: objectId.allow(null, '').optional(),
    productId: objectId.allow(null, '').optional(),
    isActive: Joi.boolean().optional(),
    reason: Joi.string().trim().allow('').optional()
});

export const toggleGstRuleSchema = Joi.object({
    reason: Joi.string().trim().allow('').optional()
});
