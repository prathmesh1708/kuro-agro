import User from '../models/User.model.js';
import Vendor from '../models/Vendor.model.js';
import DeliveryBoy from '../models/DeliveryBoy.model.js';
import Admin from '../models/Admin.model.js';
import { sendPushNotification } from '../services/firebaseAdmin.js';

export const sendNotificationToUser = async (userId, role, payload, includeMobile = true) => {
    try {
        let model;
        const normalizedRole = String(role).toLowerCase();
        
        switch (normalizedRole) {
            case 'customer':
            case 'user':
                model = User;
                break;
            case 'vendor':
                model = Vendor;
                break;
            case 'delivery':
                model = DeliveryBoy;
                break;
            case 'admin':
            case 'superadmin':
                model = Admin;
                break;
            default:
                throw new Error(`Invalid role for push notification: ${role}`);
        }
        
        const recipient = await model.findById(userId);
        if (!recipient) {
            console.warn(`[Push Notification] Recipient of role ${role} with ID ${userId} not found`);
            return;
        }
        
        let tokens = [];
        if (recipient.fcmTokens && recipient.fcmTokens.length > 0) {
            tokens = [...tokens, ...recipient.fcmTokens];
        }
        if (includeMobile && recipient.fcmTokenMobile && recipient.fcmTokenMobile.length > 0) {
            tokens = [...tokens, ...recipient.fcmTokenMobile];
        }
        
        const uniqueTokens = [...new Set(tokens)];
        
        if (uniqueTokens.length === 0) {
            console.log(`[Push Notification] No FCM tokens found for ${role} ${userId}`);
            return;
        }
        
        await sendPushNotification(uniqueTokens, payload);
    } catch (error) {
        console.error('Error sending push notification helper:', error);
    }
};
