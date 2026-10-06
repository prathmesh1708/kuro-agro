import User from '../models/User.model.js';
import Vendor from '../models/Vendor.model.js';
import DeliveryBoy from '../models/DeliveryBoy.model.js';
import Admin from '../models/Admin.model.js';
import { sendPushNotification } from '../services/firebaseAdmin.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const getModelByRole = (role) => {
    const normalizedRole = String(role).toLowerCase();
    switch (normalizedRole) {
        case 'customer':
        case 'user':
            return User;
        case 'vendor':
            return Vendor;
        case 'delivery':
            return DeliveryBoy;
        case 'admin':
        case 'superadmin':
            return Admin;
        default:
            return null;
    }
};

export const saveToken = asyncHandler(async (req, res) => {
    const { token, platform = 'web' } = req.body;
    if (!token) {
        throw new ApiError(400, 'FCM Token is required');
    }

    const userId = req.user?.id;
    const role = req.user?.role;
    console.log('[FCM Save Token] User context:', { userId, role });

    if (!userId || !role) {
        throw new ApiError(401, 'Unauthorized or missing user details');
    }

    const Model = getModelByRole(role);
    console.log('[FCM Save Token] Resolved Model:', Model?.modelName);
    if (!Model) {
        throw new ApiError(400, `Unsupported role: ${role}`);
    }

    const user = await Model.findById(userId);
    console.log('[FCM Save Token] Database query result:', user ? { id: user._id, name: user.name } : 'null');
    if (!user) {
        throw new ApiError(404, 'User/Account not found');
    }

    if (platform === 'web') {
        if (!user.fcmTokens) user.fcmTokens = [];
        if (!user.fcmTokens.includes(token)) {
            user.fcmTokens.push(token);
            if (user.fcmTokens.length > 10) {
                user.fcmTokens = user.fcmTokens.slice(-10);
            }
        }
    } else if (platform === 'mobile' || platform === 'app') {
        if (!user.fcmTokenMobile) user.fcmTokenMobile = [];
        if (!user.fcmTokenMobile.includes(token)) {
            user.fcmTokenMobile.push(token);
            if (user.fcmTokenMobile.length > 10) {
                user.fcmTokenMobile = user.fcmTokenMobile.slice(-10);
            }
        }
    }

    await user.save();

    res.status(200).json({
        success: true,
        message: 'FCM token saved successfully',
    });
});

export const removeToken = asyncHandler(async (req, res) => {
    const { token, platform = 'web' } = req.body;
    if (!token) {
        throw new ApiError(400, 'FCM Token is required');
    }

    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId || !role) {
        throw new ApiError(401, 'Unauthorized or missing user details');
    }

    const Model = getModelByRole(role);
    if (!Model) {
        throw new ApiError(400, `Unsupported role: ${role}`);
    }

    const user = await Model.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User/Account not found');
    }

    if (platform === 'web' && user.fcmTokens) {
        user.fcmTokens = user.fcmTokens.filter((t) => t !== token);
    } else if ((platform === 'mobile' || platform === 'app') && user.fcmTokenMobile) {
        user.fcmTokenMobile = user.fcmTokenMobile.filter((t) => t !== token);
    }

    await user.save();

    res.status(200).json({
        success: true,
        message: 'FCM token removed successfully',
    });
});

export const testNotification = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId || !role) {
        throw new ApiError(401, 'Unauthorized');
    }

    const Model = getModelByRole(role);
    if (!Model) {
        throw new ApiError(400, `Unsupported role: ${role}`);
    }

    const user = await Model.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const tokens = [...(user.fcmTokens || []), ...(user.fcmTokenMobile || [])];
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
        throw new ApiError(400, 'No registered FCM tokens found for this account. Make sure to allow notification permissions.');
    }

    await sendPushNotification(uniqueTokens, {
        title: 'Test Push Notification',
        body: `Hello ${user.name || 'User'}! This is a test notification confirming your FCM setup is working.`,
        data: {
            type: 'test',
            link: '/',
        },
    });

    res.status(200).json({
        success: true,
        message: 'Test push notification sent successfully',
    });
});
