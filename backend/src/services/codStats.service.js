import Order from '../models/Order.model.js';
import CodStats from '../models/CodStats.model.js';
import User from '../models/User.model.js';
import mongoose from 'mongoose';

/**
 * Recalculate and update the COD statistics for a given user.
 * @param {string|mongoose.Types.ObjectId} userId 
 */
export const updateStatsForUser = async (userId) => {
    if (!userId) return null;

    // Aggregate COD order data
    const stats = await Order.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                paymentMethod: 'cod',
                isDeleted: { $ne: true }
            }
        },
        {
            $group: {
                _id: '$userId',
                totalCod: { $sum: 1 },
                deliveredCod: {
                    $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
                },
                cancelledCod: {
                    $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                }
            }
        }
    ]);

    const userStats = stats[0] || { totalCod: 0, deliveredCod: 0, cancelledCod: 0 };

    let doc = await CodStats.findOne({ userId });
    if (!doc) {
        doc = new CodStats({ userId });
    }

    doc.totalCodOrders = userStats.totalCod;
    doc.deliveredCodOrders = userStats.deliveredCod;
    doc.cancelledCodOrders = userStats.cancelledCod;

    await doc.save();
    return doc;
};

/**
 * Issue a warning to a customer.
 * @param {string} userId 
 * @param {string} reason 
 * @param {string} adminId 
 */
export const issueWarning = async (userId, reason, adminId) => {
    let doc = await CodStats.findOne({ userId });
    if (!doc) {
        doc = new CodStats({ userId });
    }

    doc.warnings.push({
        reason,
        issuedBy: adminId,
        issuedAt: new Date()
    });
    doc.warningCount = doc.warnings.length;

    await doc.save();
    return doc;
};

/**
 * Toggle the COD blacklist status for a customer.
 * @param {string} userId 
 * @param {boolean} isBlacklisted 
 * @param {string} reason 
 * @param {string} adminId 
 */
export const toggleBlacklist = async (userId, isBlacklisted, reason, adminId) => {
    let doc = await CodStats.findOne({ userId });
    if (!doc) {
        doc = new CodStats({ userId });
    }

    doc.isCodBlacklisted = isBlacklisted;
    doc.blacklistHistory.push({
        action: isBlacklisted ? 'blacklisted' : 'whitelisted',
        reason,
        adminId,
        timestamp: new Date()
    });

    await doc.save();
    return doc;
};
