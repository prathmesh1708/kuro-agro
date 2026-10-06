import Settlement from '../models/Settlement.model.js';
import Commission from '../models/Commission.model.js';
import Vendor from '../models/Vendor.model.js';

/**
 * Automatically calculates and generates a settlement for a delivered order.
 * Ensures idempotency to avoid duplicate settlements for the same order items.
 * @param {object} order - The delivered order document
 */
export const processSettlementForOrder = async (order) => {
    if (!order || order.status !== 'delivered') return;

    const vendorItems = order.vendorItems || [];
    for (const group of vendorItems) {
        if (!group.vendorId) continue;

        // Check if settlement already exists for this vendor and order
        const existing = await Settlement.findOne({
            vendorId: group.vendorId,
            orderIds: order._id,
        });
        if (existing) continue;

        // Retrieve the vendor details to check bank verification status
        const vendor = await Vendor.findById(group.vendorId);
        if (!vendor) continue;

        // Retrieve the commission document for this order and vendor
        const commissionDoc = await Commission.findOne({
            orderId: order._id,
            vendorId: group.vendorId,
        });

        const subtotal = group.subtotal || 0;
        const commission = commissionDoc 
            ? commissionDoc.commission 
            : parseFloat(((subtotal * (vendor.commissionRate || 10)) / 100).toFixed(2));
        
        // Calculate Platform Fee (e.g., 2% of subtotal) and Shipping Deduction
        const platformFee = parseFloat((subtotal * 0.02).toFixed(2));
        const shippingDeduction = group.shipping || 0;

        // Net Payable = Subtotal - Commission - Platform Fee - Shipping Deduction
        const netPayable = parseFloat(Math.max(0, subtotal - commission - platformFee - shippingDeduction).toFixed(2));

        // Determine Settlement status based on bank details approval
        let status = 'on_hold';
        let reason = 'Bank Details Pending';

        if (vendor.bankDetails && vendor.bankDetails.status) {
            if (vendor.bankDetails.status === 'approved') {
                status = 'pending'; // Ready for Release
                reason = '';
            } else if (vendor.bankDetails.status === 'pending') {
                status = 'on_hold';
                reason = 'Bank Details Pending Verification';
            } else if (vendor.bankDetails.status === 'rejected') {
                status = 'on_hold';
                reason = 'Bank Details Rejected';
            } else if (vendor.bankDetails.status === 'action_required') {
                status = 'on_hold';
                reason = 'Bank Details Action Required';
            }
        }

        const settlement = await Settlement.create({
            vendorId: group.vendorId,
            commissionIds: commissionDoc ? [commissionDoc._id] : [],
            orderIds: [order._id],
            amount: netPayable,
            status,
            reason,
            platformFee,
            shippingDeduction,
            commission,
            netPayable,
            ordersIncludedCount: 1,
            notes: `Auto-generated settlement for order ${order.orderId}`,
        });

        if (commissionDoc) {
            commissionDoc.settlementId = settlement._id;
            await commissionDoc.save();
        }
    }
};
