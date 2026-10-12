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
    kendraName: Joi.string().trim().min(2).max(120).required(),
});
