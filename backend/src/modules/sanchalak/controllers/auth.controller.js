import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Sanchalak from '../../../models/Sanchalak.model.js';
import {
    createFieldAuthHandlers,
    normalizeEmail,
    normalizePhone,
    notifyAdmins,
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
    const rawPhone = req.body.phone ? normalizePhone(req.body.phone) : undefined;
    const phone = rawPhone && rawPhone.length === 10 ? rawPhone : undefined;

    const existingConditions = [{ email }];
    if (phone) existingConditions.push({ phone });
    const existing = await Sanchalak.findOne({ $or: existingConditions }).select('email phone');
    if (existing) {
        if (existing.email === email) throw new ApiError(409, 'Email already registered.');
        if (phone && existing.phone === phone) throw new ApiError(409, 'Phone number already registered.');
    }

    const sanchalakData = {
        name,
        email,
        password,
        kendraName,
        address,
        status: 'pending',
        isPhoneVerified: true,
    };
    if (phone) {
        sanchalakData.phone = phone;
    }

    const sanchalak = await Sanchalak.create(sanchalakData);

    await notifyAdmins({
        title: 'New Sanchalak Registration',
        message: `${sanchalak.name} registered Kendra "${sanchalak.kendraName}". Pending review.`,
        data: { role: 'sanchalak', accountId: String(sanchalak._id), sanchalakCode: sanchalak.sanchalakCode },
    }).catch(() => {});

    return res.status(201).json(
        new ApiResponse(
            201,
            { email: sanchalak.email, phone: sanchalak.phone, sanchalakCode: sanchalak.sanchalakCode },
            'Registration submitted successfully. Your account is pending admin approval.'
        )
    );
});
