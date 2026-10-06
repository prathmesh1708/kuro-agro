import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Product from '../../../models/Product.model.js';
import Category from '../../../models/Category.model.js';
import Brand from '../../../models/Brand.model.js';
import Settings from '../../../models/Settings.model.js';
import { slugify } from '../../../utils/slugify.js';

const sanitizeFaqs = (faqs) => {
    if (!Array.isArray(faqs)) return [];
    return faqs
        .map((faq) => ({
            question: String(faq?.question || '').trim(),
            answer: String(faq?.answer || '').trim(),
        }))
        .filter((faq) => faq.question && faq.answer);
};

const normalizeVariantPart = (value) => String(value || '').trim().toLowerCase();

const uniqueAxisValues = (values = []) => {
    const seen = new Set();
    const out = [];
    for (const raw of values) {
        const value = String(raw || '').trim();
        if (!value) continue;
        const key = normalizeVariantPart(value);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(value);
    }
    return out;
};

const createVariantKey = (size = '', color = '') =>
    `${normalizeVariantPart(size)}|${normalizeVariantPart(color)}`;
const normalizeAxisName = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
const createDynamicVariantKey = (selection = {}) =>
    Object.entries(selection || {})
        .map(([axis, value]) => [normalizeAxisName(axis), normalizeVariantPart(value)])
        .filter(([axis, value]) => axis && value)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([axis, value]) => `${axis}=${value}`)
        .join('|');

const toObjectEntries = (value) => {
    if (!value) return [];
    if (value instanceof Map) return Array.from(value.entries());
    if (typeof value === 'object') return Object.entries(value);
    return [];
};

const toNonNegativeNumber = (raw) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const normalizeAttributes = (rawAttributes = []) => {
    const seen = new Set();
    const attributes = [];
    for (const raw of rawAttributes || []) {
        const name = String(raw?.name || '').trim();
        const axisKey = normalizeAxisName(name);
        if (!name || !axisKey || seen.has(axisKey)) continue;
        seen.add(axisKey);
        const values = uniqueAxisValues(raw?.values || []);
        if (!values.length) continue;
        attributes.push({ name, axisKey, values });
    }
    return attributes;
};

const buildCombinationsFromAttributes = (attributes = []) => {
    if (!attributes.length) return [];
    let combos = [{}];
    attributes.forEach((attr) => {
        const next = [];
        combos.forEach((selection) => {
            attr.values.forEach((value) => next.push({ ...selection, [attr.axisKey]: value }));
        });
        combos = next;
    });
    return combos;
};

const normalizeVariantsPayload = (rawVariants = {}, fallbackPrice, fallbackStock = null) => {
    if (!rawVariants || typeof rawVariants !== 'object') {
        return { sizes: [], colors: [], prices: {}, stockMap: {}, imageMap: {}, defaultVariant: {} };
    }

    const sizes = uniqueAxisValues(rawVariants.sizes || []);
    const colors = uniqueAxisValues(rawVariants.colors || []);
    const attributes = normalizeAttributes(rawVariants.attributes || []);
    const hasSizeAxis = sizes.length > 0;
    const hasColorAxis = colors.length > 0;
    const hasDynamicAxes = attributes.length > 0;
    const hasAnyAxis = hasDynamicAxes || hasSizeAxis || hasColorAxis;

    if (!hasAnyAxis) {
        return { sizes: [], colors: [], attributes: [], prices: {}, stockMap: {}, imageMap: {}, defaultVariant: {}, defaultSelection: {} };
    }

    const combinations = [];
    if (hasDynamicAxes) {
        buildCombinationsFromAttributes(attributes).forEach((selection) => combinations.push({ selection }));
    } else if (hasSizeAxis && hasColorAxis) {
        sizes.forEach((size) => colors.forEach((color) => combinations.push({ selection: { size, color } })));
    } else if (hasSizeAxis) {
        sizes.forEach((size) => combinations.push({ selection: { size } }));
    } else {
        colors.forEach((color) => combinations.push({ selection: { color } }));
    }

    const pricesSource = Object.fromEntries(toObjectEntries(rawVariants.prices));
    const stockSource = Object.fromEntries(toObjectEntries(rawVariants.stockMap));
    const imageSource = Object.fromEntries(toObjectEntries(rawVariants.imageMap));
    const prices = {};
    const stockMap = {};
    const imageMap = {};

    combinations.forEach(({ selection }) => {
        const size = String(selection?.size || '');
        const color = String(selection?.color || '');
        const key = hasDynamicAxes
            ? createDynamicVariantKey(selection)
            : createVariantKey(size, color);
        const parsedPrice = toNonNegativeNumber(pricesSource[key]);
        if (parsedPrice !== null) {
            prices[key] = parsedPrice;
        } else {
            const fallback = toNonNegativeNumber(fallbackPrice);
            if (fallback !== null) prices[key] = fallback;
        }

        const parsedStock = toNonNegativeNumber(stockSource[key]);
        if (parsedStock !== null) {
            stockMap[key] = parsedStock;
        } else if (combinations.length === 1 && toNonNegativeNumber(fallbackStock) !== null) {
            stockMap[key] = toNonNegativeNumber(fallbackStock);
        }

        const image = String(imageSource[key] || '').trim();
        if (image) imageMap[key] = image;
    });

    const defaultSize = String(rawVariants?.defaultVariant?.size || '').trim();
    const defaultColor = String(rawVariants?.defaultVariant?.color || '').trim();
    const normalizedDefaultSize = hasSizeAxis ? defaultSize : '';
    const normalizedDefaultColor = hasColorAxis ? defaultColor : '';
    const hasValidDefaultSize = !normalizedDefaultSize || sizes.some((s) => normalizeVariantPart(s) === normalizeVariantPart(normalizedDefaultSize));
    const hasValidDefaultColor = !normalizedDefaultColor || colors.some((c) => normalizeVariantPart(c) === normalizeVariantPart(normalizedDefaultColor));
    if (!hasValidDefaultSize || !hasValidDefaultColor) {
        throw new ApiError(400, 'Default variant must exist in provided sizes/colors.');
    }

    const defaultSelection = {};
    if (rawVariants?.defaultSelection && typeof rawVariants.defaultSelection === 'object') {
        Object.entries(rawVariants.defaultSelection).forEach(([axis, value]) => {
            const axisKey = normalizeAxisName(axis);
            const selectedValue = String(value || '').trim();
            if (!axisKey || !selectedValue) return;
            const axisMeta = attributes.find((attr) => attr.axisKey === axisKey);
            if (!axisMeta) return;
            const matched = axisMeta.values.find(
                (candidate) => normalizeVariantPart(candidate) === normalizeVariantPart(selectedValue)
            );
            if (matched) defaultSelection[axisKey] = matched;
        });
    }

    return {
        sizes,
        colors,
        attributes: attributes.map((attr) => ({ name: attr.name, values: attr.values })),
        prices,
        stockMap,
        imageMap,
        defaultVariant: {
            size: normalizedDefaultSize,
            color: normalizedDefaultColor,
        },
        defaultSelection,
    };
};

const calculateVariantAggregateStock = (variants = {}) => {
    const entries = toObjectEntries(variants.stockMap);
    if (!entries.length) return null;
    return entries.reduce((sum, [, value]) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? sum + parsed : sum;
    }, 0);
};

const sanitizeCategoryPayload = (payload = {}) => {
    const allowed = ['name', 'description', 'image', 'icon', 'parentId', 'order', 'isActive'];
    const sanitized = {};
    for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            sanitized[key] = payload[key];
        }
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, 'parentId')) {
        sanitized.parentId = sanitized.parentId || null;
    }
    return sanitized;
};

const assertValidCategoryParent = async ({ categoryId = null, parentId }) => {
    if (!parentId) return;

    if (categoryId && String(categoryId) === String(parentId)) {
        throw new ApiError(400, 'Category cannot be parent of itself.');
    }

    const parent = await Category.findById(parentId).select('_id parentId');
    if (!parent) {
        throw new ApiError(400, 'Selected parent category does not exist.');
    }

    // Prevent cycles when changing parent during edit.
    if (categoryId) {
        let cursor = parent;
        while (cursor?.parentId) {
            if (String(cursor.parentId) === String(categoryId)) {
                throw new ApiError(400, 'Invalid parent category hierarchy.');
            }
            cursor = await Category.findById(cursor.parentId).select('_id parentId');
        }
    }
};

const sanitizeBrandPayload = (payload = {}) => {
    const allowed = ['name', 'logo', 'description', 'website', 'isActive'];
    const sanitized = {};
    for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            sanitized[key] = payload[key];
        }
    }
    return sanitized;
};

// GET /api/admin/products
export const getAllProducts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search, vendorId, categoryId, status, includeInactive = 'false', gst } = req.query;
    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 20;
    const skip = (numericPage - 1) * numericLimit;
    const filter = {};
    if (search) filter.$text = { $search: search };
    if (vendorId) filter.vendorId = vendorId;
    if (categoryId) filter.categoryId = categoryId;
    if (status) filter.stock = status;
    if (gst) filter.taxRate = Number(gst);
    if (String(includeInactive) !== 'true') {
        filter.isActive = { $ne: false };
    }

    const products = await Product.find(filter)
        .populate('vendorId', 'storeName')
        .populate('categoryId', 'name')
        .populate('brandId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit);
    const total = await Product.countDocuments(filter);
    res.status(200).json(new ApiResponse(200, { products, total, page: numericPage, pages: Math.ceil(total / numericLimit) }, 'Products fetched.'));
});

// GET /api/admin/products/:id
export const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id)
        .populate('vendorId', 'storeName')
        .populate('categoryId', 'name')
        .populate('brandId', 'name');

    if (!product) throw new ApiError(404, 'Product not found.');
    res.status(200).json(new ApiResponse(200, product, 'Product fetched.'));
});

// GET /api/admin/products/:id/review-analytics
export const getProductReviewAnalytics = asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const product = await Product.findById(productId).select('_id');
    if (!product) throw new ApiError(404, 'Product not found.');

    const ReviewModel = Product.db.model('Review');
    const reviews = await ReviewModel.find({ productId, isApproved: true, isHidden: { $ne: true } }).lean();

    const totalReviews = reviews.length;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;

    reviews.forEach((r) => {
        const rating = Math.min(5, Math.max(1, Math.round(r.rating || 0)));
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
        ratingSum += r.rating;
    });

    const averageRating = totalReviews > 0 ? Number((ratingSum / totalReviews).toFixed(2)) : 0;
    
    // Ratings 1 and 2 are considered negative.
    const negativeReviewsCount = ratingDistribution[1] + ratingDistribution[2];
    const positiveReviewsCount = ratingDistribution[3] + ratingDistribution[4] + ratingDistribution[5];

    const negativeReviewPercentage = totalReviews > 0 ? Number(((negativeReviewsCount / totalReviews) * 100).toFixed(2)) : 0;
    const positiveReviewPercentage = totalReviews > 0 ? Number(((positiveReviewsCount / totalReviews) * 100).toFixed(2)) : 0;

    let reviewHealth = 'Average';
    if (averageRating >= 4.5) reviewHealth = 'Excellent';
    else if (averageRating >= 4.0) reviewHealth = 'Good';
    else if (averageRating >= 3.0) reviewHealth = 'Average';
    else if (averageRating >= 2.5) reviewHealth = 'Poor';
    else reviewHealth = 'Critical';

    res.status(200).json(
        new ApiResponse(200, {
            averageRating,
            totalReviews,
            totalRatings: totalReviews,
            ratingDistribution,
            positiveReviewPercentage,
            negativeReviewPercentage,
            reviewHealth,
        }, 'Review analytics fetched.')
    );
});

// PATCH /api/admin/products/:id/review-remove
export const removeProductByReview = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) throw new ApiError(404, 'Product not found.');

    const ReviewModel = Product.db.model('Review');
    const reviews = await ReviewModel.find({ productId: product._id, isApproved: true, isHidden: { $ne: true } }).lean();

    const totalReviews = reviews.length;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;
    reviews.forEach((r) => {
        const rating = Math.min(5, Math.max(1, Math.round(r.rating || 0)));
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
        ratingSum += r.rating;
    });

    const averageRating = totalReviews > 0 ? ratingSum / totalReviews : 0;
    const negativeReviewsCount = ratingDistribution[1] + ratingDistribution[2];
    const negativeReviewPercentage = totalReviews > 0 ? (negativeReviewsCount / totalReviews) * 100 : 0;

    // Check conditions: Average Rating < 2.5 OR Negative Reviews > 60%, AND Minimum Reviews >= 15
    const isUnderThreshold = averageRating < 2.5 || negativeReviewPercentage > 60;
    if (totalReviews < 15 || !isUnderThreshold) {
        throw new ApiError(400, 'Product does not meet the criteria for manual review removal (minimum 15 reviews, and average rating < 2.5 or > 60% negative reviews).');
    }

    let reviewHealth = 'Average';
    if (averageRating >= 4.5) reviewHealth = 'Excellent';
    else if (averageRating >= 4.0) reviewHealth = 'Good';
    else if (averageRating >= 3.0) reviewHealth = 'Average';
    else if (averageRating >= 2.5) reviewHealth = 'Poor';
    else reviewHealth = 'Critical';

    product.isReviewRemoved = true;
    product.removedReason = reason;
    product.removedBy = req.user.id;
    product.removedAt = new Date();
    product.reviewHealth = reviewHealth;
    product.averageRating = Number(averageRating.toFixed(2));
    product.negativeReviewPercentage = Number(negativeReviewPercentage.toFixed(2));
    product.reviewRemovalHistory.push({
        action: 'remove',
        reason,
        performedBy: req.user.id,
        performedAt: new Date(),
    });

    await product.save();

    // Create system notification for vendor
    try {
        const NotificationModel = Product.db.model('Notification');
        await NotificationModel.create({
            recipientId: product.vendorId,
            recipientType: 'vendor',
            title: 'Product Removed Due to Poor Reviews',
            message: `Your product "${product.name}" has been removed from customer visibility due to poor customer feedback. Reason: ${reason}`,
            type: 'system',
            data: { productId: String(product._id) }
        });
    } catch (notifErr) {
        // Log notification error but do not block response
        console.error('Error creating vendor notification on review removal:', notifErr);
    }

    res.status(200).json(new ApiResponse(200, product, 'Product has been removed from visibility.'));
});

// PATCH /api/admin/products/:id/review-restore
export const restoreProductByReview = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new ApiError(404, 'Product not found.');

    product.isReviewRemoved = false;
    product.isPendingRestoration = false;
    product.removedReason = '';
    product.removedBy = undefined;
    product.removedAt = undefined;
    product.reviewRemovalHistory.push({
        action: 'restore',
        reason: 'Restored by administrator.',
        performedBy: req.user.id,
        performedAt: new Date(),
    });

    await product.save();

    // Create system notification for vendor
    try {
        const NotificationModel = Product.db.model('Notification');
        await NotificationModel.create({
            recipientId: product.vendorId,
            recipientType: 'vendor',
            title: 'Product Restored',
            message: `Your product "${product.name}" has been restored and is now visible to customers.`,
            type: 'system',
            data: { productId: String(product._id) }
        });
    } catch (notifErr) {
        console.error('Error creating vendor notification on restore:', notifErr);
    }

    res.status(200).json(new ApiResponse(200, product, 'Product has been restored to visibility.'));
});


// POST /api/admin/products
export const createProduct = asyncHandler(async (req, res) => {
    const { name, stockQuantity = 0, stock, ...rest } = req.body;
    const slug = slugify(name) + '-' + Date.now();
    const numericStockQuantity = Number(stockQuantity) || 0;
    const normalizedVariants = normalizeVariantsPayload(rest.variants, rest.price, numericStockQuantity);
    const variantAggregateStock = calculateVariantAggregateStock(normalizedVariants);
    const finalStockQuantity = Number.isFinite(variantAggregateStock)
        ? variantAggregateStock
        : numericStockQuantity;
    const normalizedStock = stock || (finalStockQuantity <= 0
        ? 'out_of_stock'
        : finalStockQuantity <= 10
            ? 'low_stock'
            : 'in_stock');

    const product = await Product.create({
        name,
        slug,
        stock: normalizedStock,
        stockQuantity: finalStockQuantity,
        ...rest,
        variants: normalizedVariants,
        faqs: sanitizeFaqs(rest.faqs),
    });
    res.status(201).json(new ApiResponse(201, product, 'Product created.'));
});



// PUT /api/admin/products/:id
export const updateProduct = asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    if (payload.name) {
        payload.slug = slugify(payload.name) + '-' + Date.now();
    }

    if (payload.stockQuantity !== undefined) {
        const numericStockQuantity = Number(payload.stockQuantity) || 0;
        payload.stockQuantity = numericStockQuantity;
        if (!payload.stock) {
            payload.stock = numericStockQuantity <= 0
                ? 'out_of_stock'
                : numericStockQuantity <= 10
                    ? 'low_stock'
                    : 'in_stock';
        }
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'faqs')) {
        payload.faqs = sanitizeFaqs(payload.faqs);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'variants')) {
        const fallbackPrice =
            Object.prototype.hasOwnProperty.call(payload, 'price')
                ? payload.price
                : (await Product.findById(req.params.id).select('price').lean())?.price;
        const currentStock = payload.stockQuantity !== undefined ? payload.stockQuantity : (await Product.findById(req.params.id).select('stockQuantity').lean())?.stockQuantity;
        payload.variants = normalizeVariantsPayload(payload.variants, fallbackPrice, currentStock);
        const variantAggregateStock = calculateVariantAggregateStock(payload.variants);
        if (Number.isFinite(variantAggregateStock)) {
            payload.stockQuantity = variantAggregateStock;
            if (!payload.stock) {
                payload.stock = variantAggregateStock <= 0
                    ? 'out_of_stock'
                    : variantAggregateStock <= 10
                        ? 'low_stock'
                        : 'in_stock';
            }
        }
    }

    const product = await Product.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!product) throw new ApiError(404, 'Product not found.');
    res.status(200).json(new ApiResponse(200, product, 'Product updated.'));
});

// DELETE /api/admin/products/:id
export const deleteProduct = asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true, runValidators: true }
    );
    if (!product) throw new ApiError(404, 'Product not found.');
    res.status(200).json(new ApiResponse(200, null, 'Product disabled.'));
});

// GET /api/admin/products/tax-pricing-rules
export const getTaxPricingRules = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne({ key: 'product_tax_pricing_rules' }).lean();
    const value = settings?.value || {};
    const taxRules = Array.isArray(value.taxRules) ? value.taxRules : [];
    const pricingRules = Array.isArray(value.pricingRules) ? value.pricingRules : [];

    res.status(200).json(
        new ApiResponse(200, { taxRules, pricingRules }, 'Tax and pricing rules fetched.')
    );
});

// PUT /api/admin/products/tax-pricing-rules
export const updateTaxPricingRules = asyncHandler(async (req, res) => {
    const { taxRules = [], pricingRules = [] } = req.body;

    await Settings.findOneAndUpdate(
        { key: 'product_tax_pricing_rules' },
        { key: 'product_tax_pricing_rules', value: { taxRules, pricingRules } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json(
        new ApiResponse(200, { taxRules, pricingRules }, 'Tax and pricing rules updated.')
    );
});

// GET /api/admin/categories
export const getAllCategories = asyncHandler(async (req, res) => {
    const categories = await Category.find().sort({ order: 1, name: 1 });
    res.status(200).json(new ApiResponse(200, categories, 'Categories fetched.'));
});

// POST /api/admin/categories
export const createCategory = asyncHandler(async (req, res) => {
    const payload = sanitizeCategoryPayload(req.body);
    const { name, ...rest } = payload;
    await assertValidCategoryParent({ parentId: rest.parentId });
    const slug = slugify(name);
    const category = await Category.create({ name, slug, ...rest });
    res.status(201).json(new ApiResponse(201, category, 'Category created.'));
});

// PUT /api/admin/categories/:id
export const updateCategory = asyncHandler(async (req, res) => {
    const existingCategory = await Category.findById(req.params.id);
    if (!existingCategory) throw new ApiError(404, 'Category not found.');

    const payload = sanitizeCategoryPayload(req.body);
    await assertValidCategoryParent({
        categoryId: existingCategory._id,
        parentId: payload.parentId,
    });

    if (payload.name) {
        payload.slug = slugify(payload.name);
    }

    const category = await Category.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true,
    });
    if (!category) throw new ApiError(404, 'Category not found.');
    res.status(200).json(new ApiResponse(200, category, 'Category updated.'));
});

// DELETE /api/admin/categories/:id
export const deleteCategory = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id).select('_id');
    if (!category) {
        throw new ApiError(404, 'Category not found.');
    }

    const [subcategoriesCount, productsCount] = await Promise.all([
        Category.countDocuments({ parentId: req.params.id }),
        Product.countDocuments({ categoryId: req.params.id }),
    ]);

    if (subcategoriesCount > 0) {
        throw new ApiError(409, 'Cannot delete category with existing subcategories.');
    }
    if (productsCount > 0) {
        throw new ApiError(409, 'Cannot delete category with existing products.');
    }

    await Category.findByIdAndDelete(req.params.id);
    res.status(200).json(new ApiResponse(200, null, 'Category deleted.'));
});

// PATCH /api/admin/categories/reorder
export const reorderCategories = asyncHandler(async (req, res) => {
    const uniqueIds = Array.from(new Set(req.body.categoryIds.map((id) => String(id))));

    const rootCategories = await Category.find({
        _id: { $in: uniqueIds },
        parentId: null,
    }).select('_id');

    if (rootCategories.length !== uniqueIds.length) {
        throw new ApiError(400, 'Only root categories can be reordered.');
    }

    const bulkUpdates = uniqueIds.map((id, index) => ({
        updateOne: {
            filter: { _id: id },
            update: { $set: { order: index + 1 } },
        },
    }));

    if (bulkUpdates.length > 0) {
        await Category.bulkWrite(bulkUpdates);
    }

    const categories = await Category.find().sort({ order: 1, name: 1 });
    res.status(200).json(new ApiResponse(200, categories, 'Category order updated.'));
});

// GET /api/admin/brands
export const getAllBrands = asyncHandler(async (req, res) => {
    const brands = await Brand.find().sort({ name: 1 });
    res.status(200).json(new ApiResponse(200, brands, 'Brands fetched.'));
});

// POST /api/admin/brands
export const createBrand = asyncHandler(async (req, res) => {
    const payload = sanitizeBrandPayload(req.body);
    const { name, ...rest } = payload;
    if (!name || !name.trim()) {
        throw new ApiError(400, 'Brand name is required.');
    }
    const trimmedName = name.replace(/\s+/g, ' ').trim();
    const cleanRegexName = trimmedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const existingBrand = await Brand.findOne({
        name: { $regex: new RegExp(`^\\s*${cleanRegexName}\\s*$`, 'i') }
    });
    if (existingBrand) {
        throw new ApiError(400, 'This Brand already exists.');
    }

    const slug = slugify(trimmedName);
    const brand = await Brand.create({ name: trimmedName, slug, ...rest });
    res.status(201).json(new ApiResponse(201, brand, 'Brand created.'));
});

// PUT /api/admin/brands/:id
export const updateBrand = asyncHandler(async (req, res) => {
    const payload = sanitizeBrandPayload(req.body);
    if (payload.name) {
        const trimmedName = payload.name.replace(/\s+/g, ' ').trim();
        const cleanRegexName = trimmedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const existingBrand = await Brand.findOne({
            _id: { $ne: req.params.id },
            name: { $regex: new RegExp(`^\\s*${cleanRegexName}\\s*$`, 'i') }
        });
        if (existingBrand) {
            throw new ApiError(400, 'This Brand already exists.');
        }
        payload.name = trimmedName;
        payload.slug = slugify(trimmedName);
    }

    const brand = await Brand.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!brand) throw new ApiError(404, 'Brand not found.');
    res.status(200).json(new ApiResponse(200, brand, 'Brand updated.'));
});

// DELETE /api/admin/brands/:id
export const deleteBrand = asyncHandler(async (req, res) => {
    const brand = await Brand.findById(req.params.id).select('_id');
    if (!brand) throw new ApiError(404, 'Brand not found.');

    const linkedProductsCount = await Product.countDocuments({ brandId: req.params.id });
    if (linkedProductsCount > 0) {
        throw new ApiError(409, 'Cannot delete brand with existing products.');
    }

    await Brand.findByIdAndDelete(req.params.id);
    res.status(200).json(new ApiResponse(200, null, 'Brand deleted.'));
});

// GET /api/admin/brands/approvals
export const getBrandApprovals = asyncHandler(async (req, res) => {
    const brands = await Brand.aggregate([
        {
            $match: {
                createdByVendor: { $ne: null }
            }
        },
        {
            $lookup: {
                from: 'vendors',
                localField: 'createdByVendor',
                foreignField: '_id',
                as: 'vendor'
            }
        },
        {
            $unwind: {
                path: '$vendor',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: 'brandId',
                as: 'products'
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                slug: 1,
                logo: 1,
                description: 1,
                website: 1,
                isActive: 1,
                status: 1,
                country: 1,
                manufacturer: 1,
                createdAt: 1,
                createdByVendor: 1,
                vendorName: '$vendor.storeName',
                vendorEmail: '$vendor.email',
                totalProducts: { $size: '$products' }
            }
        },
        {
            $sort: { createdAt: -1 }
        }
    ]);

    res.status(200).json(new ApiResponse(200, brands, 'Brand approvals fetched.'));
});

// PATCH /api/admin/brands/:id/status
export const updateBrandStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
        throw new ApiError(400, 'Invalid status.');
    }
    const brand = await Brand.findByIdAndUpdate(id, { status }, { new: true });
    if (!brand) throw new ApiError(404, 'Brand not found.');
    res.status(200).json(new ApiResponse(200, brand, `Brand status updated to ${status}.`));
});

// PATCH /api/admin/brands/:id/rename
export const renameBrand = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
        throw new ApiError(400, 'Brand name is required.');
    }

    const trimmedName = name.replace(/\s+/g, ' ').trim();
    const cleanRegexName = trimmedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const existingBrand = await Brand.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^\\s*${cleanRegexName}\\s*$`, 'i') }
    });
    if (existingBrand) {
        throw new ApiError(400, 'This Brand already exists.');
    }

    let slug = slugify(trimmedName);
    const existingSlug = await Brand.findOne({ _id: { $ne: id }, slug });
    if (existingSlug) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const brand = await Brand.findByIdAndUpdate(id, { name: trimmedName, slug }, { new: true });
    if (!brand) throw new ApiError(404, 'Brand not found.');

    res.status(200).json(new ApiResponse(200, brand, 'Brand renamed successfully.'));
});

// POST /api/admin/brands/merge
export const mergeBrands = asyncHandler(async (req, res) => {
    const { sourceBrandId, targetBrandId } = req.body;
    if (String(sourceBrandId) === String(targetBrandId)) {
        throw new ApiError(400, 'Source and target brands cannot be the same.');
    }

    const sourceBrand = await Brand.findById(sourceBrandId);
    const targetBrand = await Brand.findById(targetBrandId);
    if (!sourceBrand) throw new ApiError(404, 'Source brand not found.');
    if (!targetBrand) throw new ApiError(404, 'Target brand not found.');

    // Perform product updates
    await Product.updateMany({ brandId: sourceBrandId }, { brandId: targetBrandId });

    // Delete the source brand (as it is now duplicate and empty)
    await Brand.findByIdAndDelete(sourceBrandId);

    res.status(200).json(new ApiResponse(200, { targetBrandId }, 'Brands merged successfully.'));
});
