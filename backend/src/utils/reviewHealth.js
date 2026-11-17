// Single source of truth for review-health math and the
// "remove product due to poor reviews" eligibility rule.

export const REVIEW_REMOVAL_RULES = Object.freeze({
    minReviews: 15,
    maxAverageRating: 2.5, // average strictly below this qualifies
    minNegativePercentage: 60, // negative share strictly above this qualifies
});

// Only approved, non-hidden reviews count toward review health.
export const countedReviewFilter = (productId) => ({
    productId,
    isApproved: true,
    isHidden: { $ne: true },
});

export const getReviewHealthLabel = (averageRating) => {
    if (averageRating >= 4.5) return 'Excellent';
    if (averageRating >= 4.0) return 'Good';
    if (averageRating >= 3.0) return 'Average';
    if (averageRating >= 2.5) return 'Poor';
    return 'Critical';
};

export const isEligibleForReviewRemoval = ({ totalReviews, averageRating, negativeReviewPercentage }) =>
    totalReviews >= REVIEW_REMOVAL_RULES.minReviews &&
    (averageRating < REVIEW_REMOVAL_RULES.maxAverageRating ||
        negativeReviewPercentage > REVIEW_REMOVAL_RULES.minNegativePercentage);

// Ratings that round to 1 or 2 stars are negative.
const starBucket = (rating) => Math.min(5, Math.max(1, Math.round(rating || 0)));

export const computeReviewStats = (reviews = []) => {
    const totalReviews = reviews.length;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;

    reviews.forEach((r) => {
        ratingDistribution[starBucket(r.rating)] += 1;
        ratingSum += Number(r.rating) || 0;
    });

    const averageRating = totalReviews > 0 ? ratingSum / totalReviews : 0;
    const negativeReviewsCount = ratingDistribution[1] + ratingDistribution[2];
    const negativeReviewPercentage = totalReviews > 0 ? (negativeReviewsCount / totalReviews) * 100 : 0;
    const positiveReviewPercentage = totalReviews > 0 ? 100 - negativeReviewPercentage : 0;

    return {
        totalReviews,
        ratingDistribution,
        averageRating,
        negativeReviewPercentage,
        positiveReviewPercentage,
        reviewHealth: getReviewHealthLabel(averageRating),
        eligibleForRemoval: isEligibleForReviewRemoval({ totalReviews, averageRating, negativeReviewPercentage }),
    };
};

// Returns Map<productIdString, boolean> for a batch of products using one aggregate.
export const getRemovalEligibilityMap = async (ReviewModel, productIds = []) => {
    const map = new Map();
    if (!productIds.length) return map;

    const rows = await ReviewModel.aggregate([
        { $match: countedReviewFilter({ $in: productIds }) },
        {
            $group: {
                _id: '$productId',
                totalReviews: { $sum: 1 },
                ratingSum: { $sum: { $ifNull: ['$rating', 0] } },
                // round(rating) <= 2  <=>  rating < 2.5
                negativeCount: { $sum: { $cond: [{ $lt: [{ $ifNull: ['$rating', 0] }, 2.5] }, 1, 0] } },
            },
        },
    ]);

    rows.forEach((row) => {
        const averageRating = row.totalReviews > 0 ? row.ratingSum / row.totalReviews : 0;
        const negativeReviewPercentage = row.totalReviews > 0 ? (row.negativeCount / row.totalReviews) * 100 : 0;
        map.set(
            String(row._id),
            isEligibleForReviewRemoval({ totalReviews: row.totalReviews, averageRating, negativeReviewPercentage })
        );
    });

    return map;
};
