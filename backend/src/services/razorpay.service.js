import Razorpay from 'razorpay';
import crypto from 'crypto';

/**
 * Lazily initialize Razorpay client to ensure env variables are loaded.
 */
const getRazorpayInstance = () => {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
        throw new Error('Razorpay credentials missing. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
    }

    return new Razorpay({
        key_id,
        key_secret,
    });
};

/**
 * Create a new Razorpay Order
 * @param {Object} params
 * @param {number} params.amount - Total amount in paise (e.g. ₹500.00 => 50000)
 * @param {string} params.receipt - Order reference ID
 * @param {Object} [params.notes] - Key-value metadata
 */
export const createRazorpayOrder = async ({ amount, receipt, notes = {} }) => {
    const instance = getRazorpayInstance();
    const options = {
        amount: Math.round(amount), // ensure integer paise
        currency: 'INR',
        receipt: String(receipt),
        notes,
    };

    const order = await instance.orders.create(options);
    return order;
};

/**
 * Verify Razorpay payment signature from client
 * @param {Object} params
 * @param {string} params.razorpayOrderId
 * @param {string} params.razorpayPaymentId
 * @param {string} params.razorpaySignature
 * @returns {boolean}
 */
export const verifyRazorpaySignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret) {
        throw new Error('RAZORPAY_KEY_SECRET missing in .env');
    }

    const generatedSignature = crypto
        .createHmac('sha256', key_secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(generatedSignature),
        Buffer.from(razorpaySignature)
    );
};

/**
 * Verify Razorpay Webhook signature
 * @param {Object} params
 * @param {string|Buffer} params.rawBody
 * @param {string} params.signature
 * @returns {boolean}
 */
export const verifyWebhookSignature = ({ rawBody, signature }) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) return false;

    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(signature)
        );
    } catch {
        return false;
    }
};

export default {
    createRazorpayOrder,
    verifyRazorpaySignature,
    verifyWebhookSignature,
};
