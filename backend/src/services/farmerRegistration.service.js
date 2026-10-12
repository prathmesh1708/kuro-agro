import mongoose from 'mongoose';
import FarmerRegistration from '../models/FarmerRegistration.model.js';
import ApiError from '../utils/ApiError.js';
import { decryptField, hashField, maskAadhaar } from '../utils/fieldCrypto.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Aggregation pipelines do not cast string ids, so cast scope ids up front.
export const castScope = (scope = {}) =>
    Object.fromEntries(
        Object.entries(scope).map(([key, value]) => [
            key,
            ['surveyor', 'sanchalak'].includes(key) && typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value,
        ])
    );

const PEOPLE_POPULATE = [
    { path: 'surveyor', select: 'name phone surveyorCode' },
    { path: 'sanchalak', select: 'name kendraName sanchalakCode' },
];

/**
 * Shape a registration for API output. Only admins get the full Aadhaar and both commission amounts;
 * surveyors and sanchalaks see their own commission on the Profile commission screen instead.
 */
export const serializeRegistration = (doc, { includeAadhaar = false, includeCommission = false } = {}) => {
    const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    const { aadhaarEnc, aadhaarHash, __v, commission, ...rest } = plain;
    return {
        ...rest,
        ...(includeCommission && { commission }),
        id: plain._id,
        aadhaarMasked: maskAadhaar(plain.aadhaarLast4),
        ...(includeAadhaar && aadhaarEnc && { aadhaar: decryptField(aadhaarEnc) }),
    };
};

/**
 * Paginated list scoped by `scope` (e.g. { surveyor: id } or { sanchalak: id } or {} for admin).
 */
export const listRegistrations = async (scope, { page = 1, limit = 10, status, search, surveyor, sanchalak } = {}) => {
    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 10;
    const filter = castScope(scope);
    if (surveyor) filter.surveyor = new mongoose.Types.ObjectId(surveyor);
    if (sanchalak) filter.sanchalak = new mongoose.Types.ObjectId(sanchalak);
    const countFilter = { ...filter };
    if (status) filter.status = status;
    if (search) {
        const pattern = { $regex: escapeRegex(search), $options: 'i' };
        filter.$or = [
            { name: pattern },
            { fatherName: pattern },
            { mobile: pattern },
            { village: pattern },
            { district: pattern },
            { registrationCode: pattern },
            { aadhaarLast4: pattern },
        ];
    }

    const [registrations, total, statusCounts] = await Promise.all([
        FarmerRegistration.find(filter)
            .populate(PEOPLE_POPULATE)
            .sort({ createdAt: -1 })
            .skip((numericPage - 1) * numericLimit)
            .limit(numericLimit)
            .lean(),
        FarmerRegistration.countDocuments(filter),
        FarmerRegistration.aggregate([{ $match: countFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    return {
        registrations: registrations.map((r) => serializeRegistration(r)),
        statusCounts: Object.fromEntries(statusCounts.map((c) => [c._id, c.count])),
        pagination: { total, page: numericPage, limit: numericLimit, pages: Math.ceil(total / numericLimit) },
    };
};

export const getRegistrationOrThrow = async (filter, { includeAadhaar = false } = {}) => {
    const query = FarmerRegistration.findOne(filter).populate(PEOPLE_POPULATE);
    if (includeAadhaar) query.select('+aadhaarEnc');
    const registration = await query;
    if (!registration) throw new ApiError(404, 'Farmer registration not found.');
    return registration;
};

export const countByStatus = async (scope) => {
    const rows = await FarmerRegistration.aggregate([{ $match: castScope(scope) }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
    const counts = { submitted: 0, approved: 0, rejected: 0 };
    rows.forEach((row) => { counts[row._id] = row.count; });
    return { ...counts, total: counts.submitted + counts.approved + counts.rejected };
};

/**
 * A farmer can be registered once: block when an open (submitted/approved) registration
 * already uses the same Aadhaar or mobile.
 */
export const assertNotDuplicate = async ({ aadhaar, mobile, excludeId }) => {
    const open = { status: { $in: ['submitted', 'approved'] }, ...(excludeId && { _id: { $ne: excludeId } }) };
    const [byAadhaar, byMobile] = await Promise.all([
        FarmerRegistration.exists({ ...open, aadhaarHash: hashField(aadhaar) }),
        FarmerRegistration.exists({ ...open, mobile }),
    ]);
    if (byAadhaar) throw new ApiError(409, 'This Aadhaar number is already registered.');
    if (byMobile) throw new ApiError(409, 'This mobile number is already registered for another farmer.');
};
