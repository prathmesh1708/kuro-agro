import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../utils/api';

const isMongoObjectId = (value) => typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);

const normalizeReview = (review) => ({
  ...review,
  id: review?.id || review?._id || Date.now().toString(),
  user: review?.user || review?.userId?.name || 'User',
  customerEmail: review?.customerEmail || review?.userId?.email || 'user@example.com',
  date: review?.date || review?.createdAt || new Date().toISOString(),
  helpfulCount: review?.helpfulCount || 0,
  notHelpfulCount: review?.notHelpfulCount || 0,
  status: review?.status || 'active', // 'active', 'removed', 'reported'
});

const INITIAL_MOCK_REVIEWS = [
  {
    id: "rev-1",
    productId: "1",
    productName: "Men's Slim Fit Shirt",
    user: "John Doe",
    customerEmail: "john.doe@example.com",
    rating: 5,
    comment: "Excellent quality and fits perfectly! Will buy again.",
    status: "active",
    date: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "rev-2",
    productId: "1",
    productName: "Men's Slim Fit Shirt",
    user: "Alice Smith",
    customerEmail: "alice.s@example.com",
    rating: 4,
    comment: "Nice fabric, but the sleeves are slightly longer than expected.",
    status: "active",
    date: "2026-06-02T14:30:00.000Z",
  },
  {
    id: "rev-3",
    productId: "2",
    productName: "Leather Sneakers",
    user: "Robert Johnson",
    customerEmail: "robert.j@example.com",
    rating: 3,
    comment: "The shoes look great, but the sole is a bit stiff.",
    status: "reported",
    date: "2026-06-03T11:20:00.000Z",
  },
  {
    id: "rev-4",
    productId: "3",
    productName: "Classic Leather Bag",
    user: "Emma Davis",
    customerEmail: "emma.d@example.com",
    rating: 5,
    comment: "Super spacious and very premium leather feel. Highly recommend!",
    status: "active",
    date: "2026-06-04T09:15:00.000Z",
  },
  {
    id: "rev-5",
    productId: "4",
    productName: "Gold Plated Necklace",
    user: "Sarah Wilson",
    customerEmail: "sarah.w@example.com",
    rating: 2,
    comment: "It started tarnishing after just two wears. Disappointed.",
    status: "active",
    date: "2026-06-05T16:45:00.000Z",
  },
  {
    id: "rev-6",
    productId: "2",
    productName: "Leather Sneakers",
    user: "Michael Brown",
    customerEmail: "michael.b@example.com",
    rating: 1,
    comment: "Worst purchase. The stitching came apart on day one.",
    status: "removed",
    date: "2026-06-06T08:00:00.000Z",
  }
];

export const useReviewsStore = create(
  persist(
    (set, get) => ({
      reviews: {}, // Maps productId -> array of normalized reviews
      allReviews: INITIAL_MOCK_REVIEWS, // Global array for Admin Reviews Management
      blockedUsers: [], // Array of username or email strings that are blocked
      votes: {},
      isLoading: false,
      error: null,

      fetchReviews: async (productId, options = {}) => {
        const normalizedProductId = String(productId);
        // If we don't have reviews for this product in state yet, filter from allReviews
        const localReviews = get().allReviews.filter((r) => String(r.productId) === normalizedProductId);
        
        if (!productId || !isMongoObjectId(normalizedProductId)) {
          // Frontend-only products: return local filtered sorted reviews
          set((state) => ({
            reviews: {
              ...state.reviews,
              [normalizedProductId]: localReviews,
            }
          }));
          return get().sortReviews(normalizedProductId, options?.sort || 'newest');
        }

        set({ isLoading: true, error: null });
        try {
          const { sort = 'newest', page = 1, limit = 20 } = options;
          const response = await api.get(
            `/user/reviews/product/${productId}?sort=${encodeURIComponent(sort)}&page=${page}&limit=${limit}`
          );
          const payload = response?.data || {};
          const fetched = Array.isArray(payload?.reviews)
            ? payload.reviews.map(normalizeReview)
            : [];

          // Merge fetched API reviews with any local state updates or newly added ones
          set((state) => {
            const currentLocal = state.reviews[normalizedProductId] || [];
            // Keep status from local state (if it has been moderated to 'removed' or 'reported')
            const merged = fetched.map(apiRev => {
              const localRev = currentLocal.find(l => String(l.id) === String(apiRev.id));
              return localRev ? { ...apiRev, status: localRev.status } : apiRev;
            });

            // Also include locally added reviews that might not be on the server yet
            const apiIds = new Set(merged.map(r => String(r.id)));
            const localOnly = currentLocal.filter(l => !apiIds.has(String(l.id)));
            const finalReviews = [...merged, ...localOnly];

            // Update allReviews global array as well
            const otherReviews = state.allReviews.filter(r => String(r.productId) !== normalizedProductId);

            return {
              reviews: {
                ...state.reviews,
                [normalizedProductId]: finalReviews,
              },
              allReviews: [...otherReviews, ...finalReviews],
              isLoading: false,
            };
          });

          return get().getReviews(normalizedProductId);
        } catch (error) {
          // Fall back to local state on API failure
          set({ isLoading: false, error: error?.message || 'Failed to fetch reviews' });
          set((state) => ({
            reviews: {
              ...state.reviews,
              [normalizedProductId]: localReviews,
            }
          }));
          return get().sortReviews(normalizedProductId, options?.sort || 'newest');
        }
      },

      // Add review for a product
      addReview: async (productId, review) => {
        const normalizedProductId = String(productId);
        const username = review?.user || 'User';
        const userEmail = review?.customerEmail || 'user@example.com';

        // Check if user is blocked before allowing review submission
        if (get().blockedUsers.includes(username) || get().blockedUsers.includes(userEmail)) {
          return false;
        }

        const newReview = normalizeReview({
          ...review,
          productId: normalizedProductId,
          productName: review.productName || 'Product',
          user: username,
          customerEmail: userEmail,
          status: 'active',
          id: Date.now().toString(),
        });

        // Add to local state first
        set((state) => {
          const productReviews = state.reviews[normalizedProductId] || [];
          return {
            reviews: {
              ...state.reviews,
              [normalizedProductId]: [...productReviews, newReview],
            },
            allReviews: [newReview, ...state.allReviews],
          };
        });

        if (!isMongoObjectId(normalizedProductId)) {
          return true;
        }

        // Attempt backend upload if Mongo ObjectId
        try {
          const response = await api.post('/user/reviews', {
            productId: normalizedProductId,
            orderId: review?.orderId,
            rating: review?.rating,
            comment: review?.comment,
            images: review?.images || [],
          });
          const payload = response?.data;
          if (payload) {
            const added = normalizeReview(payload);
            set((state) => {
              const currentReviews = (state.reviews[normalizedProductId] || []).filter(r => String(r.id) !== String(newReview.id));
              const currentAll = state.allReviews.filter(r => String(r.id) !== String(newReview.id));
              return {
                reviews: {
                  ...state.reviews,
                  [normalizedProductId]: [...currentReviews, added],
                },
                allReviews: [added, ...currentAll],
              };
            });
          }
          return true;
        } catch {
          // Silently fall back to frontend local review if API fails
          return true;
        }
      },

      updateReview: async (productId, reviewId, rating, comment, images) => {
        const normalizedProductId = String(productId);
        const normalizedReviewId = String(reviewId);

        set((state) => {
          const productReviews = state.reviews[normalizedProductId] || [];
          const updated = productReviews.map((r) =>
            String(r.id) === normalizedReviewId
              ? { ...r, rating, comment, images: images || r.images }
              : r
          );
          const updatedAll = state.allReviews.map((r) =>
            String(r.id) === normalizedReviewId
              ? { ...r, rating, comment, images: images || r.images }
              : r
          );
          return {
            reviews: {
              ...state.reviews,
              [normalizedProductId]: updated,
            },
            allReviews: updatedAll,
          };
        });

        if (!isMongoObjectId(normalizedProductId) || !isMongoObjectId(normalizedReviewId)) {
          return true;
        }

        try {
          const response = await api.put(`/user/reviews/${reviewId}`, {
            rating,
            comment,
            images: images || [],
          });
          const payload = response?.data;
          if (payload) {
            const updated = normalizeReview(payload);
            set((state) => {
              const currentReviews = (state.reviews[normalizedProductId] || []).map((r) =>
                String(r.id) === normalizedReviewId ? updated : r
              );
              const currentAll = state.allReviews.map((r) =>
                String(r.id) === normalizedReviewId ? updated : r
              );
              return {
                reviews: {
                  ...state.reviews,
                  [normalizedProductId]: currentReviews,
                },
                allReviews: currentAll,
              };
            });
          }
          return true;
        } catch (error) {
          throw error;
        }
      },

      deleteReview: async (productId, reviewId) => {
        const normalizedProductId = String(productId);
        const normalizedReviewId = String(reviewId);

        set((state) => {
          const productReviews = state.reviews[normalizedProductId] || [];
          const filtered = productReviews.filter((r) => String(r.id) !== normalizedReviewId);
          const filteredAll = state.allReviews.filter((r) => String(r.id) !== normalizedReviewId);
          return {
            reviews: {
              ...state.reviews,
              [normalizedProductId]: filtered,
            },
            allReviews: filteredAll,
          };
        });

        if (!isMongoObjectId(normalizedProductId) || !isMongoObjectId(normalizedReviewId)) {
          return true;
        }

        try {
          await api.delete(`/user/reviews/${reviewId}`);
          return true;
        } catch (error) {
          throw error;
        }
      },

      // Get reviews for a product
      getReviews: (productId) => {
        const state = get();
        const reviews = state.reviews[String(productId)] || [];
        // Filter out removed reviews on the client side
        return reviews.filter(r => r.status !== 'removed');
      },

      // Moderation Actions (Frontend Only)
      removeReview: (reviewId) => {
        set((state) => {
          const updatedAll = state.allReviews.map(r => 
            String(r.id) === String(reviewId) ? { ...r, status: 'removed' } : r
          );
          
          // Also update mapping by productId
          const updatedReviews = { ...state.reviews };
          Object.keys(updatedReviews).forEach(prodId => {
            updatedReviews[prodId] = updatedReviews[prodId].map(r =>
              String(r.id) === String(reviewId) ? { ...r, status: 'removed' } : r
            );
          });

          return {
            allReviews: updatedAll,
            reviews: updatedReviews
          };
        });
      },

      restoreReview: (reviewId) => {
        set((state) => {
          const updatedAll = state.allReviews.map(r => 
            String(r.id) === String(reviewId) ? { ...r, status: 'active' } : r
          );
          
          const updatedReviews = { ...state.reviews };
          Object.keys(updatedReviews).forEach(prodId => {
            updatedReviews[prodId] = updatedReviews[prodId].map(r =>
              String(r.id) === String(reviewId) ? { ...r, status: 'active' } : r
            );
          });

          return {
            allReviews: updatedAll,
            reviews: updatedReviews
          };
        });
      },

      blockUser: (userIdentifier) => {
        if (!userIdentifier) return;
        set((state) => ({
          blockedUsers: [...new Set([...state.blockedUsers, userIdentifier.trim()])]
        }));
      },

      unblockUser: (userIdentifier) => {
        if (!userIdentifier) return;
        set((state) => ({
          blockedUsers: state.blockedUsers.filter(u => u !== userIdentifier.trim())
        }));
      },

      isUserBlocked: (userIdentifier) => {
        if (!userIdentifier) return false;
        const normalized = userIdentifier.trim();
        return get().blockedUsers.includes(normalized);
      },

      // Vote on review helpfulness
      voteHelpful: async (productId, reviewId) => {
        const normalizedProductId = String(productId);
        const voteKey = `${normalizedProductId}_${reviewId}`;
        if (get().votes[voteKey]) {
          return false;
        }

        if (isMongoObjectId(normalizedProductId) && isMongoObjectId(String(reviewId))) {
          try {
            const response = await api.post(`/user/reviews/${reviewId}/helpful`);
            const payload = response?.data;
            const helpfulCount = payload?.helpfulCount;
            set((state) => ({
              reviews: {
                ...state.reviews,
                [normalizedProductId]: (state.reviews[normalizedProductId] || []).map((review) =>
                  review.id === reviewId || review._id === reviewId
                    ? {
                      ...review,
                      helpfulCount: typeof helpfulCount === 'number'
                        ? helpfulCount
                        : (review.helpfulCount || 0) + 1,
                    }
                    : review
                ),
              },
              votes: {
                ...state.votes,
                [voteKey]: 'helpful',
              },
            }));
            return true;
          } catch {
            return false;
          }
        }

        set((state) => {
          if (state.votes[voteKey]) {
            return state; // Already voted
          }

          const productReviews = state.reviews[normalizedProductId] || [];
          const updatedReviews = productReviews.map((review) =>
            review.id === reviewId
              ? { ...review, helpfulCount: (review.helpfulCount || 0) + 1 }
              : review
          );

          return {
            reviews: {
              ...state.reviews,
              [normalizedProductId]: updatedReviews,
            },
            votes: {
              ...state.votes,
              [voteKey]: 'helpful',
            },
          };
        });
        return true;
      },

      // Vote on review not helpful
      voteNotHelpful: (productId, reviewId) => {
        set((state) => {
          const voteKey = `${productId}_${reviewId}`;
          if (state.votes[voteKey]) {
            return state; // Already voted
          }

          const productReviews = state.reviews[productId] || [];
          const updatedReviews = productReviews.map((review) =>
            review.id === reviewId
              ? { ...review, notHelpfulCount: (review.notHelpfulCount || 0) + 1 }
              : review
          );

          return {
            reviews: {
              ...state.reviews,
              [productId]: updatedReviews,
            },
            votes: {
              ...state.votes,
              [voteKey]: 'not-helpful',
            },
          };
        });
      },

      // Check if user has voted on a review
      hasVoted: (productId, reviewId) => {
        const state = get();
        const voteKey = `${productId}_${reviewId}`;
        return !!state.votes[voteKey];
      },

      // Sort reviews
      sortReviews: (productId, sortBy) => {
        const state = get();
        const reviews = state.reviews[String(productId)] || [];
        // Filter out removed reviews before sorting/returning to UserApp
        let sorted = [...reviews].filter(r => r.status !== 'removed');

        switch (sortBy) {
          case 'newest':
            sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
          case 'oldest':
            sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
          case 'most-helpful':
            sorted.sort(
              (a, b) =>
                (b.helpfulCount || 0) - (a.helpfulCount || 0) ||
                (a.notHelpfulCount || 0) - (b.notHelpfulCount || 0)
            );
            break;
          case 'highest-rating':
            sorted.sort((a, b) => b.rating - a.rating);
            break;
          case 'lowest-rating':
            sorted.sort((a, b) => a.rating - b.rating);
            break;
          default:
            break;
        }

        return sorted;
      },
    }),
    {
      name: 'reviews-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
