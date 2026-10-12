import Joi from 'joi';

const objectId = Joi.string().trim().hex().length(24);

export const fieldAccountIdParamSchema = Joi.object({
    id: objectId.required(),
});

export const sanchalakListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(200).optional(),
    search: Joi.string().trim().allow('').optional(),
    status: Joi.string().valid('pending', 'approved', 'rejected', 'suspended').optional(),
});

export const surveyorListQuerySchema = sanchalakListQuerySchema.keys({
    sanchalak: objectId.optional(),
});

export const fieldAccountStatusSchema = Joi.object({
    status: Joi.string().valid('approved', 'rejected', 'suspended').required(),
    reason: Joi.string().trim().max(500).allow('').optional(),
}).custom((value, helpers) => {
    if (['rejected', 'suspended'].includes(value.status) && !value.reason) {
        return helpers.message('A reason is required when rejecting or suspending.');
    }
    return value;
});

export const commissionRatesSchema = Joi.object({
    surveyorPerFarmer: Joi.number().min(0).max(100000).precision(2).required(),
    sanchalakPerFarmer: Joi.number().min(0).max(100000).precision(2).required(),
});
