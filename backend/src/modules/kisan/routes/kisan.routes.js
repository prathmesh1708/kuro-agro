import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import * as saleController from '../controllers/sale.controller.js';
import { authenticate } from '../../../middlewares/authenticate.js';
import { authorize, enforceAccountStatus } from '../../../middlewares/authorize.js';
import { authLimiter, otpLimiter } from '../../../middlewares/rateLimiter.js';
import { validate } from '../../../middlewares/validate.js';
import { otpSchema, resendOtpSchema, refreshTokenSchema, logoutSchema } from '../../../validators/fieldAccount.validator.js';
import {
    idParamSchema,
    produceSaleSchema,
    kisanSaleListQuerySchema,
    cancelRequestSchema,
} from '../../../validators/produceTrade.validator.js';

const router = Router();
const kisanAuth = [authenticate, authorize('kisan'), enforceAccountStatus];

// Auth (mobile + OTP)
router.post('/auth/login/send-otp', otpLimiter, validate(resendOtpSchema), authController.sendLoginOtp);
router.post('/auth/login/verify-otp', authLimiter, validate(otpSchema), authController.verifyLoginOtp);
router.post('/auth/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/auth/logout', validate(logoutSchema), authController.logout);
router.get('/auth/profile', ...kisanAuth, authController.getProfile);

// Dashboard and produce list
router.get('/dashboard', ...kisanAuth, saleController.getDashboard);
router.get('/produce', ...kisanAuth, saleController.getProduceList);

// Sale requests to the Kendra
router.post('/sale-requests', ...kisanAuth, validate(produceSaleSchema), saleController.createSaleRequest);
router.get('/sale-requests', ...kisanAuth, validate(kisanSaleListQuerySchema, 'query'), saleController.getSaleRequests);
router.get('/sale-requests/:id', ...kisanAuth, validate(idParamSchema, 'params'), saleController.getSaleRequestById);
router.patch('/sale-requests/:id/cancel', ...kisanAuth, validate(idParamSchema, 'params'), validate(cancelRequestSchema), saleController.cancelSaleRequest);

export default router;
