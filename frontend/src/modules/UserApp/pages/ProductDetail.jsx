import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FiStar,
  FiHeart,
  FiShoppingBag,
  FiMinus,
  FiPlus,
  FiArrowLeft,
  FiShare2,
  FiCheckCircle,
  FiTrash2,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useCartStore, useUIStore } from "../../../shared/store/useStore";
import { useWishlistStore } from "../../../shared/store/wishlistStore";
import { useReviewsStore } from "../../../shared/store/reviewsStore";
import { useOrderStore } from "../../../shared/store/orderStore";
import { useAuthStore } from "../../../shared/store/authStore";
import {
  getProductById,
  getSimilarProducts,
  getVendorById,
  getBrandById,
} from "../data/catalogData";
import api from "../../../shared/utils/api";
import { formatPrice } from "../../../shared/utils/helpers";
import toast from "react-hot-toast";
import MobileLayout from "../components/Layout/MobileLayout";
import ImageGallery from "../../../shared/components/Product/ImageGallery";
import VariantSelector from "../../../shared/components/Product/VariantSelector";
import ReviewForm from "../../../shared/components/Product/ReviewForm";
import MobileProductCard from "../components/Mobile/MobileProductCard";
import PageTransition from "../../../shared/components/PageTransition";
import Badge from "../../../shared/components/Badge";
import ProductCard from "../../../shared/components/ProductCard";
import { getVariantSignature } from "../../../shared/utils/variant";

const resolveVariantPrice = (product, selectedVariant) => {
  const basePrice = Number(product?.price) || 0;
  if (!selectedVariant || !product?.variants?.prices) return basePrice;

  const entries =
    product.variants.prices instanceof Map
      ? Array.from(product.variants.prices.entries())
      : Object.entries(product.variants.prices || {});
  const dynamicKey = getVariantSignature(selectedVariant || {});
  if (dynamicKey) {
    const direct = entries.find(([key]) => String(key).trim() === dynamicKey);
    if (direct) {
      const parsed = Number(direct[1]);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    const normalized = entries.find(
      ([key]) => String(key).trim().toLowerCase() === dynamicKey.toLowerCase()
    );
    if (normalized) {
      const parsed = Number(normalized[1]);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }

  const size = String(selectedVariant.size || "").trim().toLowerCase();
  const color = String(selectedVariant.color || "").trim().toLowerCase();

  const candidates = [
    `${size}|${color}`,
    `${size}-${color}`,
    `${size}_${color}`,
    `${size}:${color}`,
    size && !color ? size : null,
    color && !size ? color : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const exact = entries.find(([key]) => String(key).trim() === candidate);
    if (exact) {
      const parsed = Number(exact[1]);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    const normalized = entries.find(
      ([key]) => String(key).trim().toLowerCase() === candidate
    );
    if (normalized) {
      const parsed = Number(normalized[1]);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }

  return basePrice;
};

const isMongoId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || ""));
const normalizeProduct = (raw) => {
  if (!raw) return null;

  const vendorObj =
    raw?.vendor && typeof raw.vendor === "object"
      ? raw.vendor
      : raw?.vendorId && typeof raw.vendorId === "object"
        ? raw.vendorId
        : null;
  const brandObj =
    raw?.brand && typeof raw.brand === "object"
      ? raw.brand
      : raw?.brandId && typeof raw.brandId === "object"
        ? raw.brandId
        : null;
  const categoryObj =
    raw?.category && typeof raw.category === "object"
      ? raw.category
      : raw?.categoryId && typeof raw.categoryId === "object"
        ? raw.categoryId
        : null;

  const id = String(raw?.id || raw?._id || "").trim();
  if (!id) return null;

  const vendorId = String(vendorObj?._id || vendorObj?.id || raw?.vendorId || "").trim();
  const brandId = String(brandObj?._id || brandObj?.id || raw?.brandId || "").trim();
  const categoryId = String(categoryObj?._id || categoryObj?.id || raw?.categoryId || "").trim();
  const image = raw?.image || raw?.images?.[0] || "";
  const images = Array.isArray(raw?.images) ? raw.images.filter(Boolean) : image ? [image] : [];

  return {
    ...raw,
    id,
    _id: id,
    vendorId,
    brandId,
    categoryId,
    image,
    images,
    price: Number(raw?.price) || 0,
    originalPrice:
      raw?.originalPrice !== undefined && raw?.originalPrice !== null
        ? Number(raw.originalPrice)
        : undefined,
    rating: Number(raw?.rating) || 0,
    reviewCount: Number(raw?.reviewCount) || 0,
    stockQuantity: Number(raw?.stockQuantity) || 0,
    vendorName: raw?.vendorName || vendorObj?.storeName || vendorObj?.name || "",
    brandName: raw?.brandName || brandObj?.name || "",
    categoryName: raw?.categoryName || categoryObj?.name || "",
    vendor: vendorObj
      ? {
        ...vendorObj,
        id: String(vendorObj?.id || vendorObj?._id || vendorId),
      }
      : null,
    brand: brandObj
      ? {
        ...brandObj,
        id: String(brandObj?.id || brandObj?._id || brandId),
      }
      : null,
    stock:
      raw?.stock ||
      (Number(raw?.stockQuantity) > 0 ? "in_stock" : "out_of_stock"),
    description: String(raw?.description || "").trim(),
  };
};

const MobileProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const localFallbackProduct = useMemo(() => normalizeProduct(getProductById(id)), [id]);
  const [product, setProduct] = useState(localFallbackProduct);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [highlightedMissingFields, setHighlightedMissingFields] = useState([]);

  const { items, addItem, removeItem } = useCartStore();
  const triggerCartAnimation = useUIStore(
    (state) => state.triggerCartAnimation
  );
  const {
    addItem: addToWishlist,
    removeItem: removeFromWishlist,
    isInWishlist,
  } = useWishlistStore();
  const { fetchReviews, sortReviews, addReview, blockedUsers } = useReviewsStore();
  const { getAllOrders } = useOrderStore();
  const { user, isAuthenticated } = useAuthStore();
  const isBlocked = isAuthenticated && user && (blockedUsers.includes(user.name) || blockedUsers.includes(user.email));
  const vendor = useMemo(() => {
    if (!product) return null;
    if (product.vendor?.id) return product.vendor;
    return getVendorById(product.vendorId);
  }, [product]);
  const brand = useMemo(() => {
    if (!product) return null;
    if (product.brand?.id) return product.brand;
    return getBrandById(product.brandId);
  }, [product]);

  const isFavorite = product ? isInWishlist(product.id) : false;
  const selectedVariantSignature = getVariantSignature(selectedVariant || {});
  const isInCart = product
    ? items.some(
      (item) =>
        String(item.id) === String(product.id) &&
        getVariantSignature(item.variant || {}) === selectedVariantSignature
    )
    : false;

  const [reviewSort, setReviewSort] = useState("newest");
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState("");
  const { updateReview, deleteReview } = useReviewsStore();

  const productReviews = product ? sortReviews(product.id, reviewSort) : [];

  const reviewStats = useMemo(() => {
    const total = productReviews.length;
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    productReviews.forEach((r) => {
      const rating = Math.min(5, Math.max(1, Math.round(r.rating || 0)));
      distribution[rating] = (distribution[rating] || 0) + 1;
      sum += r.rating;
    });
    const avg = total > 0 ? Number((sum / total).toFixed(1)) : 0;
    return { total, distribution, avg };
  }, [productReviews]);

  useEffect(() => {
    let active = true;
    setIsLoadingProduct(true);

    const loadProductDetail = async () => {
      try {
        const [detailRes, similarRes] = await Promise.allSettled([
          api.get(`/products/${id}`),
          api.get(`/similar/${id}`),
        ]);

        const detailPayload =
          detailRes.status === "fulfilled"
            ? detailRes.value?.data ?? detailRes.value
            : null;
        const resolvedProduct = normalizeProduct(detailPayload) || localFallbackProduct;

        const similarPayload =
          similarRes.status === "fulfilled"
            ? similarRes.value?.data ?? similarRes.value
            : null;
        const resolvedSimilar = Array.isArray(similarPayload)
          ? similarPayload
            .map(normalizeProduct)
            .filter(
              (item) => item?.id && String(item.id) !== String(resolvedProduct?.id || "")
            )
            .slice(0, 5)
          : [];

        if (!active) return;

        setProduct(resolvedProduct);
        if (resolvedSimilar.length > 0) {
          setSimilarProducts(resolvedSimilar);
        } else if (resolvedProduct?.id) {
          setSimilarProducts(getSimilarProducts(resolvedProduct.id, 5));
        } else {
          setSimilarProducts([]);
        }
      } catch {
        if (!active) return;
        setProduct(localFallbackProduct);
        setSimilarProducts(
          localFallbackProduct?.id ? getSimilarProducts(localFallbackProduct.id, 5) : []
        );
      } finally {
        if (active) setIsLoadingProduct(false);
      }
    };

    loadProductDetail();
    return () => {
      active = false;
    };
  }, [id, localFallbackProduct]);

  useEffect(() => {
    if (product?.variants?.defaultSelection && typeof product.variants.defaultSelection === "object") {
      setSelectedVariant(product.variants.defaultSelection);
      return;
    }
    if (product?.variants?.defaultVariant) {
      setSelectedVariant(product.variants.defaultVariant);
      return;
    }
    setSelectedVariant({});
  }, [product]);

  const productImages = useMemo(() => {
    if (!product) return [];
    const selectedVariantKey = getVariantSignature(selectedVariant || {});
    const variantImage = String(
      product?.variants?.imageMap?.[selectedVariantKey] ||
      product?.variants?.imageMap?.get?.(selectedVariantKey) ||
      ""
    ).trim();
    const images =
      Array.isArray(product.images) && product.images.length > 0
        ? product.images.filter(Boolean)
        : product.image
          ? [product.image]
          : [];
    if (variantImage) {
      return [variantImage, ...images.filter((img) => img !== variantImage)];
    }
    return images;
  }, [product, selectedVariant]);

  const currentPrice = useMemo(() => {
    return resolveVariantPrice(product, selectedVariant);
  }, [product, selectedVariant]);

  const selectedAvailableStock = useMemo(() => {
    const variantKey = getVariantSignature(selectedVariant || {});
    const variantStockValue = Number(
      product?.variants?.stockMap?.[variantKey] ??
      product?.variants?.stockMap?.get?.(variantKey)
    );
    if (Number.isFinite(variantStockValue)) {
      return Math.max(0, variantStockValue);
    }
    return Number(product?.stockQuantity || 0);
  }, [product, selectedVariant]);

  const productFaqs = useMemo(() => {
    if (!Array.isArray(product?.faqs)) return [];
    return product.faqs
      .map((faq) => ({
        question: String(faq?.question || "").trim(),
        answer: String(faq?.answer || "").trim(),
      }))
      .filter((faq) => faq.question && faq.answer);
  }, [product?.faqs]);

  const eligibleDeliveredOrderId = useMemo(() => {
    if (!isAuthenticated || !user?.id || !isMongoId(product?.id)) return null;
    const userOrders = getAllOrders(user.id) || [];
    const eligibleOrder = userOrders.find((order) => {
      if (String(order?.status || "").toLowerCase() !== "delivered") return false;
      const items = Array.isArray(order?.items) ? order.items : [];
      return items.some(
        (item) => String(item?.productId || item?.id || "") === String(product.id)
      );
    });
    return eligibleOrder?._id || null;
  }, [isAuthenticated, user?.id, product?.id, getAllOrders]);

  if (!product) {
    return (
      <PageTransition>
        <MobileLayout showBottomNav={false} showCartBar={false}>
          <div className="flex items-center justify-center min-h-[60vh] px-4">
            <div className="text-center">
              {isLoadingProduct ? (
                <h2 className="text-xl font-bold text-gray-800 mb-4">Loading product...</h2>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">
                    Product Not Found
                  </h2>
                  <button
                    onClick={() => navigate("/home")}
                    className="gradient-green text-white px-6 py-3 rounded-xl font-semibold">
                    Go Back Home
                  </button>
                </>
              )}
            </div>
          </div>
        </MobileLayout>
      </PageTransition>
    );
  }

  const handleAddToCart = () => {
    if (!product) return false;
    if (product.stock === "out_of_stock") {
      toast.error("Product is out of stock");
      return false;
    }
    const attributeAxes = Array.isArray(product?.variants?.attributes)
      ? product.variants.attributes.filter((attr) => Array.isArray(attr?.values) && attr.values.length > 0)
      : [];
    const hasDynamicAxes = attributeAxes.length > 0;
    const hasSizeVariants = Array.isArray(product?.variants?.sizes) && product.variants.sizes.length > 0;
    const hasColorVariants = Array.isArray(product?.variants?.colors) && product.variants.colors.length > 0;

    const missingOptions = [];
    const selectedSize = String(selectedVariant?.size || "").trim();
    const selectedColor = String(selectedVariant?.color || "").trim();

    if (hasSizeVariants && !selectedSize) {
      missingOptions.push("Size");
    }
    if (hasColorVariants && !selectedColor) {
      missingOptions.push("Color");
    }
    if (hasDynamicAxes) {
      attributeAxes.forEach((attr) => {
        const val = String(
          selectedVariant?.[attr.name] ||
          selectedVariant?.[String(attr.name || "").toLowerCase().replace(/\s+/g, "_")] ||
          ""
        ).trim();
        if (!val) {
          missingOptions.push(attr.name);
        }
      });
    }

    if (missingOptions.length > 0) {
      setHighlightedMissingFields(missingOptions);
      setTimeout(() => {
        setHighlightedMissingFields([]);
      }, 1000);

      toast.error(`Please select variant options: ${missingOptions.join(", ")}`, {
        duration: 3000,
        position: "top-center",
        icon: "⚠️",
      });

      const selectorElement = document.querySelector("[data-variant-selector]");
      if (selectorElement) {
        selectorElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return false;
    }

    const finalPrice = resolveVariantPrice(product, selectedVariant);
    const variantKey = getVariantSignature(selectedVariant || {});
    const variantStockValue = Number(
      product?.variants?.stockMap?.[variantKey] ??
      product?.variants?.stockMap?.get?.(variantKey)
    );
    const effectiveStock = Number.isFinite(variantStockValue)
      ? variantStockValue
      : Number(product.stockQuantity || 0);
    if (effectiveStock <= 0) {
      toast.error("Selected variant is out of stock");
      return false;
    }
    if (quantity > effectiveStock) {
      toast.error(`Only ${effectiveStock} item(s) available for selected variant`);
      return false;
    }

    const addedToCart = addItem({
      id: product.id,
      name: product.name,
      price: finalPrice,
      image: product.image,
      quantity: quantity,
      variant: selectedVariant,
      stockQuantity: effectiveStock,
      vendorId: product.vendorId,
      vendorName: vendor?.storeName || vendor?.name || product.vendorName,
    });
    if (!addedToCart) return false;
    triggerCartAnimation();
    toast.success("Added to cart!");
    return true;
  };

  const handleRemoveFromCart = () => {
    if (!product) return;
    removeItem(product.id, selectedVariant || {});
    toast.success("Removed from cart!");
  };

  const handleFavorite = () => {
    if (!product) return;
    if (isFavorite) {
      removeFromWishlist(product.id);
      toast.success("Removed from wishlist");
    } else {
      const addedToWishlist = addToWishlist({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
      });
      if (addedToWishlist) {
        toast.success("Added to wishlist");
      }
    }
  };

  const handleQuantityChange = (change) => {
    const newQuantity = quantity + change;
    const variantKey = getVariantSignature(selectedVariant || {});
    const variantStockValue = Number(
      product?.variants?.stockMap?.[variantKey] ??
      product?.variants?.stockMap?.get?.(variantKey)
    );
    const maxStock = Number.isFinite(variantStockValue)
      ? Math.max(0, variantStockValue)
      : Number(product?.stockQuantity || 0);
    if (newQuantity >= 1 && newQuantity <= (maxStock || 10)) {
      setQuantity(newQuantity);
    }
  };

  const handleSubmitReview = async (reviewData) => {
    if (isBlocked) {
      toast.error("Your account has been temporarily blocked. Please contact support.");
      return false;
    }

    if (!eligibleDeliveredOrderId) {
      toast.error("You can review only after this product is delivered");
      return false;
    }

    const ok = await addReview(product.id, {
      ...reviewData,
      orderId: eligibleDeliveredOrderId,
      user: user?.name || 'User',
      customerEmail: user?.email || 'user@example.com',
    });
    if (!ok) {
      toast.error("Unable to submit review");
      return false;
    }

    await fetchReviews(product.id, { sort: reviewSort, limit: 50 });
    return true;
  };

  const handleEditClick = (review) => {
    setEditingReviewId(review.id || review._id);
    setEditRating(review.rating);
    setEditComment(review.comment || "");
  };

  const handleSaveEdit = async (reviewId) => {
    if (editRating === 0) {
      toast.error("Please select a rating");
      return;
    }
    try {
      await updateReview(product.id, reviewId, editRating, editComment);
      setEditingReviewId(null);
      toast.success("Review updated successfully and pending moderation!");
      await fetchReviews(product.id, { sort: reviewSort, limit: 50 });
    } catch (err) {
      toast.error(err?.message || "Failed to update review");
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm("Are you sure you want to delete your review?")) return;
    try {
      await deleteReview(product.id, reviewId);
      toast.success("Review deleted successfully!");
      await fetchReviews(product.id, { sort: reviewSort, limit: 50 });
    } catch (err) {
      toast.error(err?.message || "Failed to delete review");
    }
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={true}>
        <div className="w-full pb-24 lg:pb-12 max-w-7xl mx-auto">
          {/* Back Button */}
          <div className="px-4 pt-4 lg:pt-8 lg:px-8 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors group">
              <div className="p-2 rounded-full group-hover:bg-gray-100 transition-colors">
                <FiArrowLeft className="text-xl" />
              </div>
              <span className="font-medium">Back</span>
            </button>
          </div>
          <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-16 lg:px-8 lg:items-start">
            {/* Left Column: Product Image */}
            <div className="px-4 py-4 lg:p-0 sticky top-24">
              <ImageGallery images={productImages} productName={product.name} />
              {product.flashSale && (
                <div className="mt-4 flex justify-center lg:justify-start">
                  <Badge variant="flash" size="lg">Flash Sale - Limited Time Offer</Badge>
                </div>
              )}
            </div>

            {/* Right Column: Product Info */}
            <div className="px-4 py-4 lg:p-0">
              <div className="flex flex-col gap-6">
                <div>
                  {product.flashSale && (
                    <div className="mb-4">
                      <div className="w-full bg-gradient-to-r from-[#581c87] via-[#86198f] to-[#581c87] border-2 border-[#d946ef]/60 shadow-[0_0_15px_rgba(168,85,247,0.4)] rounded-full px-6 py-2.5 flex items-center justify-center gap-2 text-white font-extrabold text-xs tracking-wider uppercase">
                        <span>Flash Sale - Extended for 24Hrs</span>
                        <span className="text-sm">⏱️</span>
                      </div>
                    </div>
                  )}

                  {/* Vendor Badge */}
                  {vendor && (
                    <div className="mb-4">
                      <Link
                        to={`/seller/${vendor.id}`}
                        className="inline-flex items-center gap-3 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full transition-all duration-300 border border-gray-200 group">
                        {vendor.storeLogo ? (
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-white border border-gray-200 flex-shrink-0">
                            <img
                              src={vendor.storeLogo}
                              alt={vendor.storeName || vendor.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                            <FiShoppingBag className="text-white text-xs" />
                          </div>
                        )}
                        <span className="font-medium text-sm group-hover:text-primary-600 transition-colors">
                          {vendor.storeName || vendor.name}
                        </span>
                        {vendor.isVerified && (
                          <FiCheckCircle
                            className="text-accent-500 text-sm"
                            title="Verified Vendor"
                          />
                        )}
                        <span className="text-gray-400 group-hover:translate-x-1 transition-transform">{"->"}</span>
                      </Link>
                    </div>
                  )}
                  {brand && (
                    <div className="mb-4">
                      <Link
                        to={`/brand/${brand.id}`}
                        className="inline-flex items-center gap-3 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full transition-all duration-300 border border-gray-200 group">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-white border border-gray-200 flex-shrink-0 flex items-center justify-center">
                          <img
                            src={brand.logo}
                            alt={brand.name}
                            className="w-full h-full object-contain p-0.5"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                        <span className="font-medium text-sm group-hover:text-primary-600 transition-colors">
                          {brand.name}
                        </span>
                        <span className="text-gray-400 group-hover:translate-x-1 transition-transform">{"->"}</span>
                      </Link>
                    </div>
                  )}

                  <h1 className="text-2xl lg:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
                    {product.name}
                  </h1>

                  {/* Rating & Reviews */}
                  <div className="flex items-center gap-1.5 mb-6">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const r = product.rating || 4.5;
                        if (star <= Math.floor(r)) {
                          return <FiStar key={star} className="text-yellow-500 fill-yellow-500 text-lg" />;
                        } else if (star - 0.5 <= r) {
                          return <FiStar key={star} className="text-yellow-500 fill-yellow-500 opacity-70 text-lg" />;
                        } else {
                          return <FiStar key={star} className="text-gray-300 text-lg" />;
                        }
                      })}
                    </div>
                    <span className="text-gray-500 text-sm font-bold ml-1">
                      ({product.reviewCount || 234} Reviews)
                    </span>
                  </div>

                  {/* Price Box */}
                  <div className="bg-gradient-to-br from-white to-[#f8fafc] rounded-2xl p-6 mb-8 border-2 border-gray-300/80 shadow-md">
                    <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl lg:text-5xl font-extrabold text-[#0F2C59]">
                          {formatPrice(currentPrice)}
                        </span>
                        {product.originalPrice && (
                          <span className="text-xl text-gray-400 line-through font-semibold">
                            {formatPrice(product.originalPrice)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100/90 border border-gray-300 rounded-full text-xs font-bold text-gray-600 shadow-sm">
                        <FiCheckCircle className="text-gray-500 text-sm" />
                        <span>Verified Authentic</span>
                      </div>
                    </div>
                    {product.originalPrice && (
                      <div className="flex items-center gap-3">
                        <span className="text-white font-extrabold bg-[#10B981] px-4 py-1 rounded-full text-xs tracking-wide shadow-sm">
                          {Math.round(
                            ((product.originalPrice - currentPrice) /
                              product.originalPrice) *
                            100
                          )}% OFF
                        </span>
                        <span className="text-sm font-semibold text-gray-700">Best price guaranteed</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Variants & Quantity */}
                <div className="space-y-6 border-b border-gray-100 pb-8">
                  {product.variants && (
                    <div data-variant-selector>
                      <VariantSelector
                        variants={product.variants}
                        onVariantChange={setSelectedVariant}
                        currentPrice={product.price}
                        highlightFields={highlightedMissingFields}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">
                      Quantity
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
                        <button
                          onClick={() => handleQuantityChange(-1)}
                          disabled={quantity <= 1}
                          className="w-10 h-10 flex items-center justify-center rounded-lg bg-white shadow-sm hover:shadow-md disabled:shadow-none disabled:bg-transparent disabled:opacity-50 transition-all text-gray-700">
                          <FiMinus />
                        </button>
                        <span className="w-12 text-center font-bold text-gray-900 text-lg">
                          {quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(1)}
                          disabled={quantity >= (selectedAvailableStock || 10)}
                          className="w-10 h-10 flex items-center justify-center rounded-lg bg-white shadow-sm hover:shadow-md disabled:shadow-none disabled:bg-transparent disabled:opacity-50 transition-all text-gray-700">
                          <FiPlus />
                        </button>
                      </div>
                      <span className="text-sm text-gray-500 font-semibold">
                        {selectedAvailableStock} {product.unit || 'Piece'}{selectedAvailableStock > 1 ? 's' : ''} available
                        {selectedAvailableStock <= 5 && selectedAvailableStock > 0 && (
                          <>
                            {' • '}
                            <span className="text-red-600 font-bold">
                              Low Stock: Only {selectedAvailableStock} Left!
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ACTION BUTTONS (MOBILE & DESKTOP INLINE) */}
                <div className="flex flex-col sm:flex-row gap-3 py-4">
                  {isInCart ? (
                    <button
                      onClick={handleRemoveFromCart}
                      className="flex-1 py-4 rounded-xl font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100/50">
                      <FiTrash2 className="text-xl" />
                      <span>Remove from Cart</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleAddToCart}
                      disabled={product.stock === "out_of_stock"}
                      className={`flex-1 py-4 rounded-xl font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 ${product.stock === "out_of_stock"
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                        : "bg-white text-primary-600 border-2 border-primary-600 hover:bg-primary-50 hover:shadow-glow-primary-light"
                        }`}>
                      <FiShoppingBag className="text-xl" />
                      <span>
                        {product.stock === "out_of_stock"
                          ? "Out of Stock"
                          : "Add to Cart"}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!isInCart) {
                        const success = handleAddToCart();
                        if (!success) return;
                      }
                      navigate("/checkout");
                    }}
                    disabled={product.stock === "out_of_stock"}
                    className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${product.stock === "out_of_stock"
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                      : "gradient-green text-white hover:shadow-glow-green"
                      }`}>
                    <span>Buy Now</span>
                  </button>
                </div>

                {/* Description */}
                <div className="pt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Product Description
                  </h3>
                  <div className="prose prose-sm lg:prose-base text-gray-600 leading-relaxed bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    {product.description ? (
                      <p>{product.description}</p>
                    ) : (
                      <p>
                        High-quality {product.name.toLowerCase()} available in{" "}
                        {product.unit.toLowerCase()}. This product is carefully selected
                        to ensure the best quality and freshness.
                      </p>
                    )}
                  </div>
                </div>

                {/* FAQs */}
                {productFaqs.length > 0 && (
                  <div className="pt-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      Product FAQs
                    </h3>
                    <div className="space-y-3">
                      {productFaqs.map((faq, index) => (
                        <div
                          key={`${faq.question}-${index}`}
                          className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm"
                        >
                          <p className="text-sm font-bold text-gray-800 mb-2">
                            {faq.question}
                          </p>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {faq.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ratings & Reviews Section */}
                <div className="pt-8 border-t border-gray-200 mt-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Ratings & Reviews</h3>
                  
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50 p-6 rounded-3xl border border-gray-100 mb-8">
                    {/* Left: Avg Stars */}
                    <div className="flex flex-col items-center justify-center text-center">
                      <p className="text-5xl font-extrabold text-gray-900">{reviewStats.avg}</p>
                      <div className="flex gap-1 my-3 text-yellow-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <FiStar 
                            key={star} 
                            className={`text-2xl ${star <= Math.round(reviewStats.avg) ? "fill-yellow-400" : "text-gray-300"}`} 
                          />
                        ))}
                      </div>
                      <p className="text-sm font-semibold text-gray-500">{reviewStats.total} reviews</p>
                    </div>

                    {/* Right: Distribution bars */}
                    <div className="space-y-2.5">
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const count = reviewStats.distribution[rating] || 0;
                        const pct = reviewStats.total > 0 ? (count / reviewStats.total) * 100 : 0;
                        return (
                          <div key={rating} className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-600 w-12">{rating} Star</span>
                            <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-yellow-400 rounded-full" 
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-500 font-semibold w-8 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Filter & Write Review Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-700">Sort By</span>
                      <select 
                        value={reviewSort}
                        onChange={(e) => setReviewSort(e.target.value)}
                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-semibold"
                      >
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="highest-rating">Highest Rating</option>
                        <option value="lowest-rating">Lowest Rating</option>
                        <option value="most-helpful">Most Helpful</option>
                      </select>
                    </div>
                  </div>

                  {/* Write Review Form */}
                  {isAuthenticated && isMongoId(product?.id) && (
                    <div className="mb-8">
                      {isBlocked ? (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 font-semibold text-center shadow-xs">
                          Your account has been temporarily blocked. Please contact support.
                        </div>
                      ) : eligibleDeliveredOrderId ? (
                        <ReviewForm
                          productId={product.id}
                          onSubmit={handleSubmitReview}
                        />
                      ) : (
                        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm text-gray-600">
                          Reviews are available after product delivery.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reviews List */}
                  {productReviews.length > 0 ? (
                    <div className="space-y-6">
                      {productReviews.map((review) => {
                        const isOwnReview = isAuthenticated && user && (String(review.userId) === String(user.id) || String(review.userId?._id) === String(user.id) || review.customerEmail === user.email);
                        const isEditing = editingReviewId === (review.id || review._id);

                        return (
                          <div key={review.id} className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center font-bold text-white shadow-sm">
                                  {review.user ? review.user.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div>
                                  <span className="text-sm font-bold text-gray-900 block">
                                    {review.user || 'Customer'}
                                  </span>
                                  <span className="text-xs text-gray-400 font-medium">
                                    {new Date(review.date || review.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-0.5 text-yellow-400">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <FiStar 
                                      key={star} 
                                      className={`text-sm ${star <= review.rating ? "fill-yellow-400" : "text-gray-200"}`} 
                                    />
                                  ))}
                                </div>

                                {/* Edit/Delete for Own Review */}
                                {isOwnReview && !isEditing && (
                                  <div className="flex gap-2 ml-4">
                                    <button 
                                      onClick={() => handleEditClick(review)}
                                      className="text-blue-500 hover:text-blue-700 text-xs font-bold border border-blue-200 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteReview(review.id || review._id)}
                                      className="text-red-500 hover:text-red-750 text-xs font-bold border border-red-200 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {isEditing ? (
                              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-gray-700">Your Rating:</span>
                                  <div className="flex gap-1 text-yellow-400">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button 
                                        key={star}
                                        onClick={() => setEditRating(star)}
                                        className="focus:outline-none"
                                      >
                                        <FiStar className={`text-xl ${star <= editRating ? "fill-yellow-400" : "text-gray-300"}`} />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <textarea 
                                  value={editComment}
                                  onChange={(e) => setEditComment(e.target.value)}
                                  className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                                  rows={3}
                                  placeholder="Edit your review description..."
                                />
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => setEditingReviewId(null)}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={() => handleSaveEdit(review.id || review._id)}
                                    className="gradient-green text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                  >
                                    Save Changes
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600 leading-relaxed pl-1 pb-1">{review.comment}</p>
                            )}

                            {review.vendorResponse && (
                              <div className="mt-4 bg-primary-50 border border-primary-100 rounded-xl p-4 shadow-2xs">
                                <p className="text-xs font-bold text-primary-700 mb-1">
                                  Vendor Response
                                </p>
                                <p className="text-sm text-primary-800 leading-relaxed">{review.vendorResponse}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 font-medium">
                      No customer reviews yet. Be the first to purchase and review this product!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Similar Products */}
          {similarProducts.length > 0 && (
            <div className="px-4 py-8 lg:px-8 mt-8 lg:mt-16 border-t border-gray-200">
              <h3 className="text-xl lg:text-2xl font-bold text-gray-900 mb-6">
                You May Also Like
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {similarProducts.map((similarProduct) => (
                  <ProductCard
                    key={similarProduct.id}
                    product={similarProduct}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Bottom Action Bar (Mobile Only - Fixed relative to body via Portal) */}
        {createPortal(
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-[9998] safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-3">
              <button
                onClick={handleFavorite}
                className={`p-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center ${isFavorite
                  ? "bg-red-50 text-red-600 border-2 border-red-200"
                  : "bg-gray-100 text-gray-700"
                  }`}>
                <FiHeart
                  className={`text-xl ${isFavorite ? "fill-red-600" : ""}`}
                />
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: product.name,
                      text: `Check out ${product.name}`,
                      url: window.location.href,
                    });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied to clipboard");
                  }
                }}
                className="p-3 bg-gray-100 text-gray-700 rounded-xl font-semibold transition-all duration-300">
                <FiShare2 className="text-xl" />
              </button>
              {isInCart ? (
                <button
                  onClick={handleRemoveFromCart}
                  className="flex-1 py-4 rounded-xl font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-100">
                  <FiTrash2 className="text-xl" />
                  <span>Remove</span>
                </button>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={product.stock === "out_of_stock"}
                  className={`flex-1 py-4 rounded-xl font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 ${product.stock === "out_of_stock"
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "gradient-green text-white hover:shadow-glow-green"
                    }`}>
                  <FiShoppingBag className="text-xl" />
                  <span>
                    {product.stock === "out_of_stock"
                      ? "Out of Stock"
                      : "Add to Cart"}
                  </span>
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
      </MobileLayout>
    </PageTransition>
  );
};

export default MobileProductDetail;
