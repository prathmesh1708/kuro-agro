import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Order from '../../../models/Order.model.js';
import { verifyRazorpaySignature, verifyWebhookSignature } from '../../../services/razorpay.service.js';
import { sendOrderStatusEmail } from '../../../services/orderEmailNotification.service.js';

/**
 * Verify Razorpay payment signature after successful checkout popup
 * POST /api/user/payment/razorpay/verify
 */
export const verifyPayment = asyncHandler(async (req, res) => {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new ApiError(400, 'Missing required Razorpay payment verification parameter.');
    }

    const isValid = verifyRazorpaySignature({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
    });

    if (!isValid) {
        throw new ApiError(400, 'Payment signature verification failed. Invalid transaction signature.');
    }

    // Find target order by orderId or razorpayOrderId
    const queryFilter = orderId
        ? { $or: [{ orderId: String(orderId) }, { _id: orderId }, { razorpayOrderId: razorpay_order_id }] }
        : { razorpayOrderId: razorpay_order_id };

    const order = await Order.findOne(queryFilter);
    if (!order) {
        throw new ApiError(404, 'Associated order not found for payment verification.');
    }

    // Update payment details
    order.paymentStatus = 'paid';
    const prevPaymentStatus = order.status;
    if (order.status === 'pending') {
        order.status = 'processing';
    }
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    if (!order.razorpayOrderId) {
        order.razorpayOrderId = razorpay_order_id;
    }

    await order.save();

    // Send processing email if status changed
    sendOrderStatusEmail(order, prevPaymentStatus, order.status).catch(() => {});

    res.status(200).json(
        new ApiResponse(
            200,
            {
                orderId: order.orderId,
                paymentStatus: order.paymentStatus,
                status: order.status,
            },
            'Payment verified successfully.'
        )
    );
});

/**
 * Handle Razorpay asynchronous webhooks
 * POST /api/user/payment/razorpay/webhook
 */
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
    const signature = req.get('x-razorpay-signature');

    if (process.env.RAZORPAY_WEBHOOK_SECRET) {
        const isValid = verifyWebhookSignature({
            rawBody: req.body,
            signature,
        });
        if (!isValid) {
            throw new ApiError(400, 'Invalid webhook signature.');
        }
    }

    const event = req.body?.event;
    const payload = req.body?.payload;

    if (event === 'payment.captured' || event === 'order.paid') {
        const entity = payload?.payment?.entity || payload?.order?.entity;
        const razorpayOrderId = entity?.order_id || entity?.id;
        const razorpayPaymentId = entity?.id;

        if (razorpayOrderId) {
            const order = await Order.findOne({ razorpayOrderId });
            if (order && order.paymentStatus !== 'paid') {
                order.paymentStatus = 'paid';
                const prevWebhookStatus = order.status;
                if (order.status === 'pending') {
                    order.status = 'processing';
                }
                if (razorpayPaymentId) {
                    order.razorpayPaymentId = razorpayPaymentId;
                }
                await order.save();

                // Send processing email if status changed
                sendOrderStatusEmail(order, prevWebhookStatus, order.status).catch(() => {});
            }
        }
    }

    res.status(200).json({ status: 'ok' });
});
