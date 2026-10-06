import mongoose from 'mongoose';
import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import Product from '../models/Product.model.js';
import Category from '../models/Category.model.js';
import Brand from '../models/Brand.model.js';
import Vendor from '../models/Vendor.model.js';
import Coupon from '../models/Coupon.model.js';
import Banner from '../models/Banner.model.js';
import Campaign from '../models/Campaign.model.js';
import { calculateVendorShippingForGroups } from '../services/vendorShipping.service.js';

const router = Router();

const toPublicVendor = (vendorDoc, productCount = 0) => {
    const vendor = typeof vendorDoc?.toObject === 'function'
        ? vendorDoc.toObject()
        : (vendorDoc || {});

    const vendorIdStr = vendor._id ? String(vendor._id) : (vendor.id ? String(vendor.id) : '');
    const resolvedStoreName = vendor.storeName || vendor.legalBusinessName || vendor.name || 'Store';
    const count = Number(productCount ?? vendor.totalProducts ?? vendor.productCount ?? 0);

    return {
        ...vendor,
        id: vendorIdStr,
        _id: vendorIdStr,
        storeName: resolvedStoreName,
        totalProducts: count,
        productCount: count,
        password: undefined,
        otp: undefined,
        otpExpiry: undefined,
        bankDetails: undefined,
        commissionRate: undefined,
    };
};

const normalizeVariantPart = (value) => String(value || '').trim().toLowerCase();
const normalizeVariantKey = (key) => String(key || '').trim().toLowerCase();

const toVariantPriceEntries = (variantPrices) => {
    if (!variantPrices) return [];
    if (variantPrices instanceof Map) return Array.from(variantPrices.entries());
    if (typeof variantPrices === 'object') return Object.entries(variantPrices);
    return [];
};

const resolveVariantPrice = (product, selectedVariant) => {
    const basePrice = Number(product?.price);
    if (!Number.isFinite(basePrice) || basePrice < 0) return 0;

    const selectionEntries = Object.entries(selectedVariant || {})
        .map(([axis, value]) => [String(axis || '').trim(), String(value || '').trim()])
        .filter(([axis, value]) => axis && value);

    const dynamicKey = selectionEntries.length
        ? selectionEntries
            .map(([axis, value]) => `${normalizeVariantPart(axis)}=${normalizeVariantPart(value)}`)
            .sort()
            .join('|')
        : '';

    const size = normalizeVariantPart(selectedVariant?.size);
    const color = normalizeVariantPart(selectedVariant?.color);
    const entries = toVariantPriceEntries(product?.variants?.prices);
    if (!entries.length || (!dynamicKey && !size && !color)) return basePrice;

    const candidateKeys = [
        dynamicKey || null,
        `${size}|${color}`,
        `${size}-${color}`,
        `${size}_${color}`,
        `${size}:${color}`,
        size && !color ? size : null,
        color && !size ? color : null,
    ].filter(Boolean);

    for (const candidate of candidateKeys) {
        if (!candidate) continue;
        const exact = entries.find(([rawKey]) => String(rawKey).trim() === candidate);
        if (exact) {
            const price = Number(exact[1]);
            if (Number.isFinite(price) && price >= 0) return price;
        }

        const normalized = entries.find(
            ([rawKey]) => normalizeVariantKey(rawKey) === normalizeVariantKey(candidate)
        );
        if (normalized) {
            const price = Number(normalized[1]);
            if (Number.isFinite(price) && price >= 0) return price;
        }
    }

    return basePrice;
};

const enrichProductsWithGst = async (products) => {
    if (!products) return products;
    const { getEffectiveGstRate, calculateGst } = await import('../services/gst.service.js');
    const isArray = Array.isArray(products);
    const list = isArray ? products : [products];
    const enriched = await Promise.all(list.map(async (p) => {
        const productObj = typeof p.toObject === 'function' ? p.toObject() : p;
        const effective = await getEffectiveGstRate(productObj._id || productObj.id, productObj.categoryId?._id || productObj.categoryId);
        if (!productObj.taxIncluded) {
            const calculations = calculateGst(productObj.price, effective.rate, false);
            productObj.price = calculations.totalPrice;
            if (productObj.originalPrice) {
                const calculationsOriginal = calculateGst(productObj.originalPrice, effective.rate, false);
                productObj.originalPrice = calculationsOriginal.totalPrice;
            }
            productObj.taxIncluded = true;
        }
        
        // Also adjust variants if they exist
        if (productObj.variants && productObj.variants.prices) {
            let pricesMap = productObj.variants.prices;
            const entries = pricesMap instanceof Map 
                ? Array.from(pricesMap.entries()) 
                : Object.entries(pricesMap || {});
            
            const newPrices = {};
            for (const [key, value] of entries) {
                const calcVal = calculateGst(Number(value) || 0, effective.rate, false);
                newPrices[key] = calcVal.totalPrice;
            }
            productObj.variants.prices = newPrices;
        }
        
        return productObj;
    }));
    return isArray ? enriched : enriched[0];
};

// GET /api/products — list with filters
const listProducts = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 12,
        category,
        brand,
        vendor,
        search,
        q,
        sort = 'newest',
        flashSale,
        isNewArrival,
        minPrice,
        maxPrice,
        minRating
    } = req.query;
    const skip = (page - 1) * limit;
    const filter = { isActive: true, isReviewRemoved: { $ne: true } };

    if (category) {
        const rawCat = String(category || '').trim();
        let targetCategoryIds = [];

        if (mongoose.Types.ObjectId.isValid(rawCat)) {
            const catObjId = new mongoose.Types.ObjectId(rawCat);
            targetCategoryIds.push(catObjId);

            const childCategories = await Category.find({
                $or: [{ parentId: catObjId }, { parentId: rawCat }]
            }).select('_id');

            const childIds = childCategories.map((cat) => cat._id);
            targetCategoryIds.push(...childIds);

            if (childIds.length > 0) {
                const grandChildCategories = await Category.find({
                    parentId: { $in: childIds }
                }).select('_id');
                targetCategoryIds.push(...grandChildCategories.map((cat) => cat._id));
            }
        } else {
            const matchedCats = await Category.find({
                $or: [{ slug: rawCat }, { name: new RegExp(rawCat, 'i') }]
            }).select('_id');
            const matchedIds = matchedCats.map((cat) => cat._id);
            targetCategoryIds.push(...matchedIds);

            if (matchedIds.length > 0) {
                const childCats = await Category.find({
                    parentId: { $in: matchedIds }
                }).select('_id');
                targetCategoryIds.push(...childCats.map((cat) => cat._id));
            }
        }

        if (targetCategoryIds.length > 0) {
            filter.categoryId = { $in: targetCategoryIds };
        } else {
            filter.categoryId = rawCat;
        }
    }
    if (brand) filter.brandId = brand;
    if (vendor) filter.vendorId = vendor;
    if (flashSale === 'true') filter.flashSale = true;
    if (isNewArrival === 'true') filter.isNewArrival = true;
    if (minPrice || maxPrice) filter.price = { ...(minPrice && { $gte: Number(minPrice) }), ...(maxPrice && { $lte: Number(maxPrice) }) };
    if (minRating) filter.rating = { $gte: Number(minRating) };
    const searchQuery = String(search || q || '').trim();
    if (searchQuery) {
        const safeRegex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const matchingVendors = await Vendor.find({
            status: 'approved',
            $or: [{ name: safeRegex }, { storeName: safeRegex }, { legalBusinessName: safeRegex }]
        }).select('_id');
        const matchingVendorIds = matchingVendors.map(v => v._id);

        filter.$or = [
            { name: safeRegex },
            { description: safeRegex },
            ...(matchingVendorIds.length > 0 ? [{ vendorId: { $in: matchingVendorIds } }] : [])
        ];
    }

    const sortMap = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, 'price-asc': { price: 1 }, 'price-desc': { price: -1 }, popular: { reviewCount: -1 }, rating: { rating: -1 } };

    const products = await Product.find(filter).populate('categoryId', 'name').populate('brandId', 'name').populate('vendorId', 'storeName').sort(sortMap[sort] || { createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await Product.countDocuments(filter);
    const enrichedProducts = await enrichProductsWithGst(products);

    res.status(200).json(new ApiResponse(200, { products: enrichedProducts, total, page: Number(page), pages: Math.ceil(total / limit) }, 'Products fetched.'));
});

router.get('/', listProducts);
router.get('/products', listProducts);

// GET /api/products/flash-sale
router.get('/flash-sale', asyncHandler(async (req, res) => {
    const products = await Product.find({ isActive: true, flashSale: true, isReviewRemoved: { $ne: true } }).limit(20);
    res.status(200).json(new ApiResponse(200, products, 'Flash sale products.'));
}));

// GET /api/products/new-arrivals
router.get('/new-arrivals', asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        sort = 'newest',
        search,
        q,
        minPrice,
        maxPrice,
        minRating,
    } = req.query;

    const numericPage = Math.max(Number(page) || 1, 1);
    const numericLimit = Math.max(Number(limit) || 20, 1);
    const skip = (numericPage - 1) * numericLimit;

    const filter = { isActive: true, isNewArrival: true, isReviewRemoved: { $ne: true } };
    const searchQuery = String(search || q || '').trim();
    if (searchQuery) filter.$text = { $search: searchQuery };
    if (minPrice || maxPrice) {
        filter.price = {
            ...(minPrice ? { $gte: Number(minPrice) } : {}),
            ...(maxPrice ? { $lte: Number(maxPrice) } : {}),
        };
    }
    if (minRating) {
        filter.rating = { $gte: Number(minRating) };
    }

    const sortMap = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        'price-asc': { price: 1 },
        'price-desc': { price: -1 },
        popular: { reviewCount: -1 },
        rating: { rating: -1 },
    };

    const [products, total] = await Promise.all([
        Product.find(filter)
            .populate('categoryId', 'name')
            .populate('brandId', 'name')
            .populate('vendorId', 'storeName')
            .sort(sortMap[sort] || sortMap.newest)
            .skip(skip)
            .limit(numericLimit),
        Product.countDocuments(filter),
    ]);

    const enrichedProducts = await enrichProductsWithGst(products);

    res.status(200).json(new ApiResponse(200, {
        products: enrichedProducts,
        total,
        page: numericPage,
        pages: Math.ceil(total / numericLimit),
    }, 'New arrivals fetched.'));
}));

// GET /api/products/popular
router.get('/popular', asyncHandler(async (req, res) => {
    const products = await Product.find({ isActive: true, isReviewRemoved: { $ne: true } }).sort({ reviewCount: -1, rating: -1 }).limit(10);
    const enrichedProducts = await enrichProductsWithGst(products);
    res.status(200).json(new ApiResponse(200, enrichedProducts, 'Popular products.'));
}));

// GET /api/products/similar/:id
router.get('/similar/:id', asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new ApiError(404, 'Product not found.');
    const similar = await Product.find({ isActive: true, isReviewRemoved: { $ne: true }, _id: { $ne: product._id }, categoryId: product.categoryId }).limit(6);
    const enrichedSimilar = await enrichProductsWithGst(similar);
    res.status(200).json(new ApiResponse(200, enrichedSimilar, 'Similar products.'));
}));

const getProductDetail = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id).populate('categoryId', 'name').populate('brandId', 'name').populate('vendorId', 'storeName storeLogo rating');
    if (!product) throw new ApiError(404, 'Product not found.');
    if (product.isReviewRemoved) {
        throw new ApiError(400, 'This product is currently unavailable.');
    }
    const enrichedProduct = await enrichProductsWithGst(product);
    res.status(200).json(new ApiResponse(200, enrichedProduct, 'Product detail.'));
});

// GET /api/products/:id
router.get('/products/:id', getProductDetail);

// GET /api/products/gst/effective
router.get('/products/gst/effective', asyncHandler(async (req, res) => {
    const { productId, categoryId, price, taxIncluded } = req.query;

    const { getEffectiveGstRate, calculateGst } = await import('../services/gst.service.js');
    const effective = await getEffectiveGstRate(productId || null, categoryId || null);
    const calculations = calculateGst(price || 0, effective.rate, taxIncluded === 'true');

    res.status(200).json(new ApiResponse(200, { effective, calculations }, 'GST details resolved.'));
}));

// GET /api/products/:id/gst
router.get('/products/:id/gst', asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id).select('categoryId price taxIncluded').lean();
    if (!product) throw new ApiError(404, 'Product not found.');

    const { getEffectiveGstRate, calculateGst } = await import('../services/gst.service.js');
    const effective = await getEffectiveGstRate(product._id, product.categoryId);
    const calculations = calculateGst(product.price, effective.rate, product.taxIncluded);

    res.status(200).json(new ApiResponse(200, { effective, calculations }, 'Product GST resolved.'));
}));

// POST /api/cart/gst-preview
router.post('/cart/gst-preview', asyncHandler(async (req, res) => {
    const { items = [] } = req.body;
    const { calculateOrderGst } = await import('../services/gst.service.js');
    const result = await calculateOrderGst(items);
    res.status(200).json(new ApiResponse(200, result, 'Cart GST preview resolved.'));
}));

// GET /api/categories (public)
router.get('/categories/all', asyncHandler(async (req, res) => {
    const categories = await Category.find({ isActive: true }).sort({ order: 1 });
    res.status(200).json(new ApiResponse(200, categories, 'Categories fetched.'));
}));

// GET /api/brands (public)
router.get('/brands/all', asyncHandler(async (req, res) => {
    const brands = await Brand.find({ isActive: true })
        .select('name logo slug isFeatured')
        .sort({ name: 1 })
        .lean();
    res.status(200).json(new ApiResponse(200, brands, 'Brands fetched.'));
}));

// GET /api/vendors/all (public)
router.get('/vendors/all', asyncHandler(async (req, res) => {
    const { status = 'approved', page = 1, limit = 50, search } = req.query;
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100); // Cap max limit at 100 to prevent RAM spike & 502 Bad Gateway
    const skip = (numericPage - 1) * numericLimit;
    const filter = {};

    if (status && status !== 'all') {
        filter.status = status;
    }

    const trimmedSearch = String(search || '').trim();
    if (trimmedSearch) {
        const safeRegex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ name: safeRegex }, { email: safeRegex }, { storeName: safeRegex }, { legalBusinessName: safeRegex }];
    }

    const vendors = await Vendor.find(filter)
        .select('-password -otp -otpExpiry -bankDetails -commissionRate -gstCertificate -panCardDocument -fssaiLicenseDocument')
        .sort({ rating: -1, reviewCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(numericLimit)
        .lean();

    const total = await Vendor.countDocuments(filter);

    const vendorIds = vendors.map((v) => v._id);
    const productCounts = vendorIds.length > 0 ? await Product.aggregate([
        { $match: { vendorId: { $in: vendorIds }, isActive: true, isReviewRemoved: { $ne: true } } },
        { $group: { _id: '$vendorId', count: { $sum: 1 } } }
    ]) : [];

    const countMap = {};
    productCounts.forEach((item) => {
        if (item._id) {
            countMap[String(item._id)] = item.count;
        }
    });

    const publicVendors = vendors.map((vendor) => {
        const vId = String(vendor._id);
        return toPublicVendor(vendor, countMap[vId] || 0);
    });

    res.status(200).json(new ApiResponse(200, {
        vendors: publicVendors,
        total,
        page: numericPage,
        pages: Math.ceil(total / numericLimit)
    }, 'Vendors fetched.'));
}));

// GET /api/vendors/:id (public)
router.get('/vendors/:id', asyncHandler(async (req, res) => {
    const vendor = await Vendor.findOne({
        _id: req.params.id,
        status: 'approved',
    }).select('-password -otp -otpExpiry');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    const productCount = await Product.countDocuments({
        vendorId: vendor._id,
        isActive: true,
        isReviewRemoved: { $ne: true }
    });

    res.status(200).json(new ApiResponse(200, toPublicVendor(vendor, productCount), 'Vendor detail fetched.'));
}));

// GET /api/vendors/:id/products (public)
router.get('/vendors/:id/products', asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, sort = 'newest' } = req.query;
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (numericPage - 1) * numericLimit;

    const sortMap = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        'price-asc': { price: 1 },
        'price-desc': { price: -1 },
        popular: { reviewCount: -1 },
        rating: { rating: -1 },
    };

    const vendor = await Vendor.findOne({
        _id: req.params.id,
        status: 'approved',
    }).select('_id');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    const filter = { isActive: true, vendorId: req.params.id, isReviewRemoved: { $ne: true } };
    const products = await Product.find(filter)
        .populate('categoryId', 'name')
        .populate('brandId', 'name')
        .populate('vendorId', 'storeName')
        .sort(sortMap[sort] || { createdAt: -1 })
        .skip(skip)
        .limit(numericLimit);
    const total = await Product.countDocuments(filter);

    res.status(200).json(new ApiResponse(200, {
        products,
        total,
        page: numericPage,
        pages: Math.ceil(total / numericLimit)
    }, 'Vendor products fetched.'));
}));

// POST /api/coupons/validate
router.post('/coupons/validate', asyncHandler(async (req, res) => {
    const rawCode = String(req.body?.code || '').trim();
    const cartTotal = Number(req.body?.cartTotal);

    if (!rawCode) {
        throw new ApiError(400, 'Coupon code is required.');
    }
    if (!Number.isFinite(cartTotal) || cartTotal < 0) {
        throw new ApiError(400, 'Cart total must be a valid non-negative number.');
    }

    const coupon = await Coupon.findOne({ code: rawCode.toUpperCase(), isActive: true });
    if (!coupon) throw new ApiError(400, 'Invalid coupon code.');
    if (coupon.startsAt && coupon.startsAt > Date.now()) throw new ApiError(400, 'Coupon is not active yet.');
    if (coupon.expiresAt && coupon.expiresAt < Date.now()) throw new ApiError(400, 'Coupon has expired.');
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new ApiError(400, 'Coupon usage limit reached.');
    if (cartTotal < coupon.minOrderValue) throw new ApiError(400, `Minimum order value for this coupon is Rs.${coupon.minOrderValue}.`);

    let discount = 0;
    if (coupon.type === 'percentage') {
        discount = (cartTotal * coupon.value) / 100;
        if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    } else if (coupon.type === 'fixed') {
        discount = coupon.value;
    }

    res.status(200).json(new ApiResponse(200, { coupon: { code: coupon.code, type: coupon.type, value: coupon.value }, discount }, 'Coupon is valid.'));
}));

// GET /api/coupons/available
router.get('/coupons/available', asyncHandler(async (req, res) => {
    const now = new Date();
    const coupons = await Coupon.find({
        isActive: true,
        $and: [
            { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
            { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gte: now } }] }
        ]
    })
        .select('code name type value minOrderValue maxDiscount expiresAt usageLimit usedCount')
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();

    res.status(200).json(new ApiResponse(200, coupons, 'Available coupons fetched.'));
}));

// POST /api/shipping/estimate
router.post('/shipping/estimate', asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const shippingAddress = req.body?.shippingAddress || {};
    const shippingOption = String(req.body?.shippingOption || 'standard');
    const couponType = req.body?.couponType || null;

    if (!items.length) {
        return res.status(200).json(
            new ApiResponse(200, { shipping: 0, byVendor: {} }, 'Shipping estimate calculated.')
        );
    }

    const productIds = items
        .map((item) => String(item?.productId || '').trim())
        .filter((id) => /^[a-fA-F0-9]{24}$/.test(id));
    if (!productIds.length) {
        return res.status(200).json(
            new ApiResponse(200, { shipping: 0, byVendor: {} }, 'Shipping estimate calculated.')
        );
    }

    const products = await Product.find({ _id: { $in: productIds }, isActive: true })
        .populate('vendorId', 'shippingEnabled defaultShippingRate freeShippingThreshold')
        .select('_id vendorId price variants.prices')
        .lean();

    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const vendorMap = {};

    items.forEach((item) => {
        const product = productMap.get(String(item?.productId || ''));
        if (!product || !product.vendorId) return;

        const vendorId = String(product.vendorId._id || product.vendorId);
        const quantity = Math.max(1, Number(item?.quantity || 1));
        const price = Math.max(0, Number(resolveVariantPrice(product, item?.variant) || 0));
        const subtotal = price * quantity;

        if (!vendorMap[vendorId]) {
            vendorMap[vendorId] = {
                vendorId,
                subtotal: 0,
                shippingEnabled: product.vendorId.shippingEnabled !== false,
                defaultShippingRate: product.vendorId.defaultShippingRate,
                freeShippingThreshold: product.vendorId.freeShippingThreshold,
            };
        }
        vendorMap[vendorId].subtotal += subtotal;
    });

    const { totalShipping, shippingByVendor } = await calculateVendorShippingForGroups({
        vendorGroups: Object.values(vendorMap),
        shippingAddress,
        shippingOption,
        couponType,
    });

    res.status(200).json(
        new ApiResponse(200, { shipping: totalShipping, byVendor: shippingByVendor }, 'Shipping estimate calculated.')
    );
}));

// GET /api/banners
router.get('/banners', asyncHandler(async (req, res) => {
    const { type } = req.query;
    const now = new Date();
    const bufferTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24-hour buffer to handle timezone mismatches
    const filter = {
        isActive: true,
        $and: [
            { $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: bufferTime } }] },
            { $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }] }
        ]
    };
    if (type) filter.type = type;
    const banners = await Banner.find(filter).sort({ order: 1 });
    res.status(200).json(new ApiResponse(200, banners, 'Banners fetched.'));
}));

// GET /api/campaigns
router.get('/campaigns', asyncHandler(async (req, res) => {
    const { type, limit = 20 } = req.query;
    const parsedLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const now = new Date();

    const query = {
        isActive: true,
        $and: [
            { $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: now } }] },
            { $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }] }
        ]
    };
    if (type) query.type = type;

    const campaigns = await Campaign.find(query)
        .select('name slug type route discountType discountValue startDate endDate bannerConfig')
        .sort({ createdAt: -1 })
        .limit(parsedLimit);

    res.status(200).json(new ApiResponse(200, campaigns, 'Campaigns fetched.'));
}));

// GET /api/campaigns/:slug
router.get('/campaigns/:slug', asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) throw new ApiError(400, 'Campaign slug is required.');

    const campaign = await Campaign.findOne({ slug, isActive: true });
    if (!campaign) throw new ApiError(404, 'Campaign not found.');

    const now = new Date();
    if (campaign.startDate && campaign.startDate > now) {
        throw new ApiError(404, 'Campaign is not active yet.');
    }
    if (campaign.endDate && campaign.endDate < now) {
        throw new ApiError(404, 'Campaign has ended.');
    }

    const productIds = Array.isArray(campaign.productIds)
        ? campaign.productIds
            .map((value) => String(value || '').trim())
            .filter((value) => value && /^[a-fA-F0-9]{24}$/.test(value))
        : [];

    const products = await Product.find({
        _id: { $in: productIds },
        isActive: true
    })
        .populate('categoryId', 'name')
        .populate('brandId', 'name')
        .populate('vendorId', 'storeName')
        .sort({ createdAt: -1 });

    const payload = {
        ...campaign.toObject(),
        id: String(campaign._id),
        products,
    };

    res.status(200).json(new ApiResponse(200, payload, 'Campaign fetched.'));
}));

// GET /api/orders/track/:id (public order tracking)
router.get('/orders/track/:id', asyncHandler(async (req, res) => {
    const { default: Order } = await import('../models/Order.model.js');
    const order = await Order.findOne({ orderId: req.params.id }).select('orderId status trackingNumber estimatedDelivery deliveredAt createdAt updatedAt cancelledAt');
    if (!order) throw new ApiError(404, 'Order not found.');
    res.status(200).json(new ApiResponse(200, order, 'Order tracking info.'));
}));

// Legacy support: GET /api/:id (only ObjectId-like values to avoid swallowing unknown routes)
router.get('/:id([a-fA-F0-9]{24})', getProductDetail);

export default router;
