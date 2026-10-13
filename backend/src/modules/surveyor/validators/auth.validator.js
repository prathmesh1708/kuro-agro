import Joi from 'joi';
import { baseRegisterFields } from '../../../validators/fieldAccount.validator.js';

export {
    loginSchema,
    otpSchema,
    resendOtpSchema,
    forgotPasswordSchema,
    verifyResetOtpSchema,
    resetPasswordSchema,
    refreshTokenSchema,
    logoutSchema,
} from '../../../validators/fieldAccount.validator.js';

const sanchalakCode = Joi.string().trim().uppercase().pattern(/^SAN-\d{6}$/).messages({
    'string.pattern.base': 'Sanchalak code must look like SAN-123456.',
});

export const registerSchema = Joi.object({
    ...baseRegisterFields,
    phone: Joi.string().pattern(/^[0-9]{10}$/).allow('', null).optional(),
    sanchalakCode: sanchalakCode.required(),
});

export const sanchalakCodeParamSchema = Joi.object({
    code: sanchalakCode.required(),
});
