import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Surveyor from '../../../models/Surveyor.model.js';
import Sanchalak from '../../../models/Sanchalak.model.js';
import { sendOTP } from '../../../services/otp.service.js';
import {
    createFieldAuthHandlers,
    getSurveyorSanchalakBlockReason,
    normalizeEmail,
    normalizePhone,
} from '../../../services/fieldAccountAuth.service.js';

const SANCHALAK_PUBLIC_FIELDS = 'name kendraName sanchalakCode phone address.district address.state';

const findActiveSanchalakByCode = (code) =>
    Sanchalak.findOne({ sanchalakCode: String(code || '').toUpperCase(), status: 'approved', isActive: true });

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
    Model: Surveyor,
    role: 'surveyor',
    label: 'Surveyor',
    codeField: 'surveyorCode',
    extraBlockReason: (surveyor) => getSurveyorSanchalakBlockReason(surveyor.sanchalak),
    tokenPayload: (surveyor) => ({ sanchalakId: surveyor.sanchalak }),
    loadProfile: (id) => Surveyor.findById(id).populate('sanchalak', SANCHALAK_PUBLIC_FIELDS),
});

// GET /api/surveyor/auth/sanchalak/:code — lets the register form confirm the code before submitting
export const lookupSanchalak = asyncHandler(async (req, res) => {
    const sanchalak = await findActiveSanchalakByCode(req.params.code).select('name kendraName sanchalakCode address.district address.state');
    if (!sanchalak) throw new ApiError(404, 'No active Sanchalak found for this code.');

    return res.status(200).json(
        new ApiResponse(200, {
            sanchalakCode: sanchalak.sanchalakCode,
            name: sanchalak.name,
            kendraName: sanchalak.kendraName,
            district: sanchalak.address?.district || '',
            state: sanchalak.address?.state || '',
        }, 'Sanchalak found.')
    );
});

// POST /api/surveyor/auth/register
export const register = asyncHandler(async (req, res) => {
    const { name, password, address, sanchalakCode } = req.body;
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);

    const sanchalak = await findActiveSanchalakByCode(sanchalakCode).select('_id');
    if (!sanchalak) throw new ApiError(400, 'Invalid Sanchalak code, or that Sanchalak is not active yet.');

    const existing = await Surveyor.findOne({ $or: [{ email }, { phone }] }).select('email phone');
    if (existing) {
        if (existing.email === email) throw new ApiError(409, 'Email already registered.');
        throw new ApiError(409, 'Phone number already registered.');
    }

    const surveyor = await Surveyor.create({
        name,
        email,
        phone,
        password,
        address,
        sanchalak: sanchalak._id,
        status: 'pending',
    });

    await sendOTP(surveyor, 'surveyor_phone_verification');

    return res.status(201).json(
        new ApiResponse(
            201,
            { email: surveyor.email, phone: surveyor.phone, surveyorCode: surveyor.surveyorCode },
            'Registration successful. Please verify the OTP sent to your phone number.'
        )
    );
});
