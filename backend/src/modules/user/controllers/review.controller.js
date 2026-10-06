import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Review from '../../../models/Review.model.js';
import Product from '../../../models/Product.model.js';
import Order from '../../../models/Order.model.js';
import { syncProductAndVendorReviewStats } from '../../../services/reviewAggregate.service.js';

// GET /api/user/reviews/product/:productId
export const getProductReviews = asyncHandler(async (req, res) => {
    const { sort = 'newest', page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const sortMap = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        'highest-rating': { rating: -1 },
        'lowest-rating': { rating: 1 },
        'most-helpful': { helpfulCount: -1 },
    };

    const reviews = await Review.find({ productId: req.params.productId, isApproved: true })
        .populate('userId', 'name avatar')
        .sort(sortMap[sort] || { createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

    const total = await Review.countDocuments({ productId: req.params.productId, isApproved: true });
    res.status(200).json(new ApiResponse(200, { reviews, total, page: Number(page), pages: Math.ceil(total / limit) }, 'Reviews fetched.'));
});

// POST /api/user/reviews
export const addReview = asyncHandler(async (req, res) => {
    const { productId, orderId, rating, comment, images } = req.body;

    // Verify purchase
    const order = await Order.findOne({ _id: orderId, userId: req.user.id, 'items.productId': productId, status: 'delivered' });
    if (!order) throw new ApiError(403, 'You can only review products you have purchased and received.');

    const existing = await Review.findOne({ productId, userId: req.user.id });
    if (existing) throw new ApiError(409, 'You have already reviewed this product.');

    const review = await Review.create({ productId, userId: req.user.id, orderId, rating, comment, images, isVerifiedPurchase: true });
    res.status(201).json(new ApiResponse(201, review, 'Review submitted and pending approval.'));
});

// POST /api/user/reviews/:id/helpful
export const voteHelpful = asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndUpdate(req.params.id, { $inc: { helpfulCount: 1 } }, { new: true });
    if (!review) throw new ApiError(404, 'Review not found.');
    res.status(200).json(new ApiResponse(200, review, 'Vote recorded.'));
});

// PUT /api/user/reviews/:id
export const updateReview = asyncHandler(async (req, res) => {
    const { rating, comment, images } = req.body;
    const review = await Review.findOne({ _id: req.params.id, userId: req.user.id });
    if (!review) throw new ApiError(404, 'Review not found.');

    if (typeof rating !== 'undefined') {
        const numericRating = Number(rating);
        if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
            throw new ApiError(400, 'Rating must be between 1 and 5.');
        }
        review.rating = numericRating;
    }
    if (typeof comment !== 'undefined') review.comment = comment;
    if (typeof images !== 'undefined') review.images = images;
    
    // When review is edited, reset approval status
    review.isApproved = false;

    await review.save();
    await syncProductAndVendorReviewStats(review.productId);

    res.status(200).json(new ApiResponse(200, review, 'Review updated successfully and pending approval.'));
});

// DELETE /api/user/reviews/:id
export const deleteUserReview = asyncHandler(async (req, res) => {
    const review = await Review.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!review) throw new ApiError(404, 'Review not found.');

    await syncProductAndVendorReviewStats(review.productId);

    res.status(200).json(new ApiResponse(200, null, 'Review deleted successfully.'));
});
