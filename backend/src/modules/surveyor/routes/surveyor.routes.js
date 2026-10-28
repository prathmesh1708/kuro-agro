import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import * as farmerController from '../controllers/farmer.controller.js';
import * as seedController from '../controllers/seed.controller.js';
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
import {
    idParamSchema,
    seedDispatchListQuerySchema,
    seedDispatchDecisionSchema,
    seedIssueSchema,
    seedIssueListQuerySchema,
    confirmCollectionSchema,
    cancelSeedRequestSchema,
    seedRemittanceSchema,
    seedRemittanceListQuerySchema,
} from '../../../validators/seedDistribution.validator.js';

const router = Router();
const surveyorAuth = [authenticate, authorize('surveyor'), enforceAccountStatus];

// Auth
router.get('/auth/sanchalak/:code', validate(sanchalakCodeParamSchema, 'params'), authController.lookupSanchalak);
router.post('/auth/register', authLimiter, otpLimiter, validate(registerSchema), authController.register);
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

// Seed from admin
router.get('/seed-dispatches', ...surveyorAuth, validate(seedDispatchListQuerySchema, 'query'), seedController.getSeedDispatches);
router.get('/seed-dispatches/:id', ...surveyorAuth, validate(idParamSchema, 'params'), seedController.getSeedDispatchById);
router.patch('/seed-dispatches/:id/decision', ...surveyorAuth, validate(idParamSchema, 'params'), validate(seedDispatchDecisionSchema), seedController.decideSeedDispatch);
router.get('/seed-stock', ...surveyorAuth, seedController.getSeedStock);

// Seed given to farmers
router.get('/my-kisans', ...surveyorAuth, seedController.getMyKisans);
router.post('/seed-issues', ...surveyorAuth, validate(seedIssueSchema), seedController.createSeedIssue);
router.get('/seed-issues', ...surveyorAuth, validate(seedIssueListQuerySchema, 'query'), seedController.getSeedIssues);
router.get('/seed-issues/:id', ...surveyorAuth, validate(idParamSchema, 'params'), seedController.getSeedIssueById);
router.patch('/seed-issues/:id/cancel', ...surveyorAuth, validate(idParamSchema, 'params'), validate(cancelSeedRequestSchema), seedController.cancelSeedIssue);
router.patch('/seed-issues/:id/confirm-payment', ...surveyorAuth, validate(idParamSchema, 'params'), validate(confirmCollectionSchema), seedController.confirmSeedPayment);

// Money owed to admin
router.get('/seed-account', ...surveyorAuth, seedController.getSeedAccount);
router.post('/seed-remittances', ...surveyorAuth, validate(seedRemittanceSchema), seedController.createSeedRemittance);
router.get('/seed-remittances', ...surveyorAuth, validate(seedRemittanceListQuerySchema, 'query'), seedController.getSeedRemittances);

export default router;
