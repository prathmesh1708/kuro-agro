import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Kisan from '../../../models/Kisan.model.js';
import FarmerRegistration from '../../../models/FarmerRegistration.model.js';
import { generateTokens } from '../../../utils/generateToken.js';
import { sendOTPWithStatus } from '../../../services/otp.service.js';
import { persistRefreshSession } from '../../../services/refreshToken.service.js';
import { ensureKisanForRegistration } from '../../../services/kisan.service.js';
import {
    createFieldAuthHandlers,
    getFieldAccountBlockReason,
    normalizePhone,
} from '../../../services/fieldAccountAuth.service.js';

// Kisan accounts have no password: the farmer logs in with their registered mobile number and an OTP.
// Refresh, logout and profile are the shared field-account handlers.
export const { refresh, logout, getProfile } = createFieldAuthHandlers({
    Model: Kisan,
    role: 'kisan',
    label: 'Kisan',
    codeField: 'kisanCode',
    loadProfile: (id) =>
        Kisan.findById(id)
            .populate('sanchalak', 'name kendraName sanchalakCode phone address')
            .populate('surveyor', 'name surveyorCode phone'),
});

const assertUsable = (kisan) => {
    const reason = getFieldAccountBlockReason(kisan, 'Kisan');
    if (reason) throw new ApiError(reason.status, reason.message);
};

/**
 * Finds the Kisan for a mobile number. A farmer approved before Kisan accounts existed gets one now;
 * a farmer still in review or rejected gets a message explaining why they cannot log in yet.
 */
const findKisanForLogin = async (phone, select = '') => {
    const kisan = await Kisan.findOne({ phone }).select(select);
    if (kisan) return kisan;

    const registration = await FarmerRegistration.findOne({ mobile: phone }).sort({ createdAt: -1 });
    if (!registration) {
        throw new ApiError(404, 'No farmer registration found for this mobile number. Ask your Kendra surveyor to register you.');
    }
    if (registration.status === 'submitted') {
        throw new ApiError(403, 'Your registration is awaiting admin verification. You can log in once it is approved.');
    }
    if (registration.status === 'rejected') {
        throw new ApiError(403, 'Your registration was not approved. Please contact your surveyor.');
    }
    await ensureKisanForRegistration(registration);
    return Kisan.findOne({ phone }).select(select);
};

// POST /api/kisan/auth/login/send-otp
export const sendLoginOtp = asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const kisan = await findKisanForLogin(phone);
    assertUsable(kisan);

    const { delivered } = await sendOTPWithStatus(kisan, 'kisan_login');
    if (!delivered && process.env.NODE_ENV === 'production') {
        throw new ApiError(502, 'Could not send the OTP right now. Please try again later.');
    }
    return res.status(200).json(new ApiResponse(200, { phone }, 'OTP sent to your mobile number.'));
});

// POST /api/kisan/auth/login/verify-otp
export const verifyLoginOtp = asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const { otp } = req.body;
    const kisan = await findKisanForLogin(phone, '+otp +otpExpiry');
    assertUsable(kisan);

    const isMasterBypass = process.env.NODE_ENV !== 'production' && otp === '123456';
    if (!isMasterBypass) {
        if (!kisan.otp || kisan.otp !== otp) throw new ApiError(400, 'Invalid OTP.');
        if (!kisan.otpExpiry || kisan.otpExpiry < Date.now()) throw new ApiError(400, 'OTP has expired. Please request a new one.');
    }

    kisan.otp = undefined;
    kisan.otpExpiry = undefined;
    kisan.lastLoginAt = new Date();
    const { accessToken, refreshToken } = generateTokens({ id: kisan._id, role: 'kisan', email: kisan.email });
    await persistRefreshSession(kisan, refreshToken);

    return res.status(200).json(
        new ApiResponse(200, {
            accessToken,
            refreshToken,
            account: {
                id: kisan._id,
                name: kisan.name,
                phone: kisan.phone,
                email: kisan.email,
                kisanCode: kisan.kisanCode,
                status: kisan.status,
            },
        }, 'Login successful.')
    );
});
