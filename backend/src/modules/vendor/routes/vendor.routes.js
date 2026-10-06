import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import * as productController from '../controllers/product.controller.js';
import * as orderController from '../controllers/order.controller.js';
import * as customerController from '../controllers/customer.controller.js';
import * as inventoryController from '../controllers/inventory.controller.js';
import * as performanceController from '../controllers/performance.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as chatController from '../controllers/chat.controller.js';
import * as documentController from '../controllers/document.controller.js';
import * as notificationController from '../controllers/notification.controller.js';
import * as returnController from '../controllers/return.controller.js';
import * as reviewController from '../controllers/review.controller.js';
import * as shippingController from '../controllers/shipping.controller.js';
import * as vendorShipmentController from '../controllers/vendorShipment.controller.js';
import * as uploadController from '../controllers/upload.controller.js';
import * as gstController from '../../admin/controllers/gst.controller.js';
import * as brandController from '../controllers/brand.controller.js';
import * as payoutController from '../controllers/payout.controller.js';
import * as gstSettingsController from '../controllers/gstSettings.controller.js';
import * as bulkUploadController from '../controllers/bulkUpload.controller.js';
import * as pickupLocationController from '../controllers/pickupLocation.controller.js';
import multer from 'multer';
import { emitToVendor } from '../../../services/socket.service.js';

import { authenticate } from '../../../middlewares/authenticate.js';
import { authorize, enforceAccountStatus } from '../../../middlewares/authorize.js';
import { authLimiter } from '../../../middlewares/rateLimiter.js';
import { validate } from '../../../middlewares/validate.js';
import {
    registerSchema,
    loginSchema,
    sendLoginOtpSchema,
    verifyOtpSchema,
    resendOtpSchema,
    refreshTokenSchema,
    logoutSchema,
    forgotPasswordSchema,
    verifyResetOtpSchema,
    resetPasswordSchema
} from '../validators/auth.validator.js';
import {
    createProductSchema,
    updateProductSchema,
    productIdParamSchema,
} from '../validators/product.validator.js';
import { uploadSingle, uploadMultiple, uploadDocumentSingle, uploadVendorRegistrationDocuments } from '../../../middlewares/upload.js';

const router = Router();
const vendorAuth = [authenticate, authorize('vendor'), enforceAccountStatus];

const parseRegisterFormData = (req, res, next) => {
    if (req.body.address && typeof req.body.address === 'string') {
        try {
            req.body.address = JSON.parse(req.body.address);
        } catch (_) {}
    }
    if (req.body.businessAddress && typeof req.body.businessAddress === 'string') {
        try {
            req.body.businessAddress = JSON.parse(req.body.businessAddress);
        } catch (_) {}
    }
    if (req.body.categories && typeof req.body.categories === 'string') {
        try {
            req.body.categories = JSON.parse(req.body.categories);
        } catch (_) {}
    }
    next();
};

// Auth
router.post('/auth/register', authLimiter, uploadVendorRegistrationDocuments(), parseRegisterFormData, validate(registerSchema), authController.register);
router.post('/auth/verify-otp', validate(verifyOtpSchema), authController.verifyOTP);
router.post('/auth/resend-otp', validate(resendOtpSchema), authController.resendOTP);
router.post('/auth/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/auth/verify-reset-otp', authLimiter, validate(verifyResetOtpSchema), authController.verifyResetOTP);
router.post('/auth/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/auth/send-login-otp', authLimiter, validate(sendLoginOtpSchema), authController.sendLoginOTP);
router.post('/auth/login', authLimiter, validate(loginSchema), authController.login);
router.post('/auth/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/auth/logout', validate(logoutSchema), authController.logout);
router.get('/auth/profile', ...vendorAuth, authController.getProfile);
router.put('/auth/profile', ...vendorAuth, authController.updateProfile);
router.put('/auth/bank-details', ...vendorAuth, payoutController.updateVendorBankDetails);
router.get('/auth/bank-details', ...vendorAuth, payoutController.getVendorBankDetails);
router.get('/payouts/summary', ...vendorAuth, payoutController.getPayoutSummary);
router.get('/payouts/settlements', ...vendorAuth, payoutController.getVendorSettlements);
router.get('/payouts/bank-details', ...vendorAuth, payoutController.getVendorBankDetails);
router.put('/payouts/bank-details', ...vendorAuth, payoutController.updateVendorBankDetails);

// GST Settings
router.get('/gst-settings', ...vendorAuth, gstSettingsController.getGstSettings);
router.post('/gst-settings', ...vendorAuth, gstSettingsController.updateGstSettings);
router.get('/gst-settings/category/:categoryId', ...vendorAuth, gstSettingsController.getCategoryDefaultGst);

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
});

// Products
router.get('/products', ...vendorAuth, productController.getVendorProducts);
router.get('/products/bulk/template', ...vendorAuth, bulkUploadController.downloadTemplate);
router.post('/products/bulk/validate', ...vendorAuth, memoryUpload.single('file'), bulkUploadController.validateBulkProducts);
router.post('/products/bulk/import', ...vendorAuth, bulkUploadController.importBulkProducts);
router.post('/products/bulk/error-report', ...vendorAuth, bulkUploadController.downloadErrorReport);
router.delete('/products/bulk-delete-all', ...vendorAuth, productController.deleteAllProducts);
router.get('/products/:id', ...vendorAuth, validate(productIdParamSchema, 'params'), productController.getVendorProductById);
router.post('/products', ...vendorAuth, validate(createProductSchema), productController.createProduct);
router.put('/products/:id', ...vendorAuth, validate(productIdParamSchema, 'params'), validate(updateProductSchema), productController.updateProduct);
router.post('/products/:id/resubmit', ...vendorAuth, validate(productIdParamSchema, 'params'), productController.resubmitProduct);
router.delete('/products/:id', ...vendorAuth, validate(productIdParamSchema, 'params'), productController.deleteProduct);
router.patch('/stock/:productId', ...vendorAuth, productController.updateStock);
// Brands
router.post('/brands', ...vendorAuth, brandController.createVendorBrand);

// Orders
router.get('/orders', ...vendorAuth, orderController.getVendorOrders);
router.get('/orders/:id', ...vendorAuth, orderController.getVendorOrderById);
router.patch('/orders/:id/status', ...vendorAuth, orderController.updateOrderStatus);
router.post('/orders/:id/shipment', ...vendorAuth, vendorShipmentController.createVendorShipment);
router.post('/orders/:id/shipment/pickup', ...vendorAuth, vendorShipmentController.scheduleVendorPickup);
router.get('/orders/:id/shipment', ...vendorAuth, vendorShipmentController.getVendorShipment);
router.get('/orders/:id/shipment/tracking', ...vendorAuth, vendorShipmentController.getVendorShipmentTracking);
router.get('/orders/:id/shipment/label', ...vendorAuth, vendorShipmentController.getVendorShipmentLabel);
router.get('/orders/:id/shipment/manifest', ...vendorAuth, vendorShipmentController.getVendorShipmentManifest);
router.get('/orders/:id/shipment/invoice', ...vendorAuth, vendorShipmentController.getVendorShipmentInvoice);
router.post('/orders/:id/shipment/cancel', ...vendorAuth, vendorShipmentController.cancelVendorShipment);

// Customers
router.get('/customers', ...vendorAuth, customerController.getVendorCustomers);
router.get('/customers/:id', ...vendorAuth, customerController.getVendorCustomerById);

// Chat
router.get('/chat/threads', ...vendorAuth, chatController.getVendorChatThreads);
router.get('/chat/threads/:id/messages', ...vendorAuth, chatController.getVendorChatMessages);
router.post('/chat/threads/:id/messages', ...vendorAuth, chatController.sendVendorChatMessage);
router.patch('/chat/threads/:id/read', ...vendorAuth, chatController.markVendorChatRead);
router.patch('/chat/threads/:id/status', ...vendorAuth, chatController.updateVendorChatStatus);

// Documents
router.get('/documents', ...vendorAuth, documentController.getVendorDocuments);
router.post('/documents', ...vendorAuth, uploadDocumentSingle('file'), documentController.createVendorDocument);
router.delete('/documents/:id', ...vendorAuth, documentController.deleteVendorDocument);

// Notifications
router.get('/notifications', ...vendorAuth, notificationController.getVendorNotifications);
router.put('/notifications/:id/read', ...vendorAuth, notificationController.markVendorNotificationAsRead);
router.put('/notifications/read-all', ...vendorAuth, notificationController.markAllVendorNotificationsAsRead);
router.delete('/notifications/:id', ...vendorAuth, notificationController.deleteVendorNotification);

// Inventory reports
router.get('/inventory/reports', ...vendorAuth, inventoryController.getInventoryReport);

// Performance metrics
router.get('/performance/metrics', ...vendorAuth, performanceController.getPerformanceMetrics);

// Analytics
router.get('/analytics/overview', ...vendorAuth, analyticsController.getAnalyticsOverview);

// Earnings
router.get('/earnings', ...vendorAuth, orderController.getEarnings);

// Return requests
router.get('/return-requests', ...vendorAuth, returnController.getVendorReturnRequests);
router.get('/return-requests/:id', ...vendorAuth, returnController.getVendorReturnRequestById);
router.patch('/return-requests/:id/status', ...vendorAuth, returnController.updateVendorReturnRequestStatus);

// Product reviews
router.get('/reviews', ...vendorAuth, reviewController.getVendorReviews);
router.patch('/reviews/:id/status', ...vendorAuth, reviewController.updateVendorReviewStatus);
router.patch('/reviews/:id/response', ...vendorAuth, reviewController.addVendorReviewResponse);



// Shipping management
router.get('/shipping/zones', ...vendorAuth, shippingController.getShippingZones);
router.post('/shipping/zones', ...vendorAuth, shippingController.createShippingZone);
router.put('/shipping/zones/:id', ...vendorAuth, shippingController.updateShippingZone);
router.delete('/shipping/zones/:id', ...vendorAuth, shippingController.deleteShippingZone);
router.get('/shipping/rates', ...vendorAuth, shippingController.getShippingRates);
router.post('/shipping/rates', ...vendorAuth, shippingController.createShippingRate);
router.put('/shipping/rates/:id', ...vendorAuth, shippingController.updateShippingRate);
router.delete('/shipping/rates/:id', ...vendorAuth, shippingController.deleteShippingRate);

// Pickup Locations management (Warehouse / Store Addresses synced with Shiprocket)
router.get('/pickup-locations', ...vendorAuth, pickupLocationController.getVendorPickupLocations);
router.post('/pickup-locations', ...vendorAuth, pickupLocationController.createVendorPickupLocation);
router.put('/pickup-locations/:id', ...vendorAuth, pickupLocationController.updateVendorPickupLocation);
router.delete('/pickup-locations/:id', ...vendorAuth, pickupLocationController.deleteVendorPickupLocation);
router.patch('/pickup-locations/:id/default', ...vendorAuth, pickupLocationController.setDefaultPickupLocation);

// Uploads (Cloudinary via temp local multer upload)
router.post('/uploads/image', ...vendorAuth, uploadSingle('image'), uploadController.uploadImage);
router.post('/uploads/images', ...vendorAuth, uploadMultiple('images', 8), uploadController.uploadImages);

// Test/Debug endpoint to simulate real-time incoming order popup
router.post('/test-order-popup', ...vendorAuth, (req, res) => {
    const orderId = `ORD-TEST-${Math.floor(100000 + Math.random() * 900000)}`;
    const testPayload = {
        orderId,
        _id: `test_${Date.now()}`,
        createdAt: new Date().toISOString(),
        items: [
            {
                productId: 'test_product_1',
                name: 'Premium Cotton Polo T-Shirt',
                image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=200',
                price: 799,
                quantity: 2,
                variantKey: 'Size=L | Color=Navy Blue',
            },
            {
                productId: 'test_product_2',
                name: 'Classic Slim Fit Denim Jeans',
                image: 'https://images.unsplash.com/photo-1542272604-780c96856592?w=200',
                price: 1499,
                quantity: 1,
                variantKey: 'Size=32 | Color=Indigo',
            },
        ],
        subtotal: 3097,
        shipping: 50,
        tax: 154,
        discount: 0,
        total: 3301,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        status: 'pending',
        shippingAddress: {
            name: 'Ananya Sharma',
            city: 'Jaipur',
            state: 'Rajasthan',
            address: '42 Malviya Nagar',
            zipCode: '302017',
            country: 'India',
        },
        customerName: 'Ananya Sharma',
    };

    const emitted = emitToVendor(String(req.user.id), 'new-order', testPayload);
    res.status(200).json({ success: true, message: 'Test order notification emitted to your vendor room', orderId, emitted });
});

export default router;

