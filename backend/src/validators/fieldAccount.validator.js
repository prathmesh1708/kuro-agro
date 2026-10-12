import Joi from 'joi';

// Shared request schemas for field-network accounts (Sanchalak, Surveyor).

const phone = Joi.string().pattern(/^[0-9]{10}$/).messages({
    'string.pattern.base': 'Please enter a valid 10-digit phone number.',
});

export const addressSchema = Joi.object({
    village: Joi.string().trim().max(100).required(),
    gramPanchayat: Joi.string().trim().max(100).allow('').optional(),
    block: Joi.string().trim().max(100).required(),
    district: Joi.string().trim().max(100).required(),
    state: Joi.string().trim().max(100).required(),
    pincode: Joi.string().pattern(/^[0-9]{6}$/).required().messages({
        'string.pattern.base': 'Please enter a valid 6-digit pincode.',
    }),
});

export const baseRegisterFields = {
    name: Joi.string().trim().min(2).max(80).required(),
    email: Joi.string().trim().email().lowercase().required(),
    phone: phone.required(),
    password: Joi.string().min(6).max(128).required(),
    address: addressSchema.required(),
};

export const loginSchema = Joi.object({
    identifier: Joi.string().trim().max(120).required().messages({
        'any.required': 'Please enter your login ID, email or phone number.',
        'string.empty': 'Please enter your login ID, email or phone number.',
    }),
    password: Joi.string().required(),
});

export const otpSchema = Joi.object({
    phone: phone.required(),
    otp: Joi.string().pattern(/^\d{6}$/).required().messages({
        'string.pattern.base': 'OTP must be exactly 6 digits.',
    }),
});

export const resendOtpSchema = Joi.object({
    phone: phone.required(),
});

export const forgotPasswordSchema = Joi.object({
    email: Joi.string().trim().email().lowercase().required(),
});

export const verifyResetOtpSchema = Joi.object({
    email: Joi.string().trim().email().lowercase().required(),
    otp: Joi.string().pattern(/^\d{6}$/).required(),
});

export const resetPasswordSchema = Joi.object({
    email: Joi.string().trim().email().lowercase().required(),
    password: Joi.string().min(6).max(128).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
        'any.only': 'Confirm password must match password.',
    }),
});

export const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required(),
});

export const logoutSchema = Joi.object({
    refreshToken: Joi.string().allow('').optional(),
});
