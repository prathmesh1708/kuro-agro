import crypto from 'crypto';
import { sendOTPEmail } from './email.service.js';
import { sendSMS } from './sms.service.js';

/**
 * Generates a 6-digit OTP, saves it on user, sets expiry (10 minutes)
 * and dispatches OTP via SMS (SMS India Hub) and backup Email.
 * @param {Object} user - Mongoose user/vendor document
 * @param {string} type - Purpose label (for logging)
 */
export const sendOTP = async (user, type = 'verification') => {
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save({ validateBeforeSave: false });

    // 1. Send SMS OTP if user has phone number (via SMS India Hub)
    if (user.phone) {
        try {
            await sendSMS({
                phone: user.phone,
                otp,
                email: user.email
            });
            console.log(`[OTP SMS Success] Verification SMS triggered for ${user.phone}`);
        } catch (err) {
            console.error(`[OTP SMS Error] Failed to send SMS to ${user.phone}:`, err.message);
        }
    }

    // 2. Also send Email OTP backup if user has valid email
    if (user.email && !user.email.endsWith('@raathi.com')) {
        let title = 'Verification Code';
        let userType = 'Account';
        if (type.includes('vendor')) {
            title = 'Seller Account Verification';
            userType = 'Seller';
        } else if (type.includes('email') || type.includes('phone') || type.includes('register') || type.includes('verification')) {
            title = 'Account Verification';
            userType = 'Customer';
        } else if (type.includes('login')) {
            title = 'Login Verification';
            userType = 'Account';
        }

        try {
            await sendOTPEmail({
                to: user.email,
                otp,
                title,
                userType,
            });
            console.log(`[OTP Email Success] Verification email sent to ${user.email}`);
        } catch (err) {
            console.error(`[OTP Email Error] Failed to send email to ${user.email}:`, err.message);
        }
    }

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[OTP] ${type} OTP generated for ${user.phone || user.email}: ${otp}`);
    }

    return otp;
};

