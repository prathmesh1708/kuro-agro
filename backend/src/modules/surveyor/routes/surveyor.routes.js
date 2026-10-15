import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import * as farmerController from '../controllers/farmer.controller.js';
import { authenticate } from '../../../middlewares/authenticate.js';
import { authorize, enforceAccountStatus } from '../../../middlewares/authorize.js';
import { authLimiter, otpLimiter } from '../../../middlewares/rateLimiter.js';
import { validate } from '../../../middlewares/validate.js';
import {
    registerSchema,
    sanchalakCodeParamSchema,
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
    farmerRegistrationSchema,
    registrationIdParamSchema,
    registrationListQuerySchema,
} from '../../../validators/farmerRegistration.validator.js';

const router = Router();
const surveyorAuth = [authenticate, authorize('surveyor'), enforceAccountStatus];

// Auth
router.get('/auth/sanchalak/:code', validate(sanchalakCodeParamSchema, 'params'), authController.lookupSanchalak);
router.post('/auth/register', authLimiter, validate(registerSchema), authController.register);
router.post('/auth/verify-otp', authLimiter, validate(otpSchema), authController.verifyOTP);
router.post('/auth/resend-otp', otpLimiter, validate(resendOtpSchema), authController.resendOTP);
router.post('/auth/login', authLimiter, validate(loginSchema), authController.login);
router.post('/auth/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/auth/verify-reset-otp', authLimiter, validate(verifyResetOtpSchema), authController.verifyResetOTP);
router.post('/auth/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/auth/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/auth/logout', validate(logoutSchema), authController.logout);
router.get('/auth/profile', ...surveyorAuth, authController.getProfile);

// Dashboard
router.get('/dashboard', ...surveyorAuth, farmerController.getDashboard);
router.get('/commission', ...surveyorAuth, farmerController.getCommission);

// Farmer registrations
router.get('/produce', ...surveyorAuth, farmerController.getProduceList);
router.post('/farmers', ...surveyorAuth, validate(farmerRegistrationSchema), farmerController.createFarmer);
router.get('/farmers', ...surveyorAuth, validate(registrationListQuerySchema, 'query'), farmerController.getFarmers);
router.get('/farmers/:id', ...surveyorAuth, validate(registrationIdParamSchema, 'params'), farmerController.getFarmerById);
router.put('/farmers/:id', ...surveyorAuth, validate(registrationIdParamSchema, 'params'), validate(farmerRegistrationSchema), farmerController.resubmitFarmer);

export default router;
