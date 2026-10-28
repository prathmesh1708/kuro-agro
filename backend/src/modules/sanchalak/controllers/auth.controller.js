import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import Sanchalak from '../../../models/Sanchalak.model.js';
import {
    createFieldAuthHandlers,
    registerUnverifiedFieldAccount,
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

// POST /api/sanchalak/auth/register — saves the account unverified and sends a phone OTP (then /verify-otp)
export const register = asyncHandler(async (req, res) => {
    const { name, password, kendraName, address } = req.body;

    const { account: sanchalak, otp } = await registerUnverifiedFieldAccount({
        Model: Sanchalak,
        role: 'sanchalak',
        data: { name, password, kendraName, address, phone: req.body.phone },
    });

    return res.status(201).json(
        new ApiResponse(
            201,
            {
                phone: sanchalak.phone,
                sanchalakCode: sanchalak.sanchalakCode,
                ...(process.env.NODE_ENV !== 'production' && { debugOtp: otp }),
            },
            'OTP sent to your mobile number. Verify it to submit your registration.'
        )
    );
});
