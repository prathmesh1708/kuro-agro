import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import GstRule from '../../../models/GstRule.model.js';
import GstHistory from '../../../models/GstHistory.model.js';
import Product from '../../../models/Product.model.js';
import Category from '../../../models/Category.model.js';
import { getEffectiveGstRate, calculateGst } from '../../../services/gst.service.js';

// GET /api/admin/gst/rules
export const getGstRules = asyncHandler(async (req, res) => {
    const { type, search, isActive } = req.query;
    const filter = {};

    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    if (search) {
        filter.name = { $regex: search, $options: 'i' };
    }

    const rules = await GstRule.find(filter)
        .populate('categoryId', 'name')
        .populate('productId', 'name')
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name')
        .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, rules, 'GST Rules fetched successfully.'));
});

// GET /api/admin/gst/rules/:id
export const getGstRuleById = asyncHandler(async (req, res) => {
    const rule = await GstRule.findById(req.params.id)
        .populate('categoryId', 'name')
        .populate('productId', 'name');

    if (!rule) {
        throw new ApiError(404, 'GST Rule not found.');
    }

    res.status(200).json(new ApiResponse(200, rule, 'GST Rule fetched.'));
});

// POST /api/admin/gst/rules
export const createGstRule = asyncHandler(async (req, res) => {
    const { name, rate, hsnCode, type, categoryId, productId, description, reason } = req.body;
    const adminId = req.user.id || req.user._id;

    if (type === 'category' || type === 'product') {
        throw new ApiError(403, 'Admin is not allowed to create category or product level GST rules.');
    }

    // Check uniqueness constraint
    if (type === 'global') {
        const existingGlobal = await GstRule.findOne({ type: 'global', isActive: true });
        if (existingGlobal) {
            throw new ApiError(400, 'An active Global GST Rule already exists. Please update or deactivate it first.');
        }
    } else if (type === 'category') {
        if (!categoryId) throw new ApiError(400, 'Category ID is required for Category rule.');
        const existingCategory = await GstRule.findOne({ type: 'category', categoryId, isActive: true });
        if (existingCategory) {
            throw new ApiError(400, 'An active GST rule already exists for this Category.');
        }
    } else if (type === 'product') {
        if (!productId) throw new ApiError(400, 'Product ID is required for Product rule override.');
        const existingProduct = await GstRule.findOne({ type: 'product', productId, isActive: true });
        if (existingProduct) {
            throw new ApiError(400, 'An active GST override rule already exists for this Product.');
        }
    }

    const rule = await GstRule.create({
        name,
        rate,
        hsnCode,
        type,
        categoryId: categoryId || null,
        productId: productId || null,
        description,
        createdBy: adminId
    });

    // Create Audit History
    await GstHistory.create({
        gstRuleId: rule._id,
        action: 'create',
        oldValue: null,
        newValue: rule.toObject(),
        changedBy: adminId,
        reason: reason || 'Initial rule creation'
    });

    res.status(201).json(new ApiResponse(201, rule, 'GST Rule created successfully.'));
});

// PUT /api/admin/gst/rules/:id
export const updateGstRule = asyncHandler(async (req, res) => {
    const { name, rate, hsnCode, description, categoryId, productId, reason, isActive } = req.body;
    const adminId = req.user.id || req.user._id;

    const rule = await GstRule.findById(req.params.id);
    if (!rule) {
        throw new ApiError(404, 'GST Rule not found.');
    }

    if (rule.type === 'category' || rule.type === 'product') {
        throw new ApiError(403, 'Admin is not allowed to update category or product level GST rules.');
    }


    const oldValueSnapshot = rule.toObject();

    // Check uniqueness if the rule is active or is being activated
    const newActive = isActive !== undefined ? isActive : rule.isActive;
    const newCategoryId = categoryId !== undefined ? categoryId : rule.categoryId;
    const newProductId = productId !== undefined ? productId : rule.productId;

    if (newActive) {
        if (rule.type === 'global') {
            const existingGlobal = await GstRule.findOne({ type: 'global', isActive: true, _id: { $ne: rule._id } });
            if (existingGlobal) {
                throw new ApiError(400, 'Another active Global GST Rule already exists.');
            }
        } else if (rule.type === 'category') {
            if (!newCategoryId) {
                throw new ApiError(400, 'Category ID is required for Category rule.');
            }
            const existingCategory = await GstRule.findOne({ type: 'category', categoryId: newCategoryId, isActive: true, _id: { $ne: rule._id } });
            if (existingCategory) {
                throw new ApiError(400, 'Another active GST rule already exists for this Category.');
            }
        } else if (rule.type === 'product') {
            if (!newProductId) {
                throw new ApiError(400, 'Product ID is required for Product rule override.');
            }
            const existingProduct = await GstRule.findOne({ type: 'product', productId: newProductId, isActive: true, _id: { $ne: rule._id } });
            if (existingProduct) {
                throw new ApiError(400, 'Another active GST override rule already exists for this Product.');
            }
        }
    }

    if (name !== undefined) rule.name = name;
    if (rate !== undefined) rule.rate = rate;
    if (hsnCode !== undefined) rule.hsnCode = hsnCode;
    if (description !== undefined) rule.description = description;
    if (isActive !== undefined) rule.isActive = isActive;
    if (categoryId !== undefined) rule.categoryId = categoryId || null;
    if (productId !== undefined) rule.productId = productId || null;
    rule.updatedBy = adminId;

    await rule.save();

    // Create Audit History
    await GstHistory.create({
        gstRuleId: rule._id,
        action: 'update',
        oldValue: oldValueSnapshot,
        newValue: rule.toObject(),
        changedBy: adminId,
        reason: reason || 'Rule values updated'
    });

    res.status(200).json(new ApiResponse(200, rule, 'GST Rule updated successfully.'));
});

// PATCH /api/admin/gst/rules/:id/toggle
export const toggleGstRule = asyncHandler(async (req, res) => {
    const adminId = req.user.id || req.user._id;
    const { reason } = req.body;

    const rule = await GstRule.findById(req.params.id);
    if (!rule) {
        throw new ApiError(404, 'GST Rule not found.');
    }

    if (rule.type === 'category' || rule.type === 'product') {
        throw new ApiError(403, 'Admin is not allowed to modify category or product level GST rules.');
    }

    const oldValueSnapshot = rule.toObject();

    if (!rule.isActive) {
        // Enforce uniqueness constraints before activating
        if (rule.type === 'global') {
            const existingGlobal = await GstRule.findOne({ type: 'global', isActive: true });
            if (existingGlobal) {
                throw new ApiError(400, 'Another active Global GST Rule exists. Deactivate it first.');
            }
        } else if (rule.type === 'category') {
            const existingCategory = await GstRule.findOne({ type: 'category', categoryId: rule.categoryId, isActive: true });
            if (existingCategory) {
                throw new ApiError(400, 'Another active GST rule exists for this Category. Deactivate it first.');
            }
        } else if (rule.type === 'product') {
            const existingProduct = await GstRule.findOne({ type: 'product', productId: rule.productId, isActive: true });
            if (existingProduct) {
                throw new ApiError(400, 'Another active GST override exists for this Product. Deactivate it first.');
            }
        }
    }

    rule.isActive = !rule.isActive;
    rule.updatedBy = adminId;
    await rule.save();

    // Create Audit History
    await GstHistory.create({
        gstRuleId: rule._id,
        action: rule.isActive ? 'activate' : 'deactivate',
        oldValue: oldValueSnapshot,
        newValue: rule.toObject(),
        changedBy: adminId,
        reason: reason || `Rule ${rule.isActive ? 'activated' : 'deactivated'}`
    });

    res.status(200).json(new ApiResponse(200, rule, `GST Rule ${rule.isActive ? 'activated' : 'deactivated'} successfully.`));
});

// DELETE /api/admin/gst/rules/:id
export const deleteGstRule = asyncHandler(async (req, res) => {
    const adminId = req.user.id || req.user._id;
    const { reason } = req.body;

    const rule = await GstRule.findById(req.params.id);
    if (!rule) {
        throw new ApiError(404, 'GST Rule not found.');
    }

    if (rule.type === 'category' || rule.type === 'product') {
        throw new ApiError(403, 'Admin is not allowed to delete category or product level GST rules.');
    }

    const oldValueSnapshot = rule.toObject();

    // We can soft delete by setting isActive: false or physically delete.
    // Physical delete is clean since we have an audit log history pointing to this ID.
    await GstRule.findByIdAndDelete(req.params.id);

    // Create Audit History entry
    await GstHistory.create({
        gstRuleId: req.params.id,
        action: 'delete',
        oldValue: oldValueSnapshot,
        newValue: null,
        changedBy: adminId,
        reason: reason || 'Rule deleted'
    });

    res.status(200).json(new ApiResponse(200, null, 'GST Rule deleted successfully.'));
});

// GET /api/admin/gst/history
export const getGstHistory = asyncHandler(async (req, res) => {
    const history = await GstHistory.find()
        .populate('changedBy', 'name')
        .populate({
            path: 'gstRuleId',
            select: 'name type rate'
        })
        .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, history, 'GST History Logs fetched successfully.'));
});

// GET /api/admin/gst/effective/:productId
export const getEffectiveProductGst = asyncHandler(async (req, res) => {
    const productId = req.params.productId || req.params.id;
    const product = await Product.findById(productId).select('categoryId price taxIncluded').lean();
    if (!product) {
        throw new ApiError(404, 'Product not found.');
    }

    const effective = await getEffectiveGstRate(product._id, product.categoryId);
    const calculations = calculateGst(product.price, effective.rate, product.taxIncluded);

    res.status(200).json(new ApiResponse(200, {
        effective,
        calculations
    }, 'Effective GST calculations resolved.'));
});

// GET /api/admin/gst/ledger
export const getGstLedger = asyncHandler(async (req, res) => {
    const { default: Order } = await import('../../../models/Order.model.js');
    const filter = { status: { $ne: 'cancelled' } };

    const [orders, totalsAgg] = await Promise.all([
        Order.find(filter)
            .select('orderId createdAt subtotal tax discount total shippingAddress')
            .sort({ createdAt: -1 })
            .lean(),
        Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalGst: { $sum: { $ifNull: ['$tax', 0] } },
                    totalTaxableAmount: { $sum: { $subtract: [{ $ifNull: ['$subtotal', 0] }, { $ifNull: ['$discount', 0] }] } }
                }
            }
        ])
    ]);

    const totals = totalsAgg?.[0] || { totalGst: 0, totalTaxableAmount: 0 };

    res.status(200).json(new ApiResponse(200, {
        orders,
        summary: {
            totalGst: totals.totalGst,
            totalCgst: totals.totalGst / 2,
            totalSgst: totals.totalGst / 2,
            totalTaxableAmount: totals.totalTaxableAmount
        }
    }, 'GST Ledger retrieved successfully.'));
});
