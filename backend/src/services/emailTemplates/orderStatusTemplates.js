/**
 * orderStatusTemplates.js
 * ────────────────────────
 * Responsive, email-client-safe HTML templates for order status notifications.
 * Follows the existing branding style from email.service.js (OTP email template).
 *
 * Usage:
 *   import { getOrderStatusEmailContent } from './emailTemplates/orderStatusTemplates.js';
 *   const { subject, html, text } = getOrderStatusEmailContent(order, newStatus);
 */

const appName = () => process.env.FROM_NAME || 'Rathi';
const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');

// ─── Status display configuration ────────────────────────────────────────────

const STATUS_CONFIG = {
    pending: {
        label: 'Order Received',
        emoji: '🛒',
        color: '#f59e0b',
        message: (order) => `We've received your order and it's being reviewed. We'll update you once it's confirmed.`,
    },
    processing: {
        label: 'Order Confirmed',
        emoji: '✅',
        color: '#3b82f6',
        message: (order) => `Great news! Your order has been confirmed and is now being prepared.`,
    },
    shipped: {
        label: 'Order Shipped',
        emoji: '🚚',
        color: '#8b5cf6',
        message: (order) => `Your order is on its way! ${order.trackingNumber ? `Tracking number: ${order.trackingNumber}` : 'You can track your order using the link below.'}`,
    },
    delivered: {
        label: 'Order Delivered',
        emoji: '🎉',
        color: '#10b981',
        message: (order) => `Your order has been successfully delivered. We hope you enjoy your purchase!`,
    },
    cancelled: {
        label: 'Order Cancelled',
        emoji: '❌',
        color: '#ef4444',
        message: (order) => `Your order has been cancelled.${order.cancellationReason ? ` Reason: ${order.cancellationReason}` : ''} If you have any questions, please contact our support team.`,
    },
    returned: {
        label: 'Return Processed',
        emoji: '🔄',
        color: '#f97316',
        message: (order) => `Your return request has been processed. If a refund is applicable, it will be initiated shortly.`,
    },
};

// ─── Subject line generator ──────────────────────────────────────────────────

function getSubject(order, status) {
    const config = STATUS_CONFIG[status];
    if (!config) return `Order Update — ${order.orderId}`;
    return `${config.label} — ${order.orderId}`;
}

// ─── Plain text fallback ─────────────────────────────────────────────────────

function getPlainText(order, status) {
    const config = STATUS_CONFIG[status];
    const customerName = order.shippingAddress?.name || 'Customer';
    const statusLabel = config?.label || status;
    const statusMsg = config?.message?.(order) || `Your order status has been updated to: ${status}.`;

    let text = `Hi ${customerName},\n\n`;
    text += `${statusMsg}\n\n`;
    text += `Order ID: ${order.orderId}\n`;
    text += `Status: ${statusLabel}\n`;
    if (order.total != null) text += `Total: ₹${Number(order.total).toFixed(2)}\n`;
    if (order.createdAt) text += `Order Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}\n`;
    text += `\nTrack your order: ${clientUrl()}/orders/${order.orderId}\n`;
    text += `\n— ${appName()} Team`;
    return text;
}

// ─── HTML email template ─────────────────────────────────────────────────────

function getHtml(order, status) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.processing;
    const customerName = order.shippingAddress?.name || 'Customer';
    const statusLabel = config.label;
    const statusMsg = config.message(order);
    const statusColor = config.color;
    const emoji = config.emoji;
    const trackUrl = `${clientUrl()}/orders/${order.orderId}`;
    const orderDate = order.createdAt
        ? new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
        : '';
    const total = order.total != null ? `₹${Number(order.total).toFixed(2)}` : '';
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${statusLabel}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; color: #1e293b;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 28px 24px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">${appName()}</h1>
                <p style="color: #e0e7ff; margin: 6px 0 0 0; font-size: 14px;">Order Update</p>
            </td>
        </tr>
        <!-- Status Badge -->
        <tr>
            <td style="padding: 28px 28px 0 28px; text-align: center;">
                <div style="display: inline-block; background-color: ${statusColor}15; border: 1px solid ${statusColor}40; border-radius: 50px; padding: 10px 24px;">
                    <span style="font-size: 16px; font-weight: 600; color: ${statusColor};">${emoji} ${statusLabel}</span>
                </div>
            </td>
        </tr>
        <!-- Content -->
        <tr>
            <td style="padding: 24px 28px;">
                <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-top: 0;">Hi <strong>${customerName}</strong>,</p>
                <p style="font-size: 15px; line-height: 1.6; color: #334155;">${statusMsg}</p>

                <!-- Order Details Box -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 10px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <tr>
                        <td style="padding: 18px 20px;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Order ID</td>
                                    <td style="padding: 4px 0; font-size: 13px; color: #1e293b; font-weight: 600; text-align: right;">${order.orderId}</td>
                                </tr>
                                ${orderDate ? `<tr>
                                    <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Order Date</td>
                                    <td style="padding: 4px 0; font-size: 13px; color: #1e293b; text-align: right;">${orderDate}</td>
                                </tr>` : ''}
                                ${total ? `<tr>
                                    <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Total Amount</td>
                                    <td style="padding: 4px 0; font-size: 13px; color: #1e293b; font-weight: 600; text-align: right;">${total}</td>
                                </tr>` : ''}
                                ${order.trackingNumber ? `<tr>
                                    <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Tracking No.</td>
                                    <td style="padding: 4px 0; font-size: 13px; color: #1e293b; text-align: right;">${order.trackingNumber}</td>
                                </tr>` : ''}
                                ${order.estimatedDelivery && status !== 'delivered' && status !== 'cancelled' && status !== 'returned' ? `<tr>
                                    <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Est. Delivery</td>
                                    <td style="padding: 4px 0; font-size: 13px; color: #1e293b; text-align: right;">${new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                </tr>` : ''}
                            </table>
                        </td>
                    </tr>
                </table>

                <!-- Track Order Button -->
                <div style="text-align: center; margin: 24px 0;">
                    <a href="${trackUrl}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; letter-spacing: 0.3px;">View Order Details</a>
                </div>

                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

                <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
                    If you have any questions about your order, please contact our support team. This is an automated notification — please do not reply to this email.
                </p>
            </td>
        </tr>
        <!-- Footer -->
        <tr>
            <td style="background-color: #f8fafc; padding: 16px 28px; text-align: center; border-top: 1px solid #f1f5f9;">
                <p style="font-size: 12px; color: #94a3b8; margin: 0;">&copy; ${year} ${appName()} Parivaar. All rights reserved.</p>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate email content for an order status notification.
 *
 * @param {Object} order     – Order document (must have orderId, shippingAddress, etc.)
 * @param {string} newStatus – The new canonical status
 * @returns {{ subject: string, html: string, text: string }}
 */
export function getOrderStatusEmailContent(order, newStatus) {
    return {
        subject: getSubject(order, newStatus),
        html: getHtml(order, newStatus),
        text: getPlainText(order, newStatus),
    };
}

/**
 * Check if a given status should trigger a customer email notification.
 * @param {string} status
 * @returns {boolean}
 */
export function isEmailableStatus(status) {
    return Boolean(STATUS_CONFIG[String(status || '').toLowerCase()]);
}

export default { getOrderStatusEmailContent, isEmailableStatus };
