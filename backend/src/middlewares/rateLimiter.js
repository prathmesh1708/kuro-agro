import rateLimit from 'express-rate-limit';

// Limits are per IP per 15 minutes and can be tuned with env vars.
// The storefront issues ~10-15 API calls per page, so the API limit must be generous.
const envInt = (name, fallback) => {
    const n = parseInt(process.env[name], 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};
const isProd = process.env.NODE_ENV === 'production';

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: envInt('API_RATE_LIMIT_MAX', isProd ? 1500 : 2000),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
});

// Strict limiter for auth endpoints
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: envInt('AUTH_RATE_LIMIT_MAX', isProd ? 20 : 100),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' },
});

// OTP send limiter (per IP, shared by every OTP-sending route). Only requests that actually
// sent an OTP count: a rejected attempt (unknown number, validation error) sends no SMS and
// must not lock the user out. authLimiter still caps total attempts.
export const otpLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: envInt('OTP_RATE_LIMIT_MAX', isProd ? 3 : 10),
    skipFailedRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many OTP requests, please wait a minute.' },
});
