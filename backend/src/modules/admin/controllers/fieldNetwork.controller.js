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
import { countByStatus, cropSummaryBySanchalak } from '../../../services/farmerRegistration.service.js';
import { getSanchalakStockSummary } from '../../../services/produceTrade.service.js';
import { EXPORT_ROW_LIMIT, formatExportDate, sendExport } from '../../../services/export.service.js';

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

const surveyorFilter = (query) => {
    const filter = buildListFilter(query, 'surveyorCode');
    if (query.sanchalak) filter.sanchalak = new mongoose.Types.ObjectId(query.sanchalak);
    return filter;
};

// Adds surveyorCount / approvedSurveyorCount and the crops their farmers grow to each Sanchalak.
const withSurveyorCounts = async (sanchalaks) => {
    const ids = sanchalaks.map((s) => s._id);
    const [counts, crops] = await Promise.all([
        Surveyor.aggregate([
            { $match: { sanchalak: { $in: ids } } },
            { $group: { _id: '$sanchalak', total: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } } } },
        ]),
        cropSummaryBySanchalak(ids),
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c]));
    return sanchalaks.map((s) => ({
        ...s,
        id: s._id,
        surveyorCount: byId.get(String(s._id))?.total || 0,
        approvedSurveyorCount: byId.get(String(s._id))?.approved || 0,
        crops: crops.get(String(s._id)) || [],
    }));
};

// Adds farmerCount / approvedFarmerCount to each Surveyor.
const withFarmerCounts = async (surveyors) => {
    const counts = await FarmerRegistration.aggregate([
        { $match: { surveyor: { $in: surveyors.map((s) => s._id) } } },
        { $group: { _id: '$surveyor', total: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } } } },
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c]));
    return surveyors.map((s) => ({
        ...s,
        id: s._id,
        farmerCount: byId.get(String(s._id))?.total || 0,
        approvedFarmerCount: byId.get(String(s._id))?.approved || 0,
    }));
};

// Filter description printed in exported files.
const filterMeta = ({ status, search }) => [
    ['Status', status || 'All'],
    ...(search ? [['Search', search]] : []),
];

const addressCols = [
    { header: 'Village', value: (r) => r.address?.village, width: 14 },
    { header: 'Block', value: (r) => r.address?.block, width: 12 },
    { header: 'District', value: (r) => r.address?.district, width: 12 },
    { header: 'State', value: (r) => r.address?.state, width: 12, pdf: false },
    { header: 'Pincode', value: (r) => r.address?.pincode, width: 9, pdf: false },
];

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

    // Accounts registered by phone may have no email; the in-app notification below covers them.
    if (account.email) {
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

    res.status(200).json(
        new ApiResponse(200, {
            sanchalaks: await withSurveyorCounts(sanchalaks),
            statusCounts: Object.fromEntries(statusCounts.map((c) => [c._id, c.count])),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        }, 'Sanchalaks fetched successfully')
    );
});

/**
 * @desc    Download the Sanchalak list (same filters as the list) as Excel or PDF
 * @route   GET /api/admin/sanchalaks/export?format=xlsx|pdf
 * @access  Private (Admin)
 */
export const exportSanchalaks = asyncHandler(async (req, res) => {
    const sanchalaks = await Sanchalak.find(buildListFilter(req.query, 'sanchalakCode'))
        .sort({ createdAt: -1 })
        .limit(EXPORT_ROW_LIMIT)
        .lean();

    await sendExport(res, {
        format: req.query.format,
        title: 'Sanchalaks',
        filename: 'sanchalaks',
        meta: filterMeta(req.query),
        rows: await withSurveyorCounts(sanchalaks),
        columns: [
            { header: 'Sanchalak ID', value: (r) => r.sanchalakCode, width: 12 },
            { header: 'Name', value: (r) => r.name, width: 18 },
            { header: 'Kendra', value: (r) => r.kendraName, width: 20 },
            { header: 'Phone', value: (r) => r.phone, width: 12 },
            { header: 'Email', value: (r) => r.email, width: 24, pdf: false },
            ...addressCols,
            { header: 'Surveyors', value: (r) => r.surveyorCount, width: 9 },
            { header: 'Approved Surveyors', value: (r) => r.approvedSurveyorCount, width: 10 },
            { header: 'Crops (farmers)', value: (r) => r.crops.map((c) => `${c.name} (${c.farmers})`).join(', '), width: 24 },
            { header: 'Status', value: (r) => r.status, width: 10 },
            { header: 'Reason', value: (r) => (r.status !== 'approved' ? r.rejectionReason : ''), width: 18 },
            { header: 'Registered On', value: (r) => formatExportDate(r.createdAt), width: 12 },
            { header: 'Approved On', value: (r) => formatExportDate(r.approvedAt), width: 12, pdf: false },
        ],
    });
});

/**
 * @desc    Sanchalak profile with surveyor, farmer, commission and warehouse stats
 * @route   GET /api/admin/sanchalaks/:id
 * @access  Private (Admin)
 */
export const getSanchalakById = asyncHandler(async (req, res) => {
    const sanchalak = await Sanchalak.findById(req.params.id).lean();
    if (!sanchalak) throw new ApiError(404, 'Sanchalak not found');

    const [surveyorRows, stats, stock, crops] = await Promise.all([
        Surveyor.aggregate([{ $match: { sanchalak: sanchalak._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        profileStats('sanchalak', sanchalak._id),
        getSanchalakStockSummary(sanchalak._id),
        cropSummaryBySanchalak([sanchalak._id]),
    ]);
    const surveyors = Object.fromEntries(surveyorRows.map((row) => [row._id, row.count]));
    surveyors.total = surveyorRows.reduce((sum, row) => sum + row.count, 0);

    res.status(200).json(new ApiResponse(200, { ...sanchalak, id: sanchalak._id, surveyors, ...stats, stock, crops: crops.get(String(sanchalak._id)) || [] }, 'Sanchalak fetched successfully'));
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
    const filter = surveyorFilter(req.query);

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

    res.status(200).json(
        new ApiResponse(200, {
            surveyors: await withFarmerCounts(surveyors),
            statusCounts: Object.fromEntries(statusCounts.map((c) => [c._id, c.count])),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        }, 'Surveyors fetched successfully')
    );
});

/**
 * @desc    Download the Surveyor list (same filters as the list, optionally one Sanchalak's) as Excel or PDF
 * @route   GET /api/admin/surveyors/export?format=xlsx|pdf
 * @access  Private (Admin)
 */
export const exportSurveyors = asyncHandler(async (req, res) => {
    const surveyors = await Surveyor.find(surveyorFilter(req.query))
        .populate('sanchalak', 'name kendraName sanchalakCode')
        .sort({ createdAt: -1 })
        .limit(EXPORT_ROW_LIMIT)
        .lean();

    const meta = filterMeta(req.query);
    if (req.query.sanchalak) {
        const sanchalak = await Sanchalak.findById(req.query.sanchalak).select('kendraName sanchalakCode').lean();
        if (sanchalak) meta.unshift(['Kendra', `${sanchalak.kendraName} (${sanchalak.sanchalakCode})`]);
    }

    await sendExport(res, {
        format: req.query.format,
        title: 'Surveyors',
        filename: 'surveyors',
        meta,
        rows: await withFarmerCounts(surveyors),
        columns: [
            { header: 'Surveyor ID', value: (r) => r.surveyorCode, width: 12 },
            { header: 'Name', value: (r) => r.name, width: 18 },
            { header: 'Phone', value: (r) => r.phone, width: 12 },
            { header: 'Email', value: (r) => r.email, width: 24, pdf: false },
            { header: 'Kendra', value: (r) => r.sanchalak?.kendraName, width: 18 },
            { header: 'Sanchalak', value: (r) => (r.sanchalak ? `${r.sanchalak.name} (${r.sanchalak.sanchalakCode})` : ''), width: 20 },
            ...addressCols,
            { header: 'Farmers', value: (r) => r.farmerCount, width: 8 },
            { header: 'Approved Farmers', value: (r) => r.approvedFarmerCount, width: 9 },
            { header: 'Status', value: (r) => r.status, width: 10 },
            { header: 'Reason', value: (r) => (r.status !== 'approved' ? r.rejectionReason : ''), width: 18 },
            { header: 'Registered On', value: (r) => formatExportDate(r.createdAt), width: 12 },
            { header: 'Approved On', value: (r) => formatExportDate(r.approvedAt), width: 12, pdf: false },
        ],
    });
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
