import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Sanchalak from '../../../models/Sanchalak.model.js';
import { sendOTP } from '../../../services/otp.service.js';
import {
    createFieldAuthHandlers,
    normalizeEmail,
    normalizePhone,
} from '../../../services/fieldAccountAuth.service.js';

export const {
    verifyOTP,
    resendOTP,
    login,
    refresh,
    logout,
    forgotPassword,
    verifyResetOTP,
    resetPassword,
    getProfile,
} = createFieldAuthHandlers({
    Model: Sanchalak,
    role: 'sanchalak',
    label: 'Sanchalak',
    codeField: 'sanchalakCode',
});

// POST /api/sanchalak/auth/register
export const register = asyncHandler(async (req, res) => {
    const { name, password, kendraName, address } = req.body;
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);

    const existing = await Sanchalak.findOne({ $or: [{ email }, { phone }] }).select('email phone');
    if (existing) {
        if (existing.email === email) throw new ApiError(409, 'Email already registered.');
        throw new ApiError(409, 'Phone number already registered.');
    }

    const sanchalak = await Sanchalak.create({
        name,
        email,
        phone,
        password,
        kendraName,
        address,
        status: 'pending',
    });

    await sendOTP(sanchalak, 'sanchalak_phone_verification');

    return res.status(201).json(
        new ApiResponse(
            201,
            { email: sanchalak.email, phone: sanchalak.phone, sanchalakCode: sanchalak.sanchalakCode },
            'Registration successful. Please verify the OTP sent to your phone number.'
        )
    );
});
