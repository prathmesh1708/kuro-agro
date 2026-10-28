import crypto from 'crypto';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import User from '../../../models/User.model.js';
import { generateTokens } from '../../../utils/generateToken.js';
import {
    sendOTP,
    sendOTPWithStatus,
    sendResetOTP,
    getOtpCooldownSeconds,
} from '../../../services/otp.service.js';
import {
    uploadLocalFileToCloudinaryAndCleanup,
    deleteFromCloudinary,
    cleanupLocalFiles,
} from '../../../services/upload.service.js';
import {
    clearRefreshSession,
    decodeRefreshTokenOrThrow,
    persistRefreshSession,
    rotateRefreshSession,
} from '../../../services/refreshToken.service.js';

const extractCloudinaryPublicId = (url = '') => {
    const raw = String(url || '').trim();
    if (!raw || !raw.includes('/upload/')) return null;
    try {
        const afterUpload = raw.split('/upload/')[1] || '';
        const withoutTransform = afterUpload.includes('/') ? afterUpload.substring(afterUpload.indexOf('/') + 1) : afterUpload;
        const cleaned = withoutTransform.replace(/^v\d+\//, '');
        const withoutExtension = cleaned.replace(/\.[^/.]+$/, '');
        return withoutExtension || null;
    } catch {
        return null;
    }
};

// POST /api/user/auth/register
// Creates (or refreshes) an unverified account and sends an SMS OTP; /verify-otp activates it and logs in.
export const register = asyncHandler(async (req, res) => {
    const { name, password } = req.body;
    const phone = String(req.body.phone || '').replace(/\D/g, '').slice(-10);

    let user = await User.findOne({ phone }).select('+otpExpiry');
    if (user?.isVerified) throw new ApiError(409, 'Mobile number already registered. Please log in.');
    if (user && !user.isActive) throw new ApiError(403, 'Your account has been deactivated.');

    // An earlier sign-up that never verified must not block the number: take it over.
    if (user) {
        const wait = getOtpCooldownSeconds(user);
        if (wait > 0) throw new ApiError(429, `Please wait ${wait}s before requesting another OTP.`);
        user.name = String(name || '').trim();
        user.password = password;
        await user.save();
    } else {
        user = await User.create({ name: String(name || '').trim(), phone, password, isVerified: false });
    }

    const { otp } = await sendOTPWithStatus(user, 'register');

    res.status(201).json(
        new ApiResponse(
            201,
            { phone: user.phone, ...(process.env.NODE_ENV !== 'production' && { debugOtp: otp }) },
            'OTP sent to your mobile number. Verify it to complete registration.'
        )
    );
});

// POST /api/user/auth/verify-otp
export const verifyOTP = asyncHandler(async (req, res) => {
    const { phone, email, otp } = req.body;
    const normalizedPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
    const normalizedEmail = email ? String(email).trim().toLowerCase() : '';

    let user = null;
    if (normalizedPhone) {
        user = await User.findOne({ phone: normalizedPhone }).select('+otp +otpExpiry');
    } else if (normalizedEmail) {
        user = await User.findOne({ email: normalizedEmail }).select('+otp +otpExpiry');
    }
    if (!user) throw new ApiError(404, 'User not found.');

    const isDev = process.env.NODE_ENV !== 'production';
    const isMasterBypass = isDev && otp === '123456';

    if (!isMasterBypass && (!user.otp || user.otp !== otp)) throw new ApiError(400, 'Invalid OTP.');
    if (!isMasterBypass && (!user.otpExpiry || user.otpExpiry < Date.now())) throw new ApiError(400, 'OTP has expired. Please request a new one.');

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const { accessToken, refreshToken } = generateTokens({ id: user._id, role: 'customer', email: user.email });
    await persistRefreshSession(user, refreshToken);
    res.status(200).json(
        new ApiResponse(
            200, 
            { accessToken, refreshToken, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar } }, 
            'Account verified successfully.'
        )
    );
});

// POST /api/user/auth/login
export const login = asyncHandler(async (req, res) => {
    const { phone, email, identifier, password } = req.body;
    const rawIdentifier = String(phone || email || identifier || '').trim();

    if (!rawIdentifier) {
        throw new ApiError(400, 'Please provide your phone number or email address.');
    }

    let query = {};
    const digitsOnly = rawIdentifier.replace(/\D/g, '');
    const isPhone = digitsOnly.length >= 10 && !rawIdentifier.includes('@');

    if (isPhone) {
        const normalizedPhone = digitsOnly.slice(-10);
        query = { phone: normalizedPhone };
    } else {
        query = { email: rawIdentifier.toLowerCase() };
    }

    const user = await User.findOne(query).select('+password');
    if (!user) throw new ApiError(401, 'Invalid mobile number/email or password.');
    // Check the password before revealing account state or sending an SMS.
    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new ApiError(401, 'Invalid mobile number/email or password.');
    if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated.');
    if (!user.isVerified) {
        await sendOTP(user, 'phone_verification');
        throw new ApiError(403, 'Account not verified. A new verification OTP has been sent to your phone number.', [
            { field: 'phone', code: 'PHONE_NOT_VERIFIED', phone: user.phone },
        ]);
    }

    const { accessToken, refreshToken } = generateTokens({ id: user._id, role: 'customer', email: user.email });
    await persistRefreshSession(user, refreshToken);
    res.status(200).json(
        new ApiResponse(
            200, 
            { accessToken, refreshToken, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar } }, 
            'Login successful.'
        )
    );
});

// POST /api/user/auth/refresh
export const refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const decoded = decodeRefreshTokenOrThrow(refreshToken);
    const user = await User.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt isActive isVerified');

    if (!user) throw new ApiError(401, 'Invalid refresh token.');
    if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated.');
    if (!user.isVerified) throw new ApiError(403, 'Please verify your account first.');

    const tokens = await rotateRefreshSession(
        user,
        { id: user._id, role: 'customer', email: user.email },
        refreshToken
    );

    return res.status(200).json(
        new ApiResponse(200, tokens, 'Session refreshed successfully.')
    );
});

// POST /api/user/auth/logout
export const logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        try {
            const decoded = decodeRefreshTokenOrThrow(refreshToken);
            const user = await User.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt');
            if (user?.refreshTokenHash) {
                await clearRefreshSession(user);
            }
        } catch {
            // Keep logout idempotent.
        }
    }
    return res.status(200).json(new ApiResponse(200, null, 'Logged out successfully.'));
});

// POST /api/user/auth/resend-otp
export const resendOTP = asyncHandler(async (req, res) => {
    const { phone, email } = req.body;
    const normalizedPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
    const normalizedEmail = email ? String(email).trim().toLowerCase() : '';

    let user = null;
    if (normalizedPhone) {
        user = await User.findOne({ phone: normalizedPhone }).select('+otpExpiry');
    } else if (normalizedEmail) {
        user = await User.findOne({ email: normalizedEmail }).select('+otpExpiry');
    }

    if (!user) throw new ApiError(404, 'User not found.');
    if (user.isVerified) throw new ApiError(400, 'Account is already verified.');
    const wait = getOtpCooldownSeconds(user);
    if (wait > 0) throw new ApiError(429, `Please wait ${wait}s before requesting another OTP.`);

    await sendOTP(user, 'phone_verification');
    res.status(200).json(new ApiResponse(200, null, 'OTP resent successfully to your phone number.'));
});

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

// POST /api/user/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const genericResponse = new ApiResponse(200, null, 'If the mobile number is registered, a reset OTP has been sent.');

    const user = await User.findOne({ phone }).select('+resetOtp +resetOtpExpiry +resetOtpVerified');
    // Generic response to avoid account enumeration.
    if (!user) return res.status(200).json(genericResponse);
    if (!user.isVerified) {
        await sendOTP(user, 'phone_verification');
        throw new ApiError(403, 'Mobile number not verified. A new verification OTP has been sent.');
    }

    await sendResetOTP(user, 'Customer');
    return res.status(200).json(genericResponse);
});

// POST /api/user/auth/verify-reset-otp
export const verifyResetOTP = asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const { otp } = req.body;

    const user = await User.findOne({ phone }).select('+resetOtp +resetOtpExpiry +resetOtpVerified');
    if (!user) throw new ApiError(404, 'User not found.');
    if (!user.resetOtp || !user.resetOtpExpiry) throw new ApiError(400, 'No reset OTP requested.');
    if (user.resetOtpExpiry < new Date()) throw new ApiError(400, 'Reset OTP has expired.');
    if (user.resetOtp !== String(otp)) throw new ApiError(400, 'Invalid reset OTP.');

    user.resetOtpVerified = true;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, null, 'Reset OTP verified.'));
});

// POST /api/user/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const { password } = req.body;

    const user = await User.findOne({ phone }).select('+password +resetOtp +resetOtpExpiry +resetOtpVerified');
    if (!user) throw new ApiError(404, 'User not found.');
    if (!user.resetOtpVerified) throw new ApiError(400, 'Please verify reset OTP first.');
    if (!user.resetOtp || !user.resetOtpExpiry) throw new ApiError(400, 'No reset OTP requested.');
    if (user.resetOtpExpiry < new Date()) throw new ApiError(400, 'Reset OTP has expired.');

    user.password = password;
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;
    user.resetOtpVerified = false;
    user.refreshTokenHash = undefined;
    user.refreshTokenExpiresAt = undefined;
    await user.save();

    return res.status(200).json(new ApiResponse(200, null, 'Password reset successful. Please login.'));
});

import CodStats from '../../../models/CodStats.model.js';

// GET /api/user/auth/profile
export const getProfile = asyncHandler(async (req, res) => {
    const [user, codStats] = await Promise.all([
        User.findById(req.user.id),
        CodStats.findOne({ userId: req.user.id }).lean()
    ]);
    if (!user) throw new ApiError(404, 'User not found.');
    
    const userDoc = user.toObject ? user.toObject() : user;
    userDoc.codStats = codStats || {
        totalCodOrders: 0,
        deliveredCodOrders: 0,
        cancelledCodOrders: 0,
        cancellationRate: 0,
        warningCount: 0,
        isCodBlacklisted: false
    };

    res.status(200).json(new ApiResponse(200, userDoc, 'Profile fetched.'));
});

// PUT /api/user/auth/profile
export const updateProfile = asyncHandler(async (req, res) => {
    const { name, phone } = req.body;
    const normalizedName = String(name || '').trim();
    const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10);

    const existing = await User.findById(req.user.id).select('phone');
    if (!existing) throw new ApiError(404, 'User not found.');

    // A registered phone is OTP-verified and is the login ID, so it can't be changed here;
    // older accounts without one may still add it.
    const updatePayload = { name: normalizedName };
    if (!existing.phone && normalizedPhone) updatePayload.phone = normalizedPhone;

    const user = await User.findByIdAndUpdate(
        req.user.id,
        updatePayload,
        { new: true, runValidators: true }
    );
    if (!user) throw new ApiError(404, 'User not found.');
    res.status(200).json(new ApiResponse(200, user, 'Profile updated.'));
});

// POST /api/user/auth/change-password
export const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        throw new ApiError(400, 'Current password and new password are required.');
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) throw new ApiError(404, 'User not found.');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new ApiError(400, 'Current password is incorrect.');
    if (String(currentPassword) === String(newPassword)) {
        throw new ApiError(400, 'New password must be different from current password.');
    }
    if (String(newPassword).length < 6) {
        throw new ApiError(400, 'New password must be at least 6 characters.');
    }

    user.password = newPassword;
    user.refreshTokenHash = undefined;
    user.refreshTokenExpiresAt = undefined;
    await user.save();

    res.status(200).json(new ApiResponse(200, null, 'Password changed successfully.'));
});

// POST /api/user/auth/profile/avatar
export const uploadProfileAvatar = asyncHandler(async (req, res) => {
    if (!req.file?.path) {
        throw new ApiError(400, 'Avatar image file is required.');
    }

    let uploaded = null;
    try {
        uploaded = await uploadLocalFileToCloudinaryAndCleanup(
            req.file.path,
            'users/avatars'
        );

        const existingUser = await User.findById(req.user.id).select('avatar');
        if (!existingUser) throw new ApiError(404, 'User not found.');
        const previousAvatar = String(existingUser.avatar || '').trim();

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { avatar: uploaded.url },
            { new: true, runValidators: true }
        );
        if (!user) throw new ApiError(404, 'User not found.');

        const previousPublicId = extractCloudinaryPublicId(previousAvatar);
        if (previousPublicId && previousPublicId !== uploaded.publicId) {
            await deleteFromCloudinary(previousPublicId).catch(() => null);
        }

        return res.status(200).json(
            new ApiResponse(
                200,
                { user, avatar: uploaded.url, publicId: uploaded.publicId },
                'Profile picture updated successfully.'
            )
        );
    } catch (error) {
        if (!uploaded) {
            await cleanupLocalFiles([req.file?.path]);
        }
        if (uploaded?.publicId) {
            await deleteFromCloudinary(uploaded.publicId).catch(() => null);
        }
        throw error;
    }
});

// POST /api/user/auth/send-otp-phone
export const sendOtpPhone = asyncHandler(async (req, res) => {
    const { phone } = req.body;
    const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10);

    let user = await User.findOne({ phone: normalizedPhone }).select('+otpExpiry');
    if (!user) {
        // If user doesn't exist, auto-register them
        const randomPassword = crypto.randomBytes(16).toString('hex');
        user = await User.create({
            name: `User ${normalizedPhone}`,
            password: randomPassword,
            phone: normalizedPhone,
            isVerified: false,
        });
    }

    if (!user.isActive) {
        throw new ApiError(403, 'Your account has been deactivated.');
    }

    const wait = getOtpCooldownSeconds(user);
    if (wait > 0) throw new ApiError(429, `Please wait ${wait}s before requesting another OTP.`);

    const { otp } = await sendOTPWithStatus(user, 'phone_login');

    const isDev = process.env.NODE_ENV !== 'production';
    const responseData = {
        phone: normalizedPhone,
        ...(isDev ? { debugOtp: otp } : {})
    };

    res.status(200).json(new ApiResponse(200, responseData, 'OTP sent successfully.'));
});

// POST /api/user/auth/verify-otp-phone
export const verifyOtpPhone = asyncHandler(async (req, res) => {
    const { phone, otp } = req.body;
    const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10);

    const user = await User.findOne({ phone: normalizedPhone }).select('+otp +otpExpiry');
    if (!user) throw new ApiError(404, 'User not found.');
    if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated.');

    const isMasterBypass = process.env.NODE_ENV !== 'production' && otp === '123456';
    if (!isMasterBypass && (!user.otp || user.otp !== otp)) throw new ApiError(400, 'Invalid OTP.');
    if (!isMasterBypass && (!user.otpExpiry || user.otpExpiry < Date.now())) throw new ApiError(400, 'OTP has expired.');

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const { accessToken, refreshToken } = generateTokens({ id: user._id, role: 'customer', email: user.email });
    await persistRefreshSession(user, refreshToken);

    res.status(200).json(new ApiResponse(200, {
        accessToken,
        refreshToken,
        user: { id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar }
    }, 'Login successful.'));
});

// POST /api/user/auth/send-otp-email
// Looks the account up by email but sends the OTP by SMS to its registered mobile number.
export const sendOtpEmail = asyncHandler(async (req, res) => {
    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail }).select('+otpExpiry');
    if (!user || !user.phone) {
        throw new ApiError(404, 'No account with a registered mobile number found. Please log in with your mobile number.');
    }
    if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated.');

    const wait = getOtpCooldownSeconds(user);
    if (wait > 0) throw new ApiError(429, `Please wait ${wait}s before requesting another OTP.`);

    const { otp } = await sendOTPWithStatus(user, 'email_login');

    const responseData = {
        email: normalizedEmail,
        phone: `******${user.phone.slice(-4)}`,
        ...(process.env.NODE_ENV !== 'production' ? { debugOtp: otp } : {}),
    };

    res.status(200).json(
        new ApiResponse(200, responseData, `OTP sent to your registered mobile number ending ${user.phone.slice(-4)}.`)
    );
});
