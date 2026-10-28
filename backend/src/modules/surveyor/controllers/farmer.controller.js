import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import { getCommissionSummary } from '../../../services/fieldCommission.service.js';
import ApiError from '../../../utils/ApiError.js';
import Surveyor from '../../../models/Surveyor.model.js';
import FarmerRegistration, { AGREEMENT_VERSION } from '../../../models/FarmerRegistration.model.js';
import { encryptField, hashField } from '../../../utils/fieldCrypto.js';
import { notifyAdmins } from '../../../services/fieldAccountAuth.service.js';
import { listProduce, resolveCrops } from '../../../services/produce.service.js';
import { getSeedDashboard } from './seed.controller.js';
import {
    assertNotDuplicate,
    countByStatus,
    getRegistrationOrThrow,
    listRegistrations,
    serializeRegistration,
} from '../../../services/farmerRegistration.service.js';

const toRegistrationFields = async (body) => ({
    aadhaarEnc: encryptField(body.aadhaar),
    aadhaarHash: hashField(body.aadhaar),
    aadhaarLast4: body.aadhaar.slice(-4),
    name: body.name,
    fatherName: body.fatherName,
    village: body.village,
    panchayat: body.panchayat,
    block: body.block,
    district: body.district,
    mobile: body.mobile,
    altMobile: body.altMobile,
    email: body.email,
    landTotalAcres: body.landTotalAcres,
    landProposedAcres: body.landProposedAcres,
    landType: body.landType,
    irrigation: body.irrigation,
    farmingMethod: body.farmingMethod,
    crops: await resolveCrops(body.crops),
    agreement: { accepted: true, version: AGREEMENT_VERSION, acceptedAt: new Date() },
});

// GET /api/surveyor/produce — crop options for the registration form
export const getProduceList = asyncHandler(async (req, res) => {
    const produce = await listProduce();
    res.status(200).json(new ApiResponse(200, { produce: produce.map(({ _id, name, nameHi }) => ({ id: _id, name, nameHi })) }, 'Produce fetched.'));
});

// GET /api/surveyor/dashboard
export const getDashboard = asyncHandler(async (req, res) => {
    const [counts, seed] = await Promise.all([
        countByStatus({ surveyor: req.user.id }),
        getSeedDashboard(req.user.id),
    ]);
    res.status(200).json(new ApiResponse(200, { farmers: counts, seed }, 'Dashboard fetched.'));
});

// POST /api/surveyor/farmers
export const createFarmer = asyncHandler(async (req, res) => {
    const surveyor = await Surveyor.findById(req.user.id).select('name surveyorCode sanchalak');
    if (!surveyor) throw new ApiError(401, 'Surveyor account not found.');

    await assertNotDuplicate({ aadhaar: req.body.aadhaar, mobile: req.body.mobile });

    const registration = await FarmerRegistration.create({
        ...(await toRegistrationFields(req.body)),
        surveyor: surveyor._id,
        sanchalak: surveyor.sanchalak,
        status: 'submitted',
        submittedAt: new Date(),
    });

    await notifyAdmins({
        title: 'New Farmer Registration',
        message: `${surveyor.name} (${surveyor.surveyorCode}) registered farmer ${registration.name} — awaiting verification.`,
        data: { registrationId: String(registration._id), registrationCode: registration.registrationCode },
    });

    res.status(201).json(
        new ApiResponse(201, serializeRegistration(registration), 'Farmer registration submitted for admin verification.')
    );
});

// GET /api/surveyor/farmers
export const getFarmers = asyncHandler(async (req, res) => {
    const data = await listRegistrations({ surveyor: req.user.id }, req.query);
    res.status(200).json(new ApiResponse(200, data, 'Farmers fetched.'));
});

// GET /api/surveyor/farmers/:id
export const getFarmerById = asyncHandler(async (req, res) => {
    const registration = await getRegistrationOrThrow({ _id: req.params.id, surveyor: req.user.id });
    res.status(200).json(new ApiResponse(200, serializeRegistration(registration), 'Farmer fetched.'));
});

// PUT /api/surveyor/farmers/:id — only a rejected registration can be corrected and resubmitted
export const resubmitFarmer = asyncHandler(async (req, res) => {
    const registration = await FarmerRegistration.findOne({ _id: req.params.id, surveyor: req.user.id });
    if (!registration) throw new ApiError(404, 'Farmer registration not found.');
    if (registration.status !== 'rejected') {
        throw new ApiError(400, 'Only a rejected registration can be edited and resubmitted.');
    }

    await assertNotDuplicate({ aadhaar: req.body.aadhaar, mobile: req.body.mobile, excludeId: registration._id });

    registration.set({
        ...(await toRegistrationFields(req.body)),
        status: 'submitted',
        submittedAt: new Date(),
        resubmitCount: registration.resubmitCount + 1,
        reviewedBy: undefined,
        reviewedAt: undefined,
        commission: { surveyor: 0, sanchalak: 0 },
    });
    await registration.save();

    await notifyAdmins({
        title: 'Farmer Registration Resubmitted',
        message: `Farmer ${registration.name} (${registration.registrationCode}) was corrected and resubmitted.`,
        data: { registrationId: String(registration._id), registrationCode: registration.registrationCode },
    });

    res.status(200).json(new ApiResponse(200, serializeRegistration(registration), 'Farmer registration resubmitted.'));
});

// GET /api/surveyor/commission
export const getCommission = asyncHandler(async (req, res) => {
    const summary = await getCommissionSummary('surveyor', req.user.id);
    res.status(200).json(new ApiResponse(200, summary, 'Commission fetched.'));
});
