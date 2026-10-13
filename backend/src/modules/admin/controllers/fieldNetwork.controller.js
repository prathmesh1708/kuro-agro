import mongoose from 'mongoose';
import Sanchalak from '../../../models/Sanchalak.model.js';
import Surveyor from '../../../models/Surveyor.model.js';
import FarmerRegistration from '../../../models/FarmerRegistration.model.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { sendEmail } from '../../../services/email.service.js';
import { createNotification } from '../../../services/notification.service.js';
import { getCommissionSummary, getFieldCommissionRates, saveFieldCommissionRates } from '../../../services/fieldCommission.service.js';
import { countByStatus } from '../../../services/farmerRegistration.service.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildListFilter = ({ search, status }, codeField) => {
    const filter = {};
    if (status) filter.status = status;
    if (search) {
        const pattern = { $regex: escapeRegex(search), $options: 'i' };
        filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }, { [codeField]: pattern }];
    }
    return filter;
};

// Profile header stats: farmer counts and commission totals, without the commission history list.
const profileStats = async (role, accountId) => {
    const [farmers, { ratePerFarmer, earned, pending }] = await Promise.all([
        countByStatus({ [role]: String(accountId) }),
        getCommissionSummary(role, accountId),
    ]);
    return { farmers, commission: { ratePerFarmer, earned, pending } };
};

const paginate = ({ page = 1, limit = 10 }) => {
    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 10;
    return { page: numericPage, limit: numericLimit, skip: (numericPage - 1) * numericLimit };
};

/**
 * Shared approve / reject / suspend logic for field accounts.
 * Clears the refresh session on reject or suspend so the account is signed out on its next refresh.
 */
const applyStatusChange = async ({ account, status, reason, adminId, label, role }) => {
    if (!account.isPhoneVerified) {
        throw new ApiError(400, `This ${label} has not verified their phone number yet.`);
    }

    account.status = status;
    account.rejectionReason = status === 'approved' ? '' : reason;
    account.statusUpdatedBy = adminId;
    account.statusUpdatedAt = new Date();
    if (status === 'approved') {
        account.isActive = true;
        account.approvedAt = account.approvedAt || new Date();
    } else {
        account.refreshTokenHash = undefined;
        account.refreshTokenExpiresAt = undefined;
    }
    await account.save({ validateBeforeSave: false });

    const messages = {
        approved: `Your ${label} account has been approved. You can now log in.`,
        rejected: `Your ${label} registration was rejected. Reason: ${reason}`,
        suspended: `Your ${label} account has been suspended. Reason: ${reason}`,
    };

    try {
        await sendEmail({
            to: account.email,
            subject: `${label} account ${status}`,
            text: messages[status],
            html: `<p>${messages[status]}</p>`,
        });
    } catch (err) {
        console.warn(`[${label} Status Email] Failed for ${account.email}: ${err.message}`);
    }

    await createNotification({
        recipientId: account._id,
        recipientType: role,
        title: `Account ${status}`,
        message: messages[status],
        type: 'system',
        data: { status, reason: account.rejectionReason || '' },
    });
};

// ─── Sanchalaks ───────────────────────────────────────────────────────────────

/**
 * @desc    List Sanchalaks with surveyor counts
 * @route   GET /api/admin/sanchalaks
 * @access  Private (Admin)
 */
export const getAllSanchalaks = asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const filter = buildListFilter(req.query, 'sanchalakCode');

    const [sanchalaks, total, statusCounts] = await Promise.all([
        Sanchalak.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Sanchalak.countDocuments(filter),
        Sanchalak.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const surveyorCounts = await Surveyor.aggregate([
        { $match: { sanchalak: { $in: sanchalaks.map((s) => s._id) } } },
        { $group: { _id: '$sanchalak', total: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } } } },
    ]);
    const countsById = new Map(surveyorCounts.map((c) => [String(c._id), c]));

    res.status(200).json(
        new ApiResponse(200, {
            sanchalaks: sanchalaks.map((s) => ({
                ...s,
                id: s._id,
                surveyorCount: countsById.get(String(s._id))?.total || 0,
                approvedSurveyorCount: countsById.get(String(s._id))?.approved || 0,
            })),
            statusCounts: Object.fromEntries(statusCounts.map((c) => [c._id, c.count])),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        }, 'Sanchalaks fetched successfully')
    );
});

/**
 * @desc    Sanchalak profile with surveyor, farmer and commission stats
 * @route   GET /api/admin/sanchalaks/:id
 * @access  Private (Admin)
 */
export const getSanchalakById = asyncHandler(async (req, res) => {
    const sanchalak = await Sanchalak.findById(req.params.id).lean();
    if (!sanchalak) throw new ApiError(404, 'Sanchalak not found');

    const [surveyorRows, stats] = await Promise.all([
        Surveyor.aggregate([{ $match: { sanchalak: sanchalak._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        profileStats('sanchalak', sanchalak._id),
    ]);
    const surveyors = Object.fromEntries(surveyorRows.map((row) => [row._id, row.count]));
    surveyors.total = surveyorRows.reduce((sum, row) => sum + row.count, 0);

    res.status(200).json(new ApiResponse(200, { ...sanchalak, id: sanchalak._id, surveyors, ...stats }, 'Sanchalak fetched successfully'));
});

/**
 * @desc    Approve, reject or suspend a Sanchalak
 * @route   PATCH /api/admin/sanchalaks/:id/status
 * @access  Private (Admin)
 */
export const updateSanchalakStatus = asyncHandler(async (req, res) => {
    const { status, reason = '' } = req.body;
    const sanchalak = await Sanchalak.findById(req.params.id);
    if (!sanchalak) throw new ApiError(404, 'Sanchalak not found');

    await applyStatusChange({ account: sanchalak, status, reason, adminId: req.user.id, label: 'Sanchalak', role: 'sanchalak' });

    res.status(200).json(new ApiResponse(200, sanchalak, `Sanchalak ${status} successfully`));
});

// ─── Surveyors ────────────────────────────────────────────────────────────────

/**
 * @desc    List Surveyors, optionally for one Sanchalak
 * @route   GET /api/admin/surveyors
 * @access  Private (Admin)
 */
export const getAllSurveyors = asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const filter = buildListFilter(req.query, 'surveyorCode');
    if (req.query.sanchalak) filter.sanchalak = new mongoose.Types.ObjectId(req.query.sanchalak);

    const [surveyors, total, statusCounts] = await Promise.all([
        Surveyor.find(filter)
            .populate('sanchalak', 'name kendraName sanchalakCode status')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Surveyor.countDocuments(filter),
        Surveyor.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const farmerCounts = await FarmerRegistration.aggregate([
        { $match: { surveyor: { $in: surveyors.map((s) => s._id) } } },
        { $group: { _id: '$surveyor', total: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } } } },
    ]);
    const farmersById = new Map(farmerCounts.map((c) => [String(c._id), c]));

    res.status(200).json(
        new ApiResponse(200, {
            surveyors: surveyors.map((s) => ({
                ...s,
                id: s._id,
                farmerCount: farmersById.get(String(s._id))?.total || 0,
                approvedFarmerCount: farmersById.get(String(s._id))?.approved || 0,
            })),
            statusCounts: Object.fromEntries(statusCounts.map((c) => [c._id, c.count])),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        }, 'Surveyors fetched successfully')
    );
});

/**
 * @desc    Surveyor profile with their Sanchalak, farmer and commission stats
 * @route   GET /api/admin/surveyors/:id
 * @access  Private (Admin)
 */
export const getSurveyorById = asyncHandler(async (req, res) => {
    const surveyor = await Surveyor.findById(req.params.id)
        .populate('sanchalak', 'name kendraName sanchalakCode status phone')
        .lean();
    if (!surveyor) throw new ApiError(404, 'Surveyor not found');

    const stats = await profileStats('surveyor', surveyor._id);
    res.status(200).json(new ApiResponse(200, { ...surveyor, id: surveyor._id, ...stats }, 'Surveyor fetched successfully'));
});

/**
 * @desc    Approve, reject or suspend a Surveyor
 * @route   PATCH /api/admin/surveyors/:id/status
 * @access  Private (Admin)
 */
export const updateSurveyorStatus = asyncHandler(async (req, res) => {
    const { status, reason = '' } = req.body;
    const surveyor = await Surveyor.findById(req.params.id).populate('sanchalak', 'status isActive name');
    if (!surveyor) throw new ApiError(404, 'Surveyor not found');

    if (status === 'approved' && (surveyor.sanchalak?.status !== 'approved' || !surveyor.sanchalak?.isActive)) {
        throw new ApiError(400, 'Approve this surveyor\'s Sanchalak first.');
    }

    await applyStatusChange({ account: surveyor, status, reason, adminId: req.user.id, label: 'Surveyor', role: 'surveyor' });

    res.status(200).json(new ApiResponse(200, surveyor, `Surveyor ${status} successfully`));
});

// ─── Commission Rates ─────────────────────────────────────────────────────────

/**
 * @desc    Get field commission rates (₹ per approved farmer)
 * @route   GET /api/admin/field-commission
 * @access  Private (Admin)
 */
export const getCommissionRates = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, await getFieldCommissionRates(), 'Commission rates fetched'));
});

/**
 * @desc    Update field commission rates; applies to farmers approved from now on
 * @route   PUT /api/admin/field-commission
 * @access  Private (Admin)
 */
export const updateCommissionRates = asyncHandler(async (req, res) => {
    const rates = await saveFieldCommissionRates(req.body);
    res.status(200).json(new ApiResponse(200, rates, 'Commission rates updated'));
});
