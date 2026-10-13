import ApiError from '../utils/ApiError.js';
import User from '../models/User.model.js';
import Vendor from '../models/Vendor.model.js';
import DeliveryBoy from '../models/DeliveryBoy.model.js';
import Admin from '../models/Admin.model.js';
import Sanchalak from '../models/Sanchalak.model.js';
import Surveyor from '../models/Surveyor.model.js';
import Kisan from '../models/Kisan.model.js';
import {
    getFieldAccountBlockReason,
    getSurveyorSanchalakBlockReason,
} from '../services/fieldAccountAuth.service.js';

const FIELD_ACCOUNT_FIELDS = 'status isActive isPhoneVerified rejectionReason';

/**
 * Role-based authorization middleware
 * Usage: authorize('admin'), authorize('vendor'), authorize('customer', 'admin')
 */
export const authorize = (...roles) =>
    (req, res, next) => {
        if (!req.user) {
            return next(new ApiError(401, 'Authentication required.'));
        }
        if (!roles.includes(req.user.role)) {
            return next(new ApiError(403, `Access denied. Required role: ${roles.join(' or ')}`));
        }
        next();
    };

/**
 * Enforce latest account state on every protected request.
 * Prevents stale tokens from bypassing suspension/deactivation.
 */
export const enforceAccountStatus = async (req, res, next) => {
    try {
        if (!req.user?.id || !req.user?.role) {
            return next(new ApiError(401, 'Authentication required.'));
        }

        const role = String(req.user.role).toLowerCase();

        if (role === 'customer') {
            const user = await User.findById(req.user.id).select('isActive isVerified').lean();
            if (!user) return next(new ApiError(401, 'Account not found.'));
            if (!user.isActive) return next(new ApiError(403, 'Account is deactivated. Contact support.'));
            if (!user.isVerified) return next(new ApiError(403, 'Please verify your email first.'));
            return next();
        }

        if (role === 'vendor') {
            const vendor = await Vendor.findById(req.user.id).select('status isVerified').lean();
            if (!vendor) return next(new ApiError(401, 'Account not found.'));
            if (!vendor.isVerified) return next(new ApiError(403, 'Please verify your email first.'));
            
            const isRestrictedPath = 
                req.originalUrl.startsWith('/api/vendor/auth/profile') ||
                req.originalUrl.startsWith('/api/vendor/documents') ||
                req.originalUrl.startsWith('/api/vendor/uploads/image') ||
                req.originalUrl.startsWith('/api/vendor/uploads/images');
            
            if (vendor.status !== 'approved' && !isRestrictedPath) {
                return next(new ApiError(403, `Vendor account is ${vendor.status}.`));
            }
            if (vendor.status === 'suspended') {
                return next(new ApiError(403, 'Vendor account is suspended.'));
            }
            return next();
        }

        if (role === 'delivery') {
            const deliveryBoy = await DeliveryBoy.findById(req.user.id).select('applicationStatus isActive').lean();
            if (!deliveryBoy) return next(new ApiError(401, 'Account not found.'));
            if (deliveryBoy.applicationStatus !== 'approved') {
                return next(new ApiError(403, `Delivery account is ${deliveryBoy.applicationStatus}.`));
            }
            if (!deliveryBoy.isActive) {
                return next(new ApiError(403, 'Account is deactivated. Contact admin.'));
            }
            return next();
        }

        if (role === 'sanchalak') {
            const sanchalak = await Sanchalak.findById(req.user.id).select(FIELD_ACCOUNT_FIELDS).lean();
            const reason = getFieldAccountBlockReason(sanchalak, 'Sanchalak');
            if (reason) return next(new ApiError(reason.status, reason.message));
            return next();
        }

        if (role === 'surveyor') {
            const surveyor = await Surveyor.findById(req.user.id).select(`${FIELD_ACCOUNT_FIELDS} sanchalak`).lean();
            const reason =
                getFieldAccountBlockReason(surveyor, 'Surveyor') ||
                (await getSurveyorSanchalakBlockReason(surveyor.sanchalak));
            if (reason) return next(new ApiError(reason.status, reason.message));
            return next();
        }

        if (role === 'kisan') {
            const kisan = await Kisan.findById(req.user.id).select(FIELD_ACCOUNT_FIELDS).lean();
            const reason = getFieldAccountBlockReason(kisan, 'Kisan');
            if (reason) return next(new ApiError(reason.status, reason.message));
            return next();
        }

        if (role === 'admin' || role === 'superadmin') {
            const admin = await Admin.findById(req.user.id).select('isActive').lean();
            if (!admin) return next(new ApiError(401, 'Account not found.'));
            if (!admin.isActive) return next(new ApiError(403, 'Admin account is deactivated.'));
            return next();
        }

        return next(new ApiError(403, 'Access denied.'));
    } catch (err) {
        return next(err);
    }
};
