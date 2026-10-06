import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Settlement from '../../../models/Settlement.model.js';
import Vendor from '../../../models/Vendor.model.js';
import Commission from '../../../models/Commission.model.js';
import { createNotification } from '../../../services/notification.service.js';

// GET /api/admin/payouts/vendors
export const getVendorsPayoutList = asyncHandler(async (req, res) => {
    const vendors = await Vendor.find()
        .select('+bankDetails')
        .sort({ createdAt: -1 });

    const result = [];
    for (const vendor of vendors) {
        const settlements = await Settlement.find({ vendorId: vendor._id });
        let pendingAmount = 0;
        let releasedAmount = 0;
        let onHoldAmount = 0;

        for (const s of settlements) {
            if (s.status === 'released' || s.status === 'completed') {
                releasedAmount += s.netPayable || 0;
            } else if (s.status === 'pending') {
                pendingAmount += s.netPayable || 0;
            } else if (s.status === 'on_hold') {
                onHoldAmount += s.netPayable || 0;
            }
        }

        result.push({
            id: vendor._id,
            name: vendor.name,
            storeName: vendor.storeName,
            email: vendor.email,
            bankDetails: vendor.bankDetails || {},
            bankStatus: vendor.bankDetails?.status || 'not_submitted',
            verificationStatus: vendor.bankDetails?.status || 'not_submitted',
            pendingAmount: parseFloat(pendingAmount.toFixed(2)),
            releasedAmount: parseFloat(releasedAmount.toFixed(2)),
            onHoldAmount: parseFloat(onHoldAmount.toFixed(2)),
        });
    }

    res.status(200).json(
        new ApiResponse(200, result, 'Vendor payouts list fetched.')
    );
});

// PATCH /api/admin/payouts/vendors/:id/bank-status
export const updateVendorBankStatus = asyncHandler(async (req, res) => {
    const { status, remarks } = req.body;
    const allowed = ['approved', 'rejected', 'action_required', 'pending'];
    if (!allowed.includes(status)) {
        throw new ApiError(400, `Status must be one of: ${allowed.join(', ')}`);
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    vendor.bankDetails = vendor.bankDetails || {};
    vendor.bankDetails.status = status;
    vendor.bankDetails.remarks = remarks || '';

    // Record timeline audit log matching existing system conventions
    vendor.verificationTimeline.push({
        status: `bank_${status}`,
        remarks: remarks || `Bank details status updated to ${status}.`,
        updatedBy: req.user.id,
        updatedByName: req.user.name || 'Admin',
        updatedAt: new Date()
    });

    await vendor.save();

    // Trigger settlement status transitions depending on bank verification results
    if (status === 'approved') {
        // Release holds
        await Settlement.updateMany(
            {
                vendorId: vendor._id,
                status: 'on_hold',
                reason: { $in: ['Bank Details Pending', 'Bank Details Pending Verification', 'Bank Details Rejected', 'Bank Details Action Required'] }
            },
            {
                $set: { status: 'pending', reason: '' }
            }
        );

        await createNotification({
            recipientId: vendor._id,
            recipientType: 'vendor',
            title: 'Verification Approved',
            message: 'Your bank details have been verified and approved successfully.',
            type: 'system'
        });
    } else if (status === 'rejected') {
        // Revert to on hold
        await Settlement.updateMany(
            {
                vendorId: vendor._id,
                status: 'pending'
            },
            {
                $set: { status: 'on_hold', reason: 'Bank Details Rejected' }
            }
        );

        await createNotification({
            recipientId: vendor._id,
            recipientType: 'vendor',
            title: 'Verification Rejected',
            message: `Your bank details verification was rejected. Reason: ${remarks || 'Invalid details'}`,
            type: 'system'
        });
    } else if (status === 'action_required') {
        // Revert to on hold
        await Settlement.updateMany(
            {
                vendorId: vendor._id,
                status: 'pending'
            },
            {
                $set: { status: 'on_hold', reason: 'Bank Details Action Required' }
            }
        );

        await createNotification({
            recipientId: vendor._id,
            recipientType: 'vendor',
            title: 'Request Changes',
            message: `Action required on your bank details. Remarks: ${remarks || 'Please update details'}`,
            type: 'system'
        });
    }

    res.status(200).json(
        new ApiResponse(200, vendor, `Bank details verification updated to ${status}.`)
    );
});

// GET /api/admin/payouts/settlements
export const getSettlementsList = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20, vendorId } = req.query;
    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Number(limit) || 20);
    const skip = (numericPage - 1) * numericLimit;

    const filter = {};
    if (status && status !== 'all') {
        if (status === 'released') {
            filter.status = { $in: ['released', 'completed'] };
        } else {
            filter.status = status;
        }
    }
    if (vendorId) {
        filter.vendorId = vendorId;
    }

    const [settlements, total] = await Promise.all([
        Settlement.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(numericLimit)
            .populate('vendorId', 'name storeName email')
            .populate('orderIds', 'orderId total status'),
        Settlement.countDocuments(filter),
    ]);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                settlements,
                total,
                page: numericPage,
                pages: Math.ceil(total / numericLimit),
            },
            'Settlements fetched successfully.'
        )
    );
});

// PATCH /api/admin/payouts/settlements/:id/status
export const updateSettlementStatus = asyncHandler(async (req, res) => {
    const { action, transactionId, notes } = req.body;
    const { id } = req.params;

    const settlement = await Settlement.findById(id);
    if (!settlement) throw new ApiError(404, 'Settlement not found.');

    if (action === 'release') {
        settlement.status = 'released';
        settlement.transactionId = transactionId || '';
        settlement.notes = notes || '';
        settlement.reason = '';

        await settlement.save();

        // Mark associated commissions as paid
        if (settlement.commissionIds && settlement.commissionIds.length > 0) {
            await Commission.updateMany(
                { _id: { $in: settlement.commissionIds } },
                { $set: { status: 'paid', paidAt: new Date() } }
            );
        }

        await createNotification({
            recipientId: settlement.vendorId,
            recipientType: 'vendor',
            title: 'Settlement Released',
            message: `A settlement of Rs. ${settlement.netPayable} has been released. Transaction ID: ${transactionId || 'N/A'}.`,
            type: 'system'
        });
    } else if (action === 'hold') {
        settlement.status = 'on_hold';
        settlement.reason = notes || 'Held by administrator';

        await settlement.save();

        await createNotification({
            recipientId: settlement.vendorId,
            recipientType: 'vendor',
            title: 'Settlement On Hold',
            message: `Your settlement ID ${settlement._id} has been placed on hold. Reason: ${notes || 'Manual Hold'}.`,
            type: 'system'
        });
    } else {
        throw new ApiError(400, 'Invalid action. Action must be either "release" or "hold".');
    }

    res.status(200).json(
        new ApiResponse(200, settlement, `Settlement status updated.`)
    );
});
