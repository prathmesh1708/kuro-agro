import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Product from '../../../models/Product.model.js';
import { slugify } from '../../../utils/slugify.js';

const deriveStockStatus = (stockQuantity = 0, lowStockThreshold = 10) => {
    if (stockQuantity <= 0) return 'out_of_stock';
    if (stockQuantity <= lowStockThreshold) return 'low_stock';
    return 'in_stock';
};

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
        return { sizes: [], colors: [], attributes: [], prices: {}, stockMap: {}, imageMap: {}, defaultVariant: {}, defaultSelection: {} };
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
        const rawPrice = pricesSource[key];
        const parsedPrice = Number(rawPrice);
        if (Number.isFinite(parsedPrice) && parsedPrice >= 0) {
            prices[key] = parsedPrice;
        } else {
            const fallback = Number(fallbackPrice);
            if (Number.isFinite(fallback) && fallback >= 0) {
                prices[key] = fallback;
            }
        }

        const parsedStock = toNonNegativeNumber(stockSource[key]);
        if (parsedStock !== null) {
            stockMap[key] = parsedStock;
        } else if (combinations.length === 1 && toNonNegativeNumber(fallbackStock) !== null) {
            stockMap[key] = toNonNegativeNumber(fallbackStock);
        }

        const image = String(imageSource[key] || '').trim();
        if (image) {
            imageMap[key] = image;
        }
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

// GET /api/vendor/products
export const getVendorProducts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search, stock } = req.query;
    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Number(limit) || 20);
    const skip = (numericPage - 1) * numericLimit;
    const filter = { vendorId: req.user.id };
    if (search) filter.$text = { $search: search };
    if (stock) filter.stock = stock;

    const products = await Product.find(filter).populate('categoryId', 'name').populate('brandId', 'name').sort({ createdAt: -1 }).skip(skip).limit(numericLimit);
    const total = await Product.countDocuments(filter);
    res.status(200).json(new ApiResponse(200, { products, total, page: numericPage, pages: Math.ceil(total / numericLimit) }, 'Products fetched.'));
});

// GET /api/vendor/products/:id
export const getVendorProductById = asyncHandler(async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, vendorId: req.user.id })
        .populate('categoryId', 'name parentId')
        .populate('brandId', 'name');
    if (!product) throw new ApiError(404, 'Product not found or access denied.');
    res.status(200).json(new ApiResponse(200, product, 'Product fetched.'));
});

// POST /api/vendor/products
export const createProduct = asyncHandler(async (req, res) => {
    const { name, ...rest } = req.body;
    if (!name) throw new ApiError(400, 'Product name is required.');
    const slug = slugify(name) + '-' + Date.now();
    const stockQuantity = Number(rest.stockQuantity ?? 0);
    const lowStockThreshold = Number(rest.lowStockThreshold ?? 10);
    if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
        throw new ApiError(400, 'Invalid stock quantity.');
    }
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
        throw new ApiError(400, 'Invalid low stock threshold.');
    }
    const price = Number(rest.price);
    if (!Number.isFinite(price) || price < 0) {
        throw new ApiError(400, 'Invalid product price.');
    }
    const normalizedVariants = normalizeVariantsPayload(rest.variants, price, stockQuantity);
    const variantAggregateStock = calculateVariantAggregateStock(normalizedVariants);
    const finalStockQuantity = Number.isFinite(variantAggregateStock)
        ? variantAggregateStock
        : stockQuantity;
    const stock = deriveStockStatus(finalStockQuantity, lowStockThreshold);

    const product = await Product.create({
        name,
        slug,
        vendorId: req.user.id,
        ...rest,
        price,
        variants: normalizedVariants,
        faqs: sanitizeFaqs(rest.faqs),
        stockQuantity: finalStockQuantity,
        lowStockThreshold,
        stock,
    });
    res.status(201).json(new ApiResponse(201, product, 'Product created.'));
});

// PUT /api/vendor/products/:id
export const updateProduct = asyncHandler(async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, vendorId: req.user.id });
    if (!product) throw new ApiError(404, 'Product not found or access denied.');
    Object.assign(product, req.body);
    if (Object.prototype.hasOwnProperty.call(req.body, 'faqs')) {
        product.faqs = sanitizeFaqs(req.body.faqs);
    }
    if (typeof req.body.stockQuantity !== 'undefined' || typeof req.body.lowStockThreshold !== 'undefined') {
        const stockQuantity = Number(product.stockQuantity ?? 0);
        const lowStockThreshold = Number(product.lowStockThreshold ?? 10);
        if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
            throw new ApiError(400, 'Invalid stock quantity.');
        }
        if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
            throw new ApiError(400, 'Invalid low stock threshold.');
        }
        product.stockQuantity = stockQuantity;
        product.lowStockThreshold = lowStockThreshold;
        product.stock = deriveStockStatus(stockQuantity, lowStockThreshold);
    }
    if (typeof req.body.price !== 'undefined') {
        const price = Number(req.body.price);
        if (!Number.isFinite(price) || price < 0) {
            throw new ApiError(400, 'Invalid product price.');
        }
        product.price = price;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'variants')) {
        const currentStockQty = typeof req.body.stockQuantity !== 'undefined' ? req.body.stockQuantity : product.stockQuantity;
        product.variants = normalizeVariantsPayload(req.body.variants, product.price, currentStockQty);
        const variantAggregateStock = calculateVariantAggregateStock(product.variants);
        if (Number.isFinite(variantAggregateStock)) {
            product.stockQuantity = variantAggregateStock;
        }
    }
    // Keep stock state deterministic from quantity + threshold.
    product.stock = deriveStockStatus(
        Number(product.stockQuantity ?? 0),
        Number(product.lowStockThreshold ?? 10)
    );
    await product.save();
    res.status(200).json(new ApiResponse(200, product, 'Product updated.'));
});

// DELETE /api/vendor/products/:id
export const deleteProduct = asyncHandler(async (req, res) => {
    const product = await Product.findOneAndDelete({ _id: req.params.id, vendorId: req.user.id });
    if (!product) throw new ApiError(404, 'Product not found or access denied.');
    res.status(200).json(new ApiResponse(200, null, 'Product deleted.'));
});

// DELETE /api/vendor/products-bulk
export const deleteAllProducts = asyncHandler(async (req, res) => {
    const { productIds } = req.body || {};
    let filter = { vendorId: req.user.id };
    if (Array.isArray(productIds) && productIds.length > 0) {
        filter._id = { $in: productIds };
    }
    const result = await Product.deleteMany(filter);
    res.status(200).json(new ApiResponse(200, { deletedCount: result.deletedCount }, 'Products deleted.'));
});

// PATCH /api/vendor/stock/:productId
export const updateStock = asyncHandler(async (req, res) => {
    const { stockQuantity, variantStockMap } = req.body;
    const product = await Product.findOne({ _id: req.params.productId, vendorId: req.user.id });
    if (!product) throw new ApiError(404, 'Product not found.');

    if (variantStockMap && typeof variantStockMap === 'object') {
        const newStockMap = {};
        for (const [k, v] of Object.entries(variantStockMap)) {
            const num = Number(v);
            if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
                throw new ApiError(400, `Invalid stock quantity for variant ${k}.`);
            }
            newStockMap[k] = num;
        }
        if (!product.variants) product.variants = {};
        product.variants.stockMap = newStockMap;
        product.markModified('variants');

        const variantAggregateStock = calculateVariantAggregateStock(product.variants);
        if (Number.isFinite(variantAggregateStock)) {
            product.stockQuantity = variantAggregateStock;
        }
    } else if (typeof stockQuantity !== 'undefined') {
        const numericStockQuantity = Number(stockQuantity);
        if (
            !Number.isFinite(numericStockQuantity) ||
            numericStockQuantity < 0 ||
            !Number.isInteger(numericStockQuantity)
        ) {
            throw new ApiError(400, 'Invalid stock quantity.');
        }
        product.stockQuantity = numericStockQuantity;
    } else {
        throw new ApiError(400, 'Stock quantity or variant stock map is required.');
    }

    product.stock = deriveStockStatus(product.stockQuantity, product.lowStockThreshold);
    await product.save();

    res.status(200).json(new ApiResponse(200, product, 'Stock updated.'));
});

// POST /api/vendor/products/:id/resubmit
export const resubmitProduct = asyncHandler(async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, vendorId: req.user.id });
    if (!product) throw new ApiError(404, 'Product not found.');

    if (!product.isReviewRemoved) {
        throw new ApiError(400, 'Product is not currently removed by admin.');
    }

    product.isPendingRestoration = true;
    product.reviewRemovalHistory.push({
        action: 'resubmit',
        reason: 'Vendor has edited the product details and resubmitted it for approval.',
        performedAt: new Date()
    });

    await product.save();

    // Create system notification for admins
    try {
        const NotificationModel = Product.db.model('Notification');
        await NotificationModel.create({
            recipientId: req.user.id,
            recipientType: 'admin',
            title: 'Product Resubmitted for Approval',
            message: `The product "${product.name}" has been edited and resubmitted for approval by vendor.`,
            type: 'system',
            data: { productId: String(product._id) }
        });
    } catch (notifErr) {
        console.error('Error creating admin notification on product resubmit:', notifErr);
    }

    res.status(200).json(new ApiResponse(200, product, 'Product has been resubmitted for approval.'));
});
