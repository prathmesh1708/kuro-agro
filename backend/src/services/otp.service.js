import crypto from 'crypto';
import ApiError from '../utils/ApiError.js';
import { sendSMS } from './sms.service.js';

const OTP_VALIDITY_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;

const isProduction = () => process.env.NODE_ENV === 'production';
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

/**
 * Sends `otp` by SMS to the account's registered mobile number — the only channel OTPs use.
 * Throws when the account has no mobile number. When the SMS gateway fails, production
 * throws 502 so the user is not told an OTP was sent; development logs the OTP and carries on.
 * @returns {Promise<boolean>} whether the SMS gateway accepted the message
 */
const deliverOtpBySms = async (account, otp, purpose) => {
    if (!account.phone) {
        throw new ApiError(400, 'No mobile number is registered on this account. Please contact support.');
    }

    let smsSent = false;
    try {
        ({ smsSent } = await sendSMS({ phone: account.phone, otp }));
    } catch (err) {
        console.error(`[OTP SMS Error] ${purpose}: failed for ${account.phone}:`, err.message);
    }

    if (!smsSent) {
        console.error(`[OTP] ${purpose}: SMS not delivered to ${account.phone}. Check the SMS_INDIA_HUB_* settings.`);
        if (isProduction()) throw new ApiError(502, 'Could not send the OTP to your mobile number. Please try again.');
    }
    return smsSent;
};

/**
 * Generates a 6-digit OTP, saves it on the account (otp, otpExpiry: 10 minutes)
 * and sends it by SMS to the account's mobile number.
 * @param {Object} user - Mongoose document with a `phone`
 * @param {string} type - Purpose label (for logging)
 * @returns {Promise<{ otp: string, delivered: boolean }>}
 */
export const sendOTPWithStatus = async (user, type = 'verification') => {
    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + OTP_VALIDITY_MS);
    await user.save({ validateBeforeSave: false });

    try {
        const delivered = await deliverOtpBySms(user, otp, type);
        return { otp, delivered };
    } catch (err) {
        // Not sent: clear it so the resend cooldown does not block an immediate retry.
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save({ validateBeforeSave: false });
        throw err;
    }
};

/** Same as sendOTPWithStatus but resolves to just the OTP string. */
export const sendOTP = async (user, type = 'verification') => (await sendOTPWithStatus(user, type)).otp;

/**
 * Seconds left before another OTP may be sent to this account (0 when allowed).
 * Derived from otpExpiry, so the account must be loaded with '+otpExpiry'.
 */
export const getOtpCooldownSeconds = (account) => {
    if (!account?.otpExpiry) return 0;
    const sentAt = new Date(account.otpExpiry).getTime() - OTP_VALIDITY_MS;
    const elapsed = (Date.now() - sentAt) / 1000;
    return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed));
};

/**
 * Generates a password-reset OTP, saves it on the account (resetOtp fields)
 * and sends it by SMS to the account's mobile number.
 */
export const sendResetOTP = async (account, label = 'Account') => {
    const otp = generateOtp();
    account.resetOtp = otp;
    account.resetOtpExpiry = new Date(Date.now() + OTP_VALIDITY_MS);
    account.resetOtpVerified = false;
    await account.save({ validateBeforeSave: false });

    try {
        await deliverOtpBySms(account, otp, `${label} password reset`);
    } catch (err) {
        account.resetOtp = undefined;
        account.resetOtpExpiry = undefined;
        await account.save({ validateBeforeSave: false });
        throw err;
    }
    return otp;
};
