import Joi from 'joi';
import { LAND_TYPES, IRRIGATION_TYPES, FARMING_METHODS, REGISTRATION_STATUSES } from '../models/FarmerRegistration.model.js';

const objectId = Joi.string().trim().hex().length(24);
const indianMobile = Joi.string().trim().pattern(/^[6-9]\d{9}$/).messages({
    'string.pattern.base': '{#label} must be a valid 10-digit mobile number starting with 6-9.',
});
const text = (max = 100) => Joi.string().trim().min(2).max(max);

export const farmerRegistrationSchema = Joi.object({
    aadhaar: Joi.string().trim().pattern(/^\d{12}$/).required().label('Aadhaar number').messages({
        'string.pattern.base': 'Aadhaar number must be exactly 12 digits.',
    }),
    name: text(80).required().label('Name'),
    fatherName: text(80).required().label('Father name'),
    village: text().required().label('Village'),
    panchayat: text().required().label('Panchayat'),
    block: text().required().label('Block'),
    district: text().required().label('District'),
    mobile: indianMobile.required().label('Mobile'),
    altMobile: indianMobile.required().label('Alternate mobile').invalid(Joi.ref('mobile')).messages({
        'any.invalid': 'Alternate mobile must be different from mobile.',
    }),
    email: Joi.string().trim().email().lowercase().required().label('Email'),
    landTotalAcres: Joi.number().min(0.01).max(100000).precision(2).required().label('Total land'),
    landProposedAcres: Joi.number().min(0.01).max(Joi.ref('landTotalAcres')).precision(2).required().label('Proposed land').messages({
        'number.max': 'Proposed land cannot be more than total land.',
    }),
    landType: Joi.string().valid(...LAND_TYPES).required().label('Land type'),
    irrigation: Joi.string().valid(...IRRIGATION_TYPES).required().label('Irrigation'),
    farmingMethod: Joi.string().valid(...FARMING_METHODS).required().label('Farming method'),
    agreementAccepted: Joi.boolean().valid(true).required().messages({
        'any.only': 'The farmer must accept the agreement.',
        'any.required': 'The farmer must accept the agreement.',
    }),
});

export const registrationIdParamSchema = Joi.object({
    id: objectId.required(),
});

export const registrationListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().trim().allow('').max(100).optional(),
    status: Joi.string().valid(...REGISTRATION_STATUSES).optional(),
});

// A Sanchalak may filter by surveyor; ownership is enforced by always scoping the query to their own sanchalak id.
export const sanchalakRegistrationListQuerySchema = registrationListQuerySchema.keys({
    surveyor: objectId.optional(),
});

export const adminRegistrationListQuerySchema = registrationListQuerySchema.keys({
    surveyor: objectId.optional(),
    sanchalak: objectId.optional(),
});

export const registrationReviewSchema = Joi.object({
    status: Joi.string().valid('approved', 'rejected').required(),
    remark: Joi.string().trim().max(500).allow('').optional(),
}).custom((value, helpers) => {
    if (value.status === 'rejected' && !value.remark) {
        return helpers.message('A remark is required when rejecting.');
    }
    return value;
});
