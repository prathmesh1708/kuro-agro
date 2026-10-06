/**
 * orderEmailNotification.service.js
 * ───────────────────────────────────
 * Centralized service for sending customer email notifications on order status changes.
 *
 * Design principles:
 *   - Fire-and-forget: never throws, never blocks the order update
 *   - Duplicate-safe:  skips when previousStatus === newStatus
 *   - Graceful:        skips silently when customer email is unavailable
 *   - Reuses:          existing sendEmail() from email.service.js
 *
 * Usage (in any controller, after order.save()):
 *   import { sendOrderStatusEmail } from '../../../services/orderEmailNotification.service.js';
 *   sendOrderStatusEmail(order, previousStatus, newStatus).catch(() => {});
 */

import { sendEmail } from './email.service.js';
import { getOrderStatusEmailContent, isEmailableStatus } from './emailTemplates/orderStatusTemplates.js';
import User from '../models/User.model.js';

/**
 * Resolve the customer email for an order.
 * Priority: shippingAddress.email → guestInfo.email → User record email
 *
 * @param {Object} order – Order document (may or may not have userId populated)
 * @returns {Promise<string|null>}
 */
async function resolveCustomerEmail(order) {
    // 1. shippingAddress.email (most reliable — always captured at checkout)
    const shippingEmail = String(order?.shippingAddress?.email || '').trim().toLowerCase();
    if (shippingEmail) return shippingEmail;

    // 2. guestInfo.email (for guest orders)
    const guestEmail = String(order?.guestInfo?.email || '').trim().toLowerCase();
    if (guestEmail) return guestEmail;

    // 3. Populated userId object (when controller already populated it)
    if (order?.userId?.email) {
        return String(order.userId.email).trim().toLowerCase();
    }

    // 4. Lookup from User collection (last resort)
    if (order?.userId) {
        const userId = order.userId._id || order.userId;
        try {
            const user = await User.findById(userId).select('email').lean();
            if (user?.email) return String(user.email).trim().toLowerCase();
        } catch (err) {
            console.warn(`[OrderEmailNotification] Failed to look up user email for userId=${userId}:`, err.message);
        }
    }

    return null;
}

/**
 * Resolve a display name for the customer.
 * @param {Object} order
 * @returns {string}
 */
function resolveCustomerName(order) {
    return (
        String(order?.shippingAddress?.name || '').trim() ||
        String(order?.guestInfo?.name || '').trim() ||
        (order?.userId?.name ? String(order.userId.name).trim() : '') ||
        'Customer'
    );
}

/**
 * Send an order status email notification to the customer.
 *
 * This function NEVER throws. All errors are caught and logged internally.
 * It is safe to call as fire-and-forget:
 *   sendOrderStatusEmail(order, oldStatus, newStatus).catch(() => {});
 *
 * @param {Object} order          – The order document (after save)
 * @param {string} previousStatus – Status before the change
 * @param {string} newStatus      – Status after the change
 */
export async function sendOrderStatusEmail(order, previousStatus, newStatus) {
    try {
        const normalizedPrev = String(previousStatus || '').toLowerCase();
        const normalizedNext = String(newStatus || '').toLowerCase();

        // Guard: skip if status didn't actually change
        if (normalizedPrev === normalizedNext) {
            return;
        }

        // Guard: skip if this status doesn't warrant a customer email
        if (!isEmailableStatus(normalizedNext)) {
            return;
        }

        // Resolve customer email
        const customerEmail = await resolveCustomerEmail(order);
        if (!customerEmail) {
            console.warn(
                `[OrderEmailNotification] No customer email found for order ${order.orderId || order._id} — skipping email for status "${normalizedNext}"`
            );
            return;
        }

        // Generate email content
        const { subject, html, text } = getOrderStatusEmailContent(order, normalizedNext);

        // Send email
        await sendEmail({ to: customerEmail, subject, html, text });

        console.info(
            `[OrderEmailNotification] ✅ Email sent | order=${order.orderId} | status=${normalizedNext} | to=${customerEmail}`
        );
    } catch (err) {
        // Never let email failure propagate — log and move on
        console.error(
            `[OrderEmailNotification] ❌ Failed to send email | order=${order?.orderId || order?._id || 'unknown'} | status=${newStatus} | error=${err.message}`
        );
    }
}

export default { sendOrderStatusEmail };
