import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import { getCommissionSummary } from '../../../services/fieldCommission.service.js';
import ApiError from '../../../utils/ApiError.js';
import Surveyor from '../../../models/Surveyor.model.js';
import {
    countByStatus,
    getRegistrationOrThrow,
    listRegistrations,
    serializeRegistration,
} from '../../../services/farmerRegistration.service.js';

// Read-only view of farmers registered by this Sanchalak's surveyors.

// GET /api/sanchalak/dashboard
export const getDashboard = asyncHandler(async (req, res) => {
    const [farmers, surveyorRows] = await Promise.all([
        countByStatus({ sanchalak: req.user.id }),
        Surveyor.aggregate([
            { $match: { sanchalak: new mongoose.Types.ObjectId(req.user.id) } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
    ]);
    const surveyors = Object.fromEntries(surveyorRows.map((row) => [row._id, row.count]));
    res.status(200).json(new ApiResponse(200, { farmers, surveyors }, 'Dashboard fetched.'));
});

// GET /api/sanchalak/farmers
export const getFarmers = asyncHandler(async (req, res) => {
    const data = await listRegistrations({ sanchalak: req.user.id }, req.query);
    res.status(200).json(new ApiResponse(200, data, 'Farmers fetched.'));
});

// GET /api/sanchalak/farmers/:id
export const getFarmerById = asyncHandler(async (req, res) => {
    const registration = await getRegistrationOrThrow({ _id: req.params.id, sanchalak: req.user.id });
    res.status(200).json(new ApiResponse(200, serializeRegistration(registration), 'Farmer fetched.'));
});

// GET /api/sanchalak/surveyors
export const getSurveyors = asyncHandler(async (req, res) => {
    const surveyors = await Surveyor.find({ sanchalak: req.user.id })
        .select('name phone email surveyorCode status isPhoneVerified address.village address.district createdAt')
        .sort({ createdAt: -1 })
        .lean();
    res.status(200).json(new ApiResponse(200, { surveyors }, 'Surveyors fetched.'));
});

// GET /api/sanchalak/surveyors/:id — one surveyor of this Kendra with farmer counts
export const getSurveyorById = asyncHandler(async (req, res) => {
    const surveyor = await Surveyor.findOne({ _id: req.params.id, sanchalak: req.user.id })
        .select('name phone email surveyorCode status isPhoneVerified address createdAt')
        .lean();
    if (!surveyor) throw new ApiError(404, 'Surveyor not found.');

    const farmers = await countByStatus({ sanchalak: req.user.id, surveyor: String(surveyor._id) });
    res.status(200).json(new ApiResponse(200, { ...surveyor, id: surveyor._id, farmers }, 'Surveyor fetched.'));
});

// GET /api/sanchalak/commission
export const getCommission = asyncHandler(async (req, res) => {
    const summary = await getCommissionSummary('sanchalak', req.user.id);
    res.status(200).json(new ApiResponse(200, summary, 'Commission fetched.'));
});
