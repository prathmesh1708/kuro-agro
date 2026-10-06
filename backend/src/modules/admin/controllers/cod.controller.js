import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import User from '../../../models/User.model.js';
import Order from '../../../models/Order.model.js';
import CodStats from '../../../models/CodStats.model.js';
import * as codStatsService from '../../../services/codStats.service.js';

/**
 * Get all users with COD statistics and risk evaluations
 */
export const getCodUsers = asyncHandler(async (req, res) => {
    const { search, status, page = 1, limit = 10 } = req.query;
    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 10;
    const skip = (numericPage - 1) * numericLimit;

    // Search users by name, email, phone
    const userQuery = { role: 'customer' };
    if (search) {
        userQuery.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
        ];
    }

    const customers = await User.find(userQuery).select('name email phone isActive').lean();
    const customerIds = customers.map(c => c._id);

    // Get COD stats for these customers
    const statsQuery = { userId: { $in: customerIds } };
    if (status) {
        if (status === 'blacklisted') {
            statsQuery.isCodBlacklisted = true;
        } else if (status === 'warned') {
            statsQuery.warningCount = { $gt: 0 };
        } else if (status === 'high_risk') {
            statsQuery.cancellationRate = { $gte: 40 };
            statsQuery.totalCodOrders = { $gte: 3 };
        }
    }

    const total = await CodStats.countDocuments(statsQuery);
    const codStatsList = await CodStats.find(statsQuery)
        .populate('userId', 'name email phone isActive')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(numericLimit)
        .lean();

    // Map any customers who don't have COD stats yet (only if status filter is not active)
    let results = [...codStatsList];
    if (!status && results.length < numericLimit && customers.length > 0) {
        const statsUserIds = new Set(codStatsList.map(s => s.userId?._id?.toString()));
        const missingCustomers = customers.filter(c => !statsUserIds.has(c._id.toString()));
        
        for (const customer of missingCustomers) {
            if (results.length >= numericLimit) break;
            results.push({
                userId: customer,
                totalCodOrders: 0,
                deliveredCodOrders: 0,
                cancelledCodOrders: 0,
                cancellationRate: 0,
                warningCount: 0,
                warnings: [],
                isCodBlacklisted: false,
                blacklistHistory: []
            });
        }
    }

    res.status(200).json(
        new ApiResponse(200, {
            users: results,
            pagination: {
                total,
                page: numericPage,
                limit: numericLimit,
                pages: Math.ceil(total / numericLimit)
            }
        }, 'COD abuse monitoring list fetched.')
    );
});

/**
 * Get detailed timeline for a user (combining orders, warning events, blacklist actions)
 */
export const getUserCodTimeline = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const [user, orders, stats] = await Promise.all([
        User.findById(userId).select('name email phone').lean(),
        Order.find({ userId, isDeleted: { $ne: true } })
            .select('orderId paymentMethod status total createdAt cancelledAt cancellationReason')
            .sort({ createdAt: -1 })
            .lean(),
        CodStats.findOne({ userId })
            .populate('warnings.issuedBy', 'name email')
            .populate('blacklistHistory.adminId', 'name email')
            .lean()
    ]);

    if (!user) throw new ApiError(404, 'User not found.');

    // Build chronological timeline
    const timeline = [];

    // Add orders to timeline
    orders.forEach(order => {
        timeline.push({
            type: 'order',
            timestamp: order.createdAt,
            data: {
                orderId: order.orderId,
                paymentMethod: order.paymentMethod,
                status: order.status,
                total: order.total,
                cancelledAt: order.cancelledAt,
                cancellationReason: order.cancellationReason
            }
        });
    });

    // Add warnings to timeline
    if (stats && stats.warnings) {
        stats.warnings.forEach(warning => {
            timeline.push({
                type: 'warning',
                timestamp: warning.issuedAt,
                data: {
                    reason: warning.reason,
                    issuedBy: warning.issuedBy?.name || 'Admin'
                }
            });
        });
    }

    // Add blacklist events to timeline
    if (stats && stats.blacklistHistory) {
        stats.blacklistHistory.forEach(event => {
            timeline.push({
                type: 'blacklist_event',
                timestamp: event.timestamp,
                data: {
                    action: event.action,
                    reason: event.reason,
                    adminName: event.adminId?.name || 'Admin'
                }
            });
        });
    }

    // Sort timeline: newest first
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json(
        new ApiResponse(200, {
            user,
            stats: stats || {
                totalCodOrders: 0,
                deliveredCodOrders: 0,
                cancelledCodOrders: 0,
                cancellationRate: 0,
                warningCount: 0,
                isCodBlacklisted: false
            },
            timeline
        }, 'User COD timeline fetched.')
    );
});

/**
 * Issue warning to user
 */
export const issueUserWarning = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { reason } = req.body;
    if (!reason) throw new ApiError(400, 'Reason is required.');

    const stats = await codStatsService.issueWarning(userId, reason, req.user.id);
    res.status(200).json(new ApiResponse(200, stats, 'Warning issued successfully.'));
});

/**
 * Update COD blacklist status (blacklist/whitelist)
 */
export const toggleUserBlacklist = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { isBlacklisted, reason } = req.body;
    
    if (isBlacklisted === undefined) throw new ApiError(400, 'isBlacklisted status is required.');
    if (!reason) throw new ApiError(400, 'Reason is required.');

    const stats = await codStatsService.toggleBlacklist(userId, isBlacklisted, reason, req.user.id);
    res.status(200).json(new ApiResponse(200, stats, `User has been ${isBlacklisted ? 'blacklisted' : 'whitelisted'} successfully.`));
});
