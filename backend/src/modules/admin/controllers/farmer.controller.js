import FarmerRegistration from '../../../models/FarmerRegistration.model.js';
import Surveyor from '../../../models/Surveyor.model.js';
import Sanchalak from '../../../models/Sanchalak.model.js';
import { maskAadhaar } from '../../../utils/fieldCrypto.js';
import { EXPORT_ROW_LIMIT, formatExportDate, sendExport } from '../../../services/export.service.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { createNotification } from '../../../services/notification.service.js';
import { commissionForApproval } from '../../../services/fieldCommission.service.js';
import { ensureKisanForRegistration } from '../../../services/kisan.service.js';
import {
    PEOPLE_POPULATE,
    buildRegistrationFilter,
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

const STATUS_LABELS = { submitted: 'Pending verification', approved: 'Approved', rejected: 'Rejected' };

/**
 * @desc    Download farmer registrations (same filters as the list) as Excel or PDF.
 *          Aadhaar is always masked in exports.
 * @route   GET /api/admin/farmers/export?format=xlsx|pdf
 * @access  Private (Admin)
 */
export const exportFarmers = asyncHandler(async (req, res) => {
    const { filter } = buildRegistrationFilter({}, req.query);
    const [registrations, surveyor, sanchalak] = await Promise.all([
        FarmerRegistration.find(filter).populate(PEOPLE_POPULATE).sort({ createdAt: -1 }).limit(EXPORT_ROW_LIMIT).lean(),
        req.query.surveyor ? Surveyor.findById(req.query.surveyor).select('name surveyorCode').lean() : null,
        req.query.sanchalak ? Sanchalak.findById(req.query.sanchalak).select('kendraName sanchalakCode').lean() : null,
    ]);

    const meta = [['Status', STATUS_LABELS[req.query.status] || 'All'], ...(req.query.search ? [['Search', req.query.search]] : [])];
    if (surveyor) meta.unshift(['Surveyor', `${surveyor.name} (${surveyor.surveyorCode})`]);
    if (sanchalak) meta.unshift(['Kendra', `${sanchalak.kendraName} (${sanchalak.sanchalakCode})`]);

    await sendExport(res, {
        format: req.query.format,
        title: 'Farmers (Kisan)',
        filename: 'farmers',
        meta,
        rows: registrations,
        columns: [
            { header: 'Reg. Code', value: (r) => r.registrationCode, width: 11 },
            { header: 'Name', value: (r) => r.name, width: 16 },
            { header: 'Father Name', value: (r) => r.fatherName, width: 16 },
            { header: 'Mobile', value: (r) => r.mobile, width: 11 },
            { header: 'Alt. Mobile', value: (r) => r.altMobile, width: 11, pdf: false },
            { header: 'Aadhaar', value: (r) => maskAadhaar(r.aadhaarLast4), width: 14 },
            { header: 'Village', value: (r) => r.village, width: 12 },
            { header: 'Panchayat', value: (r) => r.panchayat, width: 12, pdf: false },
            { header: 'Block', value: (r) => r.block, width: 11 },
            { header: 'District', value: (r) => r.district, width: 11 },
            { header: 'Total Land (acre)', value: (r) => r.landTotalAcres, width: 9 },
            { header: 'Proposed (acre)', value: (r) => r.landProposedAcres, width: 9 },
            { header: 'Land Type', value: (r) => r.landType, width: 8, pdf: false },
            { header: 'Irrigation', value: (r) => r.irrigation, width: 9 },
            { header: 'Crops', value: (r) => (r.crops || []).map((c) => c.name).join(', '), width: 20 },
            { header: 'Surveyor', value: (r) => (r.surveyor ? `${r.surveyor.name} (${r.surveyor.surveyorCode})` : ''), width: 18 },
            { header: 'Kendra', value: (r) => r.sanchalak?.kendraName, width: 16 },
            { header: 'Status', value: (r) => STATUS_LABELS[r.status] || r.status, width: 11 },
            { header: 'Admin Remark', value: (r) => r.adminRemark, width: 16, pdf: false },
            { header: 'Submitted On', value: (r) => formatExportDate(r.submittedAt), width: 11 },
            { header: 'Reviewed On', value: (r) => formatExportDate(r.reviewedAt), width: 11, pdf: false },
        ],
    });
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
