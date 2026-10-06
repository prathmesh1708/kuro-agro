import Joi from 'joi';

export const registerSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().min(6).required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
        'string.pattern.base': 'Please enter a valid 10-digit phone number.',
        'any.required': 'Phone number is required.'
    }),
});

export const loginSchema = Joi.object({
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    email: Joi.string().email().optional(),
    identifier: Joi.string().trim().optional(),
    password: Joi.string().required(),
}).or('phone', 'email', 'identifier').messages({
    'object.missing': 'Please provide a phone number or email address.'
});

export const otpSchema = Joi.object({
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    email: Joi.string().email().optional(),
    otp: Joi.string().length(6).required().messages({
        'string.length': 'OTP must be exactly 6 digits.',
        'any.required': 'OTP is required.'
    }),
}).or('phone', 'email').messages({
    'object.missing': 'Please provide a phone number or email address.'
});

export const resendOtpSchema = Joi.object({
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    email: Joi.string().email().optional(),
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
    email: Joi.string().email().required(),
});

export const verifyResetOtpSchema = Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
});

export const resetPasswordSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
        'any.only': 'Confirm password must match password.',
    }),
});

export const updateProfileSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).allow('').optional(),
});

export const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required(),
});

export const sendOtpPhoneSchema = Joi.object({
    phone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
        'string.pattern.base': 'Please enter a valid 10-digit phone number.',
        'any.required': 'Phone number is required.'
    }),
});

export const sendOtpEmailSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid email address.',
    }),
});

export const verifyOtpPhoneSchema = Joi.object({
    phone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
        'string.pattern.base': 'Please enter a valid 10-digit phone number.',
        'any.required': 'Phone number is required.'
    }),
    otp: Joi.string().length(6).required().messages({
        'string.length': 'OTP must be exactly 6 digits.',
        'any.required': 'OTP is required.'
    }),
});
