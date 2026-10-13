import FarmerRegistration from '../../../models/FarmerRegistration.model.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { createNotification } from '../../../services/notification.service.js';
import { commissionForApproval } from '../../../services/fieldCommission.service.js';
import { ensureKisanForRegistration } from '../../../services/kisan.service.js';
import {
    getRegistrationOrThrow,
    listRegistrations,
    serializeRegistration,
} from '../../../services/farmerRegistration.service.js';

/**
 * @desc    List farmer registrations (Kisan module)
 * @route   GET /api/admin/farmers
 * @access  Private (Admin)
 */
export const getAllFarmers = asyncHandler(async (req, res) => {
    const data = await listRegistrations({}, req.query);
    res.status(200).json(new ApiResponse(200, data, 'Farmers fetched successfully'));
});

/**
 * @desc    Farmer registration detail, including the full Aadhaar number
 * @route   GET /api/admin/farmers/:id
 * @access  Private (Admin)
 */
export const getFarmerById = asyncHandler(async (req, res) => {
    const registration = await getRegistrationOrThrow({ _id: req.params.id }, { includeAadhaar: true });
    res.status(200).json(
        new ApiResponse(200, serializeRegistration(registration, { includeAadhaar: true, includeCommission: true }), 'Farmer fetched successfully')
    );
});

/**
 * @desc    Approve or reject a farmer registration
 * @route   PATCH /api/admin/farmers/:id/review
 * @access  Private (Admin)
 */
export const reviewFarmer = asyncHandler(async (req, res) => {
    const { status, remark = '' } = req.body;
    const commission = status === 'approved' ? await commissionForApproval() : { surveyor: 0, sanchalak: 0 };

    // Only act on a registration that is still awaiting review, so a double click can't apply twice.
    const registration = await FarmerRegistration.findOneAndUpdate(
        { _id: req.params.id, status: 'submitted' },
        { status, adminRemark: remark, reviewedBy: req.user.id, reviewedAt: new Date(), commission },
        { new: true }
    ).populate([
        { path: 'surveyor', select: 'name phone surveyorCode' },
        { path: 'sanchalak', select: 'name kendraName sanchalakCode' },
    ]);

    if (!registration) {
        const exists = await FarmerRegistration.exists({ _id: req.params.id });
        throw new ApiError(exists ? 409 : 404, exists ? 'This registration has already been reviewed.' : 'Farmer registration not found.');
    }

    // An approved farmer can now log in to the Kisan app with their mobile number.
    if (status === 'approved') await ensureKisanForRegistration(registration);

    const verdict = status === 'approved' ? 'approved' : 'rejected';
    const message =
        status === 'approved'
            ? `Farmer ${registration.name} (${registration.registrationCode}) has been verified and approved.`
            : `Farmer ${registration.name} (${registration.registrationCode}) was rejected: ${remark}`;
    const data = { registrationId: String(registration._id), status, remark };

    await Promise.all([
        createNotification({ recipientId: registration.surveyor._id, recipientType: 'surveyor', title: `Farmer ${verdict}`, message, type: 'system', data }),
        createNotification({ recipientId: registration.sanchalak._id, recipientType: 'sanchalak', title: `Farmer ${verdict}`, message, type: 'system', data }),
    ]);

    res.status(200).json(new ApiResponse(200, serializeRegistration(registration, { includeCommission: true }), `Farmer registration ${verdict}`));
});
