import Notification from '../models/Notification.model.js';
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js';

/**
 * Create a notification for a user/vendor/delivery/admin
 * @param {Object} options - { recipientId, recipientType, title, message, type, data }
 */
export const createNotification = async ({ recipientId, recipientType, title, message, type = 'system', data = {} }) => {
    const notification = await Notification.create({ recipientId, recipientType, title, message, type, data });
    
    // Map recipientType ('user', 'vendor', 'delivery', 'admin') to roles used in fcmToken/auth ('customer', 'vendor', 'delivery', 'admin')
    let role = recipientType;
    if (recipientType === 'user') {
        role = 'customer';
    }

    // Trigger push notification asynchronously (so it doesn't block the main thread/response)
    sendNotificationToUser(recipientId, role, {
        title,
        body: message,
        data: {
            ...data,
            notificationId: notification._id.toString(),
            type,
        }
    }).catch((err) => console.error('[Push Notification Service Error]:', err));

    return notification;
};

/**
 * Get unread notifications for a recipient
 */
export const getUnreadNotifications = async (recipientId, recipientType) => {
    return Notification.find({ recipientId, recipientType, isRead: false }).sort({ createdAt: -1 }).limit(20);
};

/**
 * Mark all notifications as read for a recipient
 */
export const markAllAsRead = async (recipientId, recipientType) => {
    return Notification.updateMany({ recipientId, recipientType, isRead: false }, { isRead: true });
};
