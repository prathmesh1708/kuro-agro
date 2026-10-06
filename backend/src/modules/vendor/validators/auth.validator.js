import Joi from 'joi';

export const registerSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    email: Joi.string().email().lowercase().required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
        'string.pattern.base': 'Please enter a valid 10-digit phone number.',
        'any.required': 'Phone number is required.'
    }),
    password: Joi.string().min(6).required().messages({
        'string.min': 'Password must be at least 6 characters long.',
        'any.required': 'Password is required.'
    }),
    storeName: Joi.string().trim().min(2).max(100).required(),
    storeDescription: Joi.string().trim().max(500).allow('').optional(),
    address: Joi.object({
        street: Joi.string().allow('').optional(),
        city: Joi.string().allow('').optional(),
        state: Joi.string().allow('').optional(),
        zipCode: Joi.string().allow('').optional(),
        country: Joi.string().allow('').optional(),
    }).optional(),
    businessAddress: Joi.object({
        street: Joi.string().allow('').optional(),
        city: Joi.string().allow('').optional(),
        state: Joi.string().allow('').optional(),
        zipCode: Joi.string().allow('').optional(),
        country: Joi.string().allow('').optional(),
    }).optional(),
    businessType: Joi.string().valid('gst', 'non-gst').default('non-gst').optional(),
    legalBusinessName: Joi.string().trim().allow('').optional(),
    gstin: Joi.string().trim().allow('').optional(),
    panNumber: Joi.string().trim().allow('').optional(),
    categories: Joi.array().items(Joi.string()).min(1).required(),
    fssaiLicenseNumber: Joi.string().trim().allow('').optional(),
});

export const loginSchema = Joi.object({
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    email: Joi.string().email().optional(),
    identifier: Joi.string().trim().optional(),
    password: Joi.string().optional(),
    otp: Joi.string().trim().pattern(/^\d{6}$/).optional(),
}).or('phone', 'email', 'identifier').or('password', 'otp').messages({
    'object.missing': 'Please provide phone/email and password/OTP.'
});

export const sendLoginOtpSchema = Joi.object({
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    email: Joi.string().email().lowercase().optional(),
}).or('phone', 'email').messages({
    'object.missing': 'Please provide a phone number or email address.'
});

export const verifyOtpSchema = Joi.object({
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    email: Joi.string().email().lowercase().optional(),
    otp: Joi.string().trim().pattern(/^\d{6}$/).required().messages({
        'string.pattern.base': 'OTP must be exactly 6 digits.',
        'any.required': 'OTP is required.'
    }),
}).or('phone', 'email').messages({
    'object.missing': 'Please provide a phone number or email address.'
});

export const resendOtpSchema = Joi.object({
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    email: Joi.string().email().lowercase().optional(),
}).or('phone', 'email').messages({
    'object.missing': 'Please provide a phone number or email address.'
});

export const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required(),
});

export const logoutSchema = Joi.object({
    refreshToken: Joi.string().allow('').optional(),
});

export const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().lowercase().required(),
});

export const verifyResetOtpSchema = Joi.object({
    email: Joi.string().email().lowercase().required(),
    otp: Joi.string().pattern(/^\d{6}$/).required(),
});

export const resetPasswordSchema = Joi.object({
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
        'any.only': 'Confirm password must match password.',
    }),
});
