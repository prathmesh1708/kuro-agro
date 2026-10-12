import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import * as farmerController from '../controllers/farmer.controller.js';
import { authenticate } from '../../../middlewares/authenticate.js';
import { authorize, enforceAccountStatus } from '../../../middlewares/authorize.js';
import { authLimiter, otpLimiter } from '../../../middlewares/rateLimiter.js';
import { validate } from '../../../middlewares/validate.js';
import {
    registerSchema,
    loginSchema,
    otpSchema,
    resendOtpSchema,
    forgotPasswordSchema,
    verifyResetOtpSchema,
    resetPasswordSchema,
    refreshTokenSchema,
    logoutSchema,
} from '../validators/auth.validator.js';
import {
    registrationIdParamSchema,
    sanchalakRegistrationListQuerySchema,
} from '../../../validators/farmerRegistration.validator.js';

const router = Router();
const sanchalakAuth = [authenticate, authorize('sanchalak'), enforceAccountStatus];

// Auth
router.post('/auth/register', authLimiter, validate(registerSchema), authController.register);
router.post('/auth/verify-otp', authLimiter, validate(otpSchema), authController.verifyOTP);
router.post('/auth/resend-otp', otpLimiter, validate(resendOtpSchema), authController.resendOTP);
router.post('/auth/login', authLimiter, validate(loginSchema), authController.login);
router.post('/auth/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/auth/verify-reset-otp', authLimiter, validate(verifyResetOtpSchema), authController.verifyResetOTP);
router.post('/auth/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/auth/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/auth/logout', validate(logoutSchema), authController.logout);
router.get('/auth/profile', ...sanchalakAuth, authController.getProfile);

// Dashboard
router.get('/dashboard', ...sanchalakAuth, farmerController.getDashboard);
router.get('/commission', ...sanchalakAuth, farmerController.getCommission);

// Surveyors and the farmers they registered (read-only)
router.get('/surveyors', ...sanchalakAuth, farmerController.getSurveyors);
router.get('/surveyors/:id', ...sanchalakAuth, validate(registrationIdParamSchema, 'params'), farmerController.getSurveyorById);
router.get('/farmers', ...sanchalakAuth, validate(sanchalakRegistrationListQuerySchema, 'query'), farmerController.getFarmers);
router.get('/farmers/:id', ...sanchalakAuth, validate(registrationIdParamSchema, 'params'), farmerController.getFarmerById);

export default router;
