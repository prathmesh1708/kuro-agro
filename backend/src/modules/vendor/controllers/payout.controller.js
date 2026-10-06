import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Settlement from '../../../models/Settlement.model.js';
import Vendor from '../../../models/Vendor.model.js';
import { createNotification } from '../../../services/notification.service.js';

// GET /api/vendor/payouts/summary
export const getPayoutSummary = asyncHandler(async (req, res) => {
    const settlements = await Settlement.find({ vendorId: req.user.id });

    let releasedAmount = 0;
    let pendingAmount = 0;
    let onHoldAmount = 0;
    const holdReasons = [];

    for (const s of settlements) {
        if (s.status === 'released' || s.status === 'completed') {
            releasedAmount += s.netPayable || 0;
        } else if (s.status === 'pending') {
            pendingAmount += s.netPayable || 0;
        } else if (s.status === 'on_hold') {
            onHoldAmount += s.netPayable || 0;
            if (s.reason && !holdReasons.includes(s.reason)) {
                holdReasons.push(s.reason);
            }
        }
    }

    res.status(200).json(
        new ApiResponse(
            200,
            {
                releasedAmount: parseFloat(releasedAmount.toFixed(2)),
                pendingAmount: parseFloat(pendingAmount.toFixed(2)),
                onHoldAmount: parseFloat(onHoldAmount.toFixed(2)),
                reason: holdReasons.join(', ') || 'Bank Details Pending',
            },
            'Payout summary fetched.'
        )
    );
});

// GET /api/vendor/payouts/settlements
export const getVendorSettlements = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Number(limit) || 20);
    const skip = (numericPage - 1) * numericLimit;

    const filter = { vendorId: req.user.id };
    if (status && status !== 'all') {
        if (status === 'released') {
            filter.status = { $in: ['released', 'completed'] };
        } else {
            filter.status = status;
        }
    }

    const [settlements, total] = await Promise.all([
        Settlement.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(numericLimit)
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

// GET /api/vendor/payouts/bank-details
export const getVendorBankDetails = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.user.id)
        .select('+bankDetails');
    
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    res.status(200).json(
        new ApiResponse(200, vendor.bankDetails || {}, 'Bank details fetched.')
    );
});

// PUT /api/vendor/payouts/bank-details
export const updateVendorBankDetails = asyncHandler(async (req, res) => {
    const {
        accountName,
        accountNumber,
        confirmAccountNumber,
        bankName,
        ifscCode,
        branchName,
        upiId,
        cancelledCheque,
        panNumber,
        gstNumber,
    } = req.body;

    const cleanAccountName = String(accountName || '').trim();
    const cleanAccountNumber = String(accountNumber || '').trim();
    const cleanConfirmAccountNumber = confirmAccountNumber ? String(confirmAccountNumber).trim() : cleanAccountNumber;
    const cleanBankName = String(bankName || '').trim();
    const normalizedIfsc = String(ifscCode || '').trim().toUpperCase();

    // Required fields check
    if (!cleanAccountName || !cleanAccountNumber || !cleanBankName || !normalizedIfsc) {
        throw new ApiError(400, 'Account Name, Account Number, Bank Name, and IFSC Code are required.');
    }

    // Account Number match check if confirmAccountNumber is explicitly provided
    if (confirmAccountNumber && cleanAccountNumber !== cleanConfirmAccountNumber) {
        throw new ApiError(400, 'Account numbers do not match.');
    }

    // IFSC validation (Standard Indian IFSC format)
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(normalizedIfsc)) {
        throw new ApiError(400, 'Invalid IFSC code format (e.g., BARB0JODHPU).');
    }

    const updates = {
        'bankDetails.accountName': cleanAccountName,
        'bankDetails.accountNumber': cleanAccountNumber,
        'bankDetails.bankName': cleanBankName,
        'bankDetails.ifscCode': normalizedIfsc,
        'bankDetails.branchName': String(branchName || '').trim(),
        'bankDetails.upiId': String(upiId || '').trim(),
        'bankDetails.cancelledCheque': String(cancelledCheque || '').trim(),
        'bankDetails.panNumber': String(panNumber || '').trim().toUpperCase(),
        'bankDetails.gstNumber': String(gstNumber || '').trim().toUpperCase(),
        'bankDetails.status': 'pending', // Pending Verification
        'bankDetails.remarks': '',
        'bankDetails.submittedAt': new Date(),
    };

    const vendor = await Vendor.findByIdAndUpdate(
        req.user.id,
        { $set: updates },
        { new: true, runValidators: true }
    ).select('-password -otp -otpExpiry');

    // Notify seller
    await createNotification({
        recipientId: vendor._id,
        recipientType: 'vendor',
        title: 'Bank Details Submitted',
        message: 'Your bank details have been submitted and are pending verification.',
        type: 'system',
    });

    await createNotification({
        recipientId: vendor._id,
        recipientType: 'vendor',
        title: 'Verification Pending',
        message: 'Administrator has been notified to verify your bank details.',
        type: 'system',
    });

    // Update all ON HOLD settlements where bank details are pending to 'Bank Details Pending Verification'
    await Settlement.updateMany(
        {
            vendorId: vendor._id,
            status: 'on_hold',
            reason: { $in: ['Bank Details Pending', 'Bank Details Rejected', 'Bank Details Action Required'] }
        },
        {
            $set: { reason: 'Bank Details Pending Verification' }
        }
    );

    res.status(200).json(new ApiResponse(200, vendor, 'Bank details submitted for verification.'));
});
