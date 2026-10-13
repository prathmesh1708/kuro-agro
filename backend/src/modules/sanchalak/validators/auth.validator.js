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

export const registerSchema = Joi.object({
    ...baseRegisterFields,
    phone: Joi.string().pattern(/^[0-9]{10}$/).allow('', null).optional(),
    kendraName: Joi.string().trim().min(2).max(120).required(),
});
