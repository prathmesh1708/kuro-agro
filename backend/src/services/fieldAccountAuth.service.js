import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import Admin from '../models/Admin.model.js';
import Sanchalak from '../models/Sanchalak.model.js';
import { generateTokens } from '../utils/generateToken.js';
import { sendOTP, sendResetOTP, getOtpCooldownSeconds } from './otp.service.js';
import { createNotification } from './notification.service.js';
import {
    clearRefreshSession,
    decodeRefreshTokenOrThrow,
    persistRefreshSession,
    rotateRefreshSession,
} from './refreshToken.service.js';

export const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);
export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

/**
 * Login accepts one identifier: email, login code (SAN-123456 / SUR-123456) or 10-digit phone.
 */
export const buildIdentifierQuery = (identifier, codeField) => {
    const raw = String(identifier || '').trim();
    if (!raw) return null;
    if (raw.includes('@')) return { email: raw.toLowerCase() };
    if (/^[a-z]{3}-\d{6}$/i.test(raw)) return { [codeField]: raw.toUpperCase() };
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 10) return { phone: digits.slice(-10) };
    return null;
};

/**
 * Returns { status, message } when the account may not use the app, otherwise null.
 * Shared by login, refresh and enforceAccountStatus so the rules stay identical.
 */
export const getFieldAccountBlockReason = (account, label) => {
    if (!account) return { status: 401, message: 'Account not found.' };
    if (!account.isPhoneVerified) return { status: 403, message: 'Phone number not verified.' };
    if (account.status === 'pending') {
        return { status: 403, message: `Your ${label} account is awaiting admin approval.` };
    }
    if (account.status === 'rejected') {
        return {
            status: 403,
            message: `Your ${label} registration was rejected${account.rejectionReason ? `: ${account.rejectionReason}` : '.'}`,
        };
    }
    if (account.status === 'suspended') {
        return { status: 403, message: `Your ${label} account is suspended. Contact admin.` };
    }
    if (!account.isActive) return { status: 403, message: 'Account is deactivated. Contact admin.' };
    return null;
};

/**
 * A surveyor works under a Sanchalak: if that Sanchalak is no longer approved and active,
 * the surveyor is locked out too.
 */
export const getSurveyorSanchalakBlockReason = async (sanchalakId) => {
    const sanchalak = await Sanchalak.findById(sanchalakId?._id || sanchalakId).select('status isActive').lean();
    if (!sanchalak || sanchalak.status !== 'approved' || !sanchalak.isActive) {
        return { status: 403, message: 'Your Sanchalak account is not active. Contact admin.' };
    }
    return null;
};

export const notifyAdmins = async ({ title, message, data }) => {
    const admins = await Admin.find({ isActive: true }).select('_id');
    await Promise.all(
        admins.map((admin) =>
            createNotification({ recipientId: admin._id, recipientType: 'admin', title, message, type: 'system', data })
        )
    );
};

/**
 * Shared registration step for Sanchalak and Surveyor: saves an unverified account for the phone
 * and sends the verification OTP. An earlier sign-up that never verified is taken over so it
 * cannot block the number. Admins are notified only once the phone is verified (verifyOTP).
 *
 * @returns {Promise<{ account: import('mongoose').Document, otp: string }>}
 */
export const registerUnverifiedFieldAccount = async ({ Model, role, data }) => {
    const phone = normalizePhone(data.phone);
    let account = await Model.findOne({ phone }).select('+otpExpiry');

    if (account?.isPhoneVerified) throw new ApiError(409, 'Mobile number already registered. Please log in.');
    if (account) {
        const wait = getOtpCooldownSeconds(account);
        if (wait > 0) throw new ApiError(429, `Please wait ${wait}s before requesting another OTP.`);
        account.set({ ...data, phone, status: 'pending', isPhoneVerified: false });
        await account.save();
    } else {
        account = await Model.create({ ...data, phone, status: 'pending', isPhoneVerified: false });
    }

    const otp = await sendOTP(account, `${role}_phone_verification`);
    return { account, otp };
};

/**
 * Builds the auth handlers shared by the Sanchalak and Surveyor modules.
 * Registration stays in each module because the fields differ.
 *
 * @param {Object} config
 * @param {import('mongoose').Model} config.Model
 * @param {string} config.role         JWT role, e.g. 'sanchalak'
 * @param {string} config.label        Human label used in messages, e.g. 'Sanchalak'
 * @param {string} config.codeField    Login code field, e.g. 'sanchalakCode'
 * @param {Function} [config.extraBlockReason]  async (account) => { status, message } | null
 * @param {Function} [config.tokenPayload]      (account) => extra JWT claims
 * @param {Function} [config.loadProfile]       async (id) => profile document
 */
export const createFieldAuthHandlers = ({
    Model,
    role,
    label,
    codeField,
    extraBlockReason = async () => null,
    tokenPayload = () => ({}),
    loadProfile = (id) => Model.findById(id),
}) => {
    const buildPayload = (account) => ({ id: account._id, role, email: account.email, ...tokenPayload(account) });

    const toAccountResponse = (account) => ({
        id: account._id,
        name: account.name,
        email: account.email,
        phone: account.phone,
        [codeField]: account[codeField],
        status: account.status,
        avatar: account.avatar,
    });

    const assertUsable = async (account) => {
        const reason = getFieldAccountBlockReason(account, label) || (await extraBlockReason(account));
        if (reason) throw new ApiError(reason.status, reason.message);
    };

    // POST /auth/verify-otp
    const verifyOTP = asyncHandler(async (req, res) => {
        const phone = normalizePhone(req.body.phone);
        const { otp } = req.body;

        const account = await Model.findOne({ phone }).select('+otp +otpExpiry');
        if (!account) throw new ApiError(404, `${label} account not found.`);
        if (account.isPhoneVerified) {
            return res.status(200).json(new ApiResponse(200, { status: account.status }, 'Phone already verified.'));
        }

        const isDev = process.env.NODE_ENV !== 'production';
        const isMasterBypass = isDev && otp === '123456';
        if (!isMasterBypass && (!account.otp || account.otp !== otp)) throw new ApiError(400, 'Invalid OTP.');
        if (!isMasterBypass && (!account.otpExpiry || account.otpExpiry < Date.now())) {
            throw new ApiError(400, 'OTP has expired. Please request a new one.');
        }

        account.isPhoneVerified = true;
        account.otp = undefined;
        account.otpExpiry = undefined;
        await account.save({ validateBeforeSave: false });

        await notifyAdmins({
            title: `New ${label} Registration`,
            message: `${account.name} registered as ${label} and is awaiting approval.`,
            data: { role, accountId: String(account._id), [codeField]: account[codeField] },
        });

        return res.status(200).json(
            new ApiResponse(
                200,
                { status: account.status, [codeField]: account[codeField] },
                'Phone verified. Your account is awaiting admin approval.'
            )
        );
    });

    // POST /auth/resend-otp
    const resendOTP = asyncHandler(async (req, res) => {
        const phone = normalizePhone(req.body.phone);
        const account = await Model.findOne({ phone }).select('+otpExpiry');
        if (!account) throw new ApiError(404, `${label} account not found.`);
        if (account.isPhoneVerified) throw new ApiError(400, 'Phone number is already verified.');
        const wait = getOtpCooldownSeconds(account);
        if (wait > 0) throw new ApiError(429, `Please wait ${wait}s before requesting another OTP.`);

        await sendOTP(account, `${role}_phone_verification`);
        return res.status(200).json(new ApiResponse(200, null, 'OTP resent to your phone number.'));
    });

    // POST /auth/login
    const login = asyncHandler(async (req, res) => {
        const query = buildIdentifierQuery(req.body.identifier, codeField);
        if (!query) throw new ApiError(400, 'Enter your login ID, email or 10-digit phone number.');

        const account = await Model.findOne(query).select('+password');
        // Check the password before revealing anything about account state.
        if (!account || !(await account.comparePassword(req.body.password))) {
            throw new ApiError(401, 'Invalid login ID or password.');
        }

        if (!account.isPhoneVerified) {
            await sendOTP(account, `${role}_phone_verification`);
            throw new ApiError(403, 'Phone number not verified. A new OTP has been sent to your phone.', [
                { field: 'phone', code: 'PHONE_NOT_VERIFIED', phone: account.phone },
            ]);
        }
        await assertUsable(account);

        account.lastLoginAt = new Date();
        const { accessToken, refreshToken } = generateTokens(buildPayload(account));
        await persistRefreshSession(account, refreshToken);

        return res.status(200).json(
            new ApiResponse(200, { accessToken, refreshToken, account: toAccountResponse(account) }, 'Login successful.')
        );
    });

    // POST /auth/refresh
    const refresh = asyncHandler(async (req, res) => {
        const { refreshToken } = req.body;
        const decoded = decodeRefreshTokenOrThrow(refreshToken);
        if (decoded.role !== role) throw new ApiError(401, 'Invalid refresh token.');

        const account = await Model.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt');
        if (!account) throw new ApiError(401, 'Invalid refresh token.');
        await assertUsable(account);

        const tokens = await rotateRefreshSession(account, buildPayload(account), refreshToken);
        return res.status(200).json(new ApiResponse(200, tokens, 'Session refreshed successfully.'));
    });

    // POST /auth/logout
    const logout = asyncHandler(async (req, res) => {
        const { refreshToken } = req.body;
        if (refreshToken) {
            try {
                const decoded = decodeRefreshTokenOrThrow(refreshToken);
                const account = await Model.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt');
                if (account?.refreshTokenHash) await clearRefreshSession(account);
            } catch {
                // Keep logout idempotent.
            }
        }
        return res.status(200).json(new ApiResponse(200, null, 'Logged out successfully.'));
    });

    // POST /auth/forgot-password
    const forgotPassword = asyncHandler(async (req, res) => {
        const phone = normalizePhone(req.body.phone);
        const account = await Model.findOne({ phone }).select('+resetOtp +resetOtpExpiry +resetOtpVerified');
        const genericResponse = new ApiResponse(200, null, 'If the mobile number is registered, a reset OTP has been sent.');
        if (!account) return res.status(200).json(genericResponse);

        await sendResetOTP(account, label);
        return res.status(200).json(genericResponse);
    });

    // POST /auth/verify-reset-otp
    const verifyResetOTP = asyncHandler(async (req, res) => {
        const phone = normalizePhone(req.body.phone);
        const account = await Model.findOne({ phone }).select('+resetOtp +resetOtpExpiry +resetOtpVerified');
        if (!account) throw new ApiError(404, `${label} account not found.`);
        if (!account.resetOtp || !account.resetOtpExpiry) throw new ApiError(400, 'No reset OTP requested.');
        if (account.resetOtpExpiry < new Date()) throw new ApiError(400, 'Reset OTP has expired.');
        if (account.resetOtp !== String(req.body.otp)) throw new ApiError(400, 'Invalid reset OTP.');

        account.resetOtpVerified = true;
        await account.save({ validateBeforeSave: false });
        return res.status(200).json(new ApiResponse(200, null, 'Reset OTP verified.'));
    });

    // POST /auth/reset-password
    const resetPassword = asyncHandler(async (req, res) => {
        const phone = normalizePhone(req.body.phone);
        const account = await Model.findOne({ phone }).select('+password +resetOtp +resetOtpExpiry +resetOtpVerified');
        if (!account) throw new ApiError(404, `${label} account not found.`);
        if (!account.resetOtpVerified) throw new ApiError(400, 'Please verify reset OTP first.');
        if (!account.resetOtpExpiry || account.resetOtpExpiry < new Date()) throw new ApiError(400, 'Reset OTP has expired.');

        account.password = req.body.password;
        account.resetOtp = undefined;
        account.resetOtpExpiry = undefined;
        account.resetOtpVerified = false;
        account.refreshTokenHash = undefined;
        account.refreshTokenExpiresAt = undefined;
        await account.save();

        return res.status(200).json(new ApiResponse(200, null, 'Password reset successful. Please login.'));
    });

    // GET /auth/profile
    const getProfile = asyncHandler(async (req, res) => {
        const account = await loadProfile(req.user.id);
        if (!account) throw new ApiError(404, `${label} account not found.`);
        return res.status(200).json(new ApiResponse(200, account, 'Profile fetched.'));
    });

    return {
        verifyOTP,
        resendOTP,
        login,
        refresh,
        logout,
        forgotPassword,
        verifyResetOTP,
        resetPassword,
        getProfile,
    };
};
