import mongoose from 'mongoose';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Kisan from '../../../models/Kisan.model.js';
import SeedIssue from '../../../models/SeedIssue.model.js';
import { listSeedRequests, toPlain } from '../../../services/seedDistribution.service.js';

// Seed distribution as the Sanchalak sees it: read-only. Their surveyors give the seed out and
// collect the money; the Kendra earns commission on what the farmers confirm receiving.

const KISAN_POPULATE = { path: 'kisan', select: 'name kisanCode phone address' };
const SURVEYOR_POPULATE = { path: 'surveyor', select: 'name surveyorCode phone' };

// Farmers of this Kendra matching a search, for searches by farmer name / phone / code.
// Narrowing to one surveyor is done with ?surveyor=, not by search.
const findKendraKisanIds = (sanchalakId) => async (pattern) =>
    Kisan.find({ sanchalak: sanchalakId, $or: [{ name: pattern }, { phone: pattern }, { kisanCode: pattern }] }).distinct('_id');

// GET /api/sanchalak/seed-issues — seed given out in this Kendra
export const getSeedIssues = asyncHandler(async (req, res) => {
    const scope = { sanchalak: new mongoose.Types.ObjectId(req.user.id) };
    if (req.query.surveyor) scope.surveyor = new mongoose.Types.ObjectId(req.query.surveyor);

    const data = await listSeedRequests(SeedIssue, scope, req.query, {
        populate: [KISAN_POPULATE, SURVEYOR_POPULATE],
        codeField: 'issueCode',
        searchIdField: 'kisan',
        findSearchIds: findKendraKisanIds(req.user.id),
    });
    res.status(200).json(new ApiResponse(200, data, 'Seed issues fetched.'));
});

// GET /api/sanchalak/seed-issues/:id
export const getSeedIssueById = asyncHandler(async (req, res) => {
    const issue = await SeedIssue.findOne({ _id: req.params.id, sanchalak: req.user.id })
        .populate([KISAN_POPULATE, SURVEYOR_POPULATE])
        .lean();
    if (!issue) throw new ApiError(404, 'Seed issue not found.');
    res.status(200).json(new ApiResponse(200, toPlain(issue), 'Seed issue fetched.'));
});
