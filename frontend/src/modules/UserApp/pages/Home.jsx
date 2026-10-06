import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, matchPath, useNavigate } from "react-router-dom";
import { FiHeart } from "react-icons/fi";
import MobileLayout from "../components/Layout/MobileLayout";
import ProductCard from "../../../shared/components/ProductCard";
import AnimatedBanner from "../components/Mobile/AnimatedBanner";
import NewArrivalsSection from "../components/Mobile/NewArrivalsSection";
import DailyDealsSection from "../components/Mobile/DailyDealsSection";
import RecommendedSection from "../components/Mobile/RecommendedSection";
import FeaturedVendorsSection from "../components/Mobile/FeaturedVendorsSection";
import BrandLogosScroll from "../components/Mobile/BrandLogosScroll";
import MobileCategoryGrid from "../components/Mobile/MobileCategoryGrid";
import LazyImage from "../../../shared/components/LazyImage";
import { getPlaceholderImage, productGridItemClass } from "../../../shared/utils/helpers";
import {
  getFlashSale,
  getDailyDeals,
  getAllNewArrivals,
  getCatalogProducts,
  getApprovedVendors,
  getCatalogBrands,
} from "../data/catalogData";
import PageTransition from "../../../shared/components/PageTransition";
import usePullToRefresh from "../hooks/usePullToRefresh";
import toast from "react-hot-toast";
import api from "../../../shared/utils/api";

const normalizeId = (value) => String(value ?? "").trim();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeProduct = (raw) => {
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

  const id = normalizeId(raw?.id || raw?._id);
  const vendorId = normalizeId(vendorObj?._id || vendorObj?.id || raw?.vendorId);
  const brandId = normalizeId(brandObj?._id || brandObj?.id || raw?.brandId);
  const categoryId = normalizeId(
    categoryObj?._id || categoryObj?.id || raw?.categoryId
  );
  const image = raw?.image || raw?.images?.[0] || "";

  return {
    ...raw,
    id,
    _id: id,
    vendorId,
    vendorName: raw?.vendorName || vendorObj?.storeName || vendorObj?.name || "",
    brandId,
    brandName: raw?.brandName || brandObj?.name || "",
    categoryId,
    categoryName: raw?.categoryName || categoryObj?.name || "",
    image,
    images: Array.isArray(raw?.images) ? raw.images : image ? [image] : [],
    price: toNumber(raw?.price, 0),
    originalPrice:
      raw?.originalPrice !== undefined ? toNumber(raw.originalPrice, undefined) : undefined,
    rating: toNumber(raw?.rating, 0),
    reviewCount: toNumber(raw?.reviewCount, 0),
    isActive: raw?.isActive !== false,
    flashSale: !!raw?.flashSale,
    isNew: !!raw?.isNewArrival,
  };
};

const normalizeVendor = (raw) => ({
  ...raw,
  id: normalizeId(raw?.id || raw?._id),
  _id: normalizeId(raw?.id || raw?._id),
  isVerified: !!raw?.isVerified,
  rating: toNumber(raw?.rating, 0),
  reviewCount: toNumber(raw?.reviewCount, 0),
  status: raw?.status || "approved",
});

const normalizeBrand = (raw) => ({
  ...raw,
  id: normalizeId(raw?.id || raw?._id),
  _id: normalizeId(raw?.id || raw?._id),
  name: raw?.name || "",
  logo: raw?.logo || "",
});

const discountRatio = (p) => {
  const original = toNumber(p.originalPrice, 0);
  const price = toNumber(p.price, 0);
  return original > price ? (original - price) / original : 0;
};

// Biggest discounts that are not already shown in the Flash Sale row.
const deriveDailyDeals = (products = []) =>
  products
    .filter((p) => !p.flashSale && discountRatio(p) > 0)
    .sort((a, b) => discountRatio(b) - discountRatio(a));

// Shown until banners load from the API (or when none are configured in Admin > Banners).
// Banner images live on Cloudinary, so the defaults are text on a brand gradient.
const DEFAULT_HERO_SLIDES = [
  {
    image: "",
    title: "Quality Seeds for Every Season",
    subtitle: "Certified, high-germination seeds for rabi and kharif",
    link: "/categories",
  },
  {
    image: "",
    title: "Khad at the Right Price",
    subtitle: "Fertilizers, organic manure and crop care",
    link: "/categories",
  },
  {
    image: "",
    title: "Tools Built for Indian Farms",
    subtitle: "Sprayers, irrigation and hand tools",
    link: "/categories",
  },
];

const DEFAULT_SIDE_BANNER = {
  image: "",
  title: "100% ORGANIC",
  subtitle: "Vermicompost, neem cake and more",
  link: "/categories",
};

const extractResponseData = (response) => {
  if (response && typeof response === "object") {
    if (Object.prototype.hasOwnProperty.call(response, "data")) {
      return response.data;
    }
    return response;
  }
  return null;
};

const asList = (value) => (Array.isArray(value) ? value : []);
const KNOWN_USER_ROUTE_PATTERNS = [
  "/",
  "/home",
  "/search",
  "/offers",
  "/daily-deals",
  "/flash-sale",
  "/new-arrivals",
  "/categories",
  "/category/:id",
  "/brand/:id",
  "/seller/:id",
  "/product/:id",
  "/sale/:slug",
  "/track-order/:orderId",
];

const getPathnameFromTarget = (target) =>
  String(target || "").trim().split("?")[0].split("#")[0];

const isKnownInternalRoute = (target) => {
  const pathname = getPathnameFromTarget(target);
  if (!pathname) return false;
  return KNOWN_USER_ROUTE_PATTERNS.some((pattern) =>
    !!matchPath({ path: pattern, end: true }, pathname)
  );
};

const resolveBannerLink = (banner) => {
  const candidate = String(
    banner?.linkUrl || banner?.link || banner?.url || ""
  ).trim();
  if (!candidate) return "";
  if (isExternalLink(candidate)) return candidate;
  if (isSafeInternalPath(candidate) && isKnownInternalRoute(candidate))
    return candidate;
  return "";
};

const isExternalLink = (target) => /^https?:\/\//i.test(String(target || "").trim());
const isSafeInternalPath = (target) => String(target || "").startsWith("/");

const MobileHome = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [autoSlidePaused, setAutoSlidePaused] = useState(false);
  const [isDraggingSlide, setIsDraggingSlide] = useState(false);
  const [slides, setSlides] = useState(DEFAULT_HERO_SLIDES);
  const [promoBanners, setPromoBanners] = useState([]);
  const [sideBanner, setSideBanner] = useState(null);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [homeVendors, setHomeVendors] = useState([]);
  const [homeBrands, setHomeBrands] = useState([]);

  const fallbackFlashSale = getFlashSale();
  const fallbackNewArrivals = getAllNewArrivals().slice(0, 6);
  const fallbackDailyDeals = getDailyDeals().slice(0, 6);
  const fallbackVendors = getApprovedVendors();
  const fallbackBrands = getCatalogBrands().slice(0, 10);

  const computedNewArrivals = useMemo(() => {
    if (catalogProducts.length === 0) return fallbackNewArrivals;
    return catalogProducts.filter((p) => p.isNew).slice(0, 6);
  }, [catalogProducts, fallbackNewArrivals]);

  const computedDailyDeals = useMemo(() => {
    if (catalogProducts.length === 0) return fallbackDailyDeals;
    return deriveDailyDeals(catalogProducts).slice(0, 6);
  }, [catalogProducts, fallbackDailyDeals]);

  // Most Popular, Trending and Recommended never repeat a product. Ranking uses reviews and
  // ratings; until those exist, featured and newer products break the ties.
  const homeRows = useMemo(() => {
    const source = catalogProducts.length > 0 ? catalogProducts : getCatalogProducts();
    const createdAt = (p) => new Date(p.createdAt || 0).getTime() || 0;
    const reviews = (a, b) => toNumber(b.reviewCount, 0) - toNumber(a.reviewCount, 0);
    const rating = (a, b) => toNumber(b.rating, 0) - toNumber(a.rating, 0);
    const featured = (a, b) => Number(!!b.isFeatured) - Number(!!a.isFeatured);
    const newest = (a, b) => createdAt(b) - createdAt(a);
    const by = (...comparators) => (a, b) => {
      for (const compare of comparators) {
        const diff = compare(a, b);
        if (diff !== 0) return diff;
      }
      return 0;
    };

    const used = new Set();
    const take = (compare) => {
      const picked = source
        .filter((p) => !used.has(normalizeId(p.id)))
        .sort(compare)
        .slice(0, 6);
      picked.forEach((p) => used.add(normalizeId(p.id)));
      return picked;
    };

    const mostPopular = take(by(reviews, rating, featured, newest));
    const trending = take(by(rating, reviews, newest));
    const recommended = take(by(rating, featured, reviews));
    return { mostPopular, trending, recommended };
  }, [catalogProducts]);

  const computedMostPopular = homeRows.mostPopular;
  const computedTrending = homeRows.trending;
  const computedRecommended = homeRows.recommended;

  const computedFlashSale = useMemo(() => {
    if (catalogProducts.length === 0) return fallbackFlashSale.slice(0, 6);
    return catalogProducts.filter((product) => product.flashSale).slice(0, 6);
  }, [catalogProducts, fallbackFlashSale]);

  const computedVendors = useMemo(() => {
    if (homeVendors.length === 0) return fallbackVendors;
    return [...homeVendors]
      .filter((vendor) => vendor.status === "approved")
      .sort((a, b) => toNumber(b.rating, 0) - toNumber(a.rating, 0))
      .slice(0, 10);
  }, [homeVendors, fallbackVendors]);

  const computedBrands = useMemo(() => {
    if (homeBrands.length === 0) return fallbackBrands;
    return homeBrands.slice(0, 10);
  }, [homeBrands, fallbackBrands]);

  const fetchHomeData = useCallback(async () => {
    try {
      const [productsRes, vendorsRes, brandsRes, bannersRes] =
        await Promise.allSettled([
          api.get("/products", { params: { page: 1, limit: 120 } }),
          api.get("/vendors/all", {
            params: { status: "approved", page: 1, limit: 50 },
          }),
          api.get("/brands/all"),
          api.get("/banners"),
        ]);

      if (productsRes.status === "fulfilled") {
        const payload = extractResponseData(productsRes.value);
        const productsSource = asList(payload?.products);
        const normalizedProducts = productsSource
          .map(normalizeProduct)
          .filter((product) => product.id && product.isActive !== false);
        setCatalogProducts(normalizedProducts);
      }

      if (vendorsRes.status === "fulfilled") {
        const payload = extractResponseData(vendorsRes.value);
        const vendorsSource = asList(payload?.vendors);
        setHomeVendors(
          vendorsSource
            .map(normalizeVendor)
            .filter((vendor) => vendor.id)
        );
      }

      if (brandsRes.status === "fulfilled") {
        const payload = extractResponseData(brandsRes.value);
        const brandsSource = asList(payload);
        setHomeBrands(
          brandsSource
            .map(normalizeBrand)
            .filter((brand) => brand.id)
        );
      }

      if (bannersRes.status === "fulfilled") {
        const payload = extractResponseData(bannersRes.value);
        const allBanners = asList(payload).filter(
          (banner) => banner?.image && banner?.isActive !== false
        );

        const bannerSlides = allBanners
          .filter((banner) =>
            ["home_slider", "hero", "festival_offer", "banner"].includes(String(banner?.type || ""))
          )
          .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0))
          .map((banner, index) => ({
            id: normalizeId(banner._id || banner.id || `home-slide-${index}`),
            image: banner.image,
            link: resolveBannerLink(banner),
            title: banner.title || "",
          }));
        setSlides(bannerSlides.length > 0 ? bannerSlides : DEFAULT_HERO_SLIDES);

        const banners = allBanners
          .filter((banner) =>
            ["promotional", "festival_offer", "banner"].includes(String(banner?.type || "")) ||
            !["home_slider", "hero", "side_banner"].includes(String(banner?.type || ""))
          )
          .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0))
          .map((banner, index) => ({
            id: normalizeId(banner._id || banner.id || `promo-banner-${index}`),
            title: banner.title || "Special Offer",
            subtitle: banner.subtitle || "Limited Time",
            description: banner.description || "",
            discount: banner.discount || banner.description || "Shop Now",
            link: resolveBannerLink(banner),
            image: banner.image,
            type: banner.type || "promotional",
          }));
        setPromoBanners(banners);

        const mapped = allBanners
          .filter((banner) => String(banner?.type || "") === "side_banner")
          .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0))
          .map((banner, index) => ({
            id: normalizeId(banner._id || banner.id || `side-banner-${index}`),
            image: banner.image,
            title: banner.title || "PREMIUM",
            subtitle: banner.subtitle || "Exclusive Collection",
            link: resolveBannerLink(banner),
          }));
        setSideBanner(mapped[0] || null);
      } else {
        setSlides(DEFAULT_HERO_SLIDES);
        setPromoBanners([]);
        setSideBanner(null);
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  // Auto-slide functionality (pauses when user is dragging)
  useEffect(() => {
    if (autoSlidePaused) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length, autoSlidePaused]);

  // Minimum swipe distance (in pixels) to trigger slide change
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    e.stopPropagation(); // Prevent pull-to-refresh from interfering
    setTouchEnd(null);
    setIsDraggingSlide(false);
    const touch = e.targetTouches[0];
    setTouchStart(touch.clientX);
    setDragOffset(0);
    setAutoSlidePaused(true);
  };

  const onTouchMove = (e) => {
    if (touchStart === null) return;
    e.stopPropagation(); // Prevent pull-to-refresh from interfering
    const touch = e.targetTouches[0];
    const currentX = touch.clientX;
    // Calculate difference: positive when swiping left, negative when swiping right
    const diff = touchStart - currentX;
    if (Math.abs(diff) > 8) {
      setIsDraggingSlide(true);
    }
    // Constrain the drag offset to prevent over-dragging
    // Use container width for better responsiveness
    const containerWidth = e.currentTarget?.offsetWidth || 400;
    const maxDrag = containerWidth * 0.5; // Maximum drag distance (50% of container)
    // dragOffset: positive = swiping left (show next), negative = swiping right (show previous)
    setDragOffset(Math.max(-maxDrag, Math.min(maxDrag, diff)));
    setTouchEnd(currentX);
  };

  const onTouchEnd = (e) => {
    if (e) e.stopPropagation(); // Prevent pull-to-refresh from interfering

    if (touchStart === null) {
      setAutoSlidePaused(false);
      return;
    }

    // Calculate swipe distance: positive = left swipe, negative = right swipe
    const distance = touchStart - (touchEnd || touchStart);
    const isLeftSwipe = distance > minSwipeDistance; // Finger moved left = show next slide
    const isRightSwipe = distance < -minSwipeDistance; // Finger moved right = show previous slide

    if (isLeftSwipe) {
      // Swipe left (finger moved left) - go to next slide (slide moves left)
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    } else if (isRightSwipe) {
      // Swipe right (finger moved right) - go to previous slide (slide moves right)
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    }

    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
    setDragOffset(0);

    // Resume auto-slide after a short delay
    setTimeout(() => {
      setAutoSlidePaused(false);
    }, 2000);
    setTimeout(() => {
      setIsDraggingSlide(false);
    }, 150);
  };

  const handleSlideClick = (slide) => {
    if (isDraggingSlide) return;
    const target = String(slide?.link || "").trim();
    if (!target) return;

    if (isExternalLink(target)) {
      window.open(target, "_blank", "noopener,noreferrer");
      return;
    }
    if (isSafeInternalPath(target)) {
      navigate(target);
    }
  };

  const handleBannerNavigation = (target) => {
    const normalizedTarget = String(target || "").trim();
    if (!normalizedTarget) return;
    if (isExternalLink(normalizedTarget)) {
      window.open(normalizedTarget, "_blank", "noopener,noreferrer");
      return;
    }
    if (isSafeInternalPath(normalizedTarget) && isKnownInternalRoute(normalizedTarget)) {
      navigate(normalizedTarget);
    }
  };

  // Pull to refresh handler
  const handleRefresh = async () => {
    const ok = await fetchHomeData();
    if (!ok) {
      toast.error("Refresh failed. Showing available data.");
      return;
    }
    toast.success("Refreshed");
  };

  const {
    pullDistance,
    isPulling,
    elementRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = usePullToRefresh(handleRefresh);

  return (
    <PageTransition>
      <MobileLayout>
        <div
          ref={elementRef}
          className="w-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translateY(${Math.min(pullDistance, 80)}px)`,
            transition: isPulling ? "none" : "transform 0.3s ease-out",
          }}>
          {/* Hero Banner */}
          <div className="px-4 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div
                className="relative w-full h-48 md:h-80 lg:h-[400px] xl:h-[450px] rounded-xl md:rounded-2xl overflow-hidden lg:col-span-2"
                data-carousel
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ touchAction: "pan-y", userSelect: "none" }}>
                {/* Slider Container - All slides in a row */}
                <motion.div
                  className="flex h-full"
                  style={{
                    width: `${slides.length * 100}%`,
                    height: "100%",
                  }}
                  animate={{
                    x:
                      dragOffset !== 0
                        ? `calc(-${currentSlide * (100 / slides.length)
                        }% - ${dragOffset}px)`
                        : `-${currentSlide * (100 / slides.length)}%`,
                  }}
                  transition={{
                    duration: dragOffset !== 0 ? 0 : 0.6,
                    ease: [0.25, 0.46, 0.45, 0.94], // Smooth easing
                    type: "tween",
                  }}>
                  {slides.map((slide, index) => (
                    <div
                      key={index}
                      className="flex-shrink-0"
                      onClick={() => handleSlideClick(slide)}
                      style={{
                        width: `${100 / slides.length}%`,
                        height: "100%",
                        cursor: slide?.link ? "pointer" : "default",
                      }}>
                      <div className="relative w-full h-full">
                        {slide.image ? (
                          <LazyImage
                            src={slide.image}
                            alt={slide.title || `Slide ${index + 1}`}
                            className="w-full h-full object-cover pointer-events-none select-none"
                            draggable={false}
                            onError={(e) => {
                              e.target.src = getPlaceholderImage(400, 200, `Banner ${index + 1}`);
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900" />
                        )}
                        {slide.title && (
                          <div className="absolute inset-0 bg-gradient-to-r from-primary-900/85 via-primary-900/45 to-transparent flex items-center pointer-events-none">
                            <div className="px-5 md:px-10 max-w-[75%] md:max-w-[60%]">
                              <h2 className="text-white font-extrabold text-xl leading-tight md:text-4xl lg:text-5xl drop-shadow">
                                {slide.title}
                              </h2>
                              {slide.subtitle && (
                                <p className="mt-1.5 md:mt-3 text-gold-100 text-xs md:text-base lg:text-lg font-medium line-clamp-2">
                                  {slide.subtitle}
                                </p>
                              )}
                              {slide.link && (
                                <span className="inline-block mt-3 md:mt-6 px-4 py-1.5 md:px-7 md:py-3 rounded-full bg-gold-400 text-primary-900 text-xs md:text-sm font-bold shadow-lg">
                                  Shop Now
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10 pointer-events-none">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentSlide(index);
                        setAutoSlidePaused(true);
                        setTimeout(() => setAutoSlidePaused(false), 2000);
                      }}
                      className={`h-1.5 rounded-full transition-all pointer-events-auto ${index === currentSlide
                        ? "bg-white w-6"
                        : "bg-white/50 w-1.5"
                        }`}
                    />
                  ))}
                </div>
              </div>

              {/* Side Banner for Large Screens */}
              <div className="hidden lg:block lg:col-span-1 h-[400px] xl:h-[450px] rounded-2xl overflow-hidden relative bg-primary-900 group ring-2 ring-gold-300/60">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-900/30 to-primary-900/95 z-10" />
                {(sideBanner || DEFAULT_SIDE_BANNER).image ? (
                  <LazyImage
                    src={(sideBanner || DEFAULT_SIDE_BANNER).image}
                    alt={(sideBanner || DEFAULT_SIDE_BANNER).title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    onError={(e) => {
                      e.target.src = getPlaceholderImage(400, 400, "KuroAgro");
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gold-500 via-primary-700 to-primary-900" />
                )}
                <div className="absolute inset-x-0 bottom-0 p-8 z-20 flex flex-col items-center text-center">
                  <span className="text-gold-300 font-bold text-3xl mb-2 tracking-wider drop-shadow-lg">
                    {(sideBanner || DEFAULT_SIDE_BANNER).title}
                  </span>
                  <p className="text-white/85 text-sm mb-6 font-medium">
                    {(sideBanner || DEFAULT_SIDE_BANNER).subtitle}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleBannerNavigation((sideBanner || DEFAULT_SIDE_BANNER).link || "/offers")}
                    className="bg-gold-400 text-primary-900 font-bold py-3.5 px-10 rounded-xl w-full hover:bg-gold-300 transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-xl uppercase tracking-widest text-sm"
                  >
                    Shop Now
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Brand Logos Scroll */}
          <BrandLogosScroll brands={computedBrands} />

          {/* Categories */}
          <MobileCategoryGrid />

          {/* Featured Vendors Section */}
          <FeaturedVendorsSection vendors={computedVendors} />

          {/* Animated Banner */}
          <AnimatedBanner banners={promoBanners} />

          {/* New Arrivals */}
          <NewArrivalsSection products={computedNewArrivals} />



          {/* Most Popular */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Most Popular</h2>
              <Link
                to="/search"
                className="text-sm text-primary-600 font-semibold">
                See All
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {computedMostPopular.map((product, index) => (
                <motion.div
                  key={product.id}
                  className={productGridItemClass(index)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}>
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Daily Deals */}
          <DailyDealsSection products={computedDailyDeals} />



          {/* Flash Sale */}
          {computedFlashSale.length > 0 && (
            <div className="px-4 py-4 bg-gradient-to-br from-gold-50 to-primary-50 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Flash Sale
                  </h2>
                  <p className="text-xs text-gray-600">Limited time offers</p>
                </div>
                <Link
                  to="/flash-sale"
                  className="text-sm text-primary-600 font-semibold">
                  See All
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {computedFlashSale.map((product, index) => (
                  <motion.div
                    key={product.id}
                    className={productGridItemClass(index)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}>
                    <ProductCard product={product} isFlashSale={true} />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Trending Items */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Trending Now</h2>
              <Link
                to="/search"
                className="text-sm text-primary-600 font-semibold">
                See All
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {computedTrending.map((product, index) => (
                <motion.div
                  key={product.id}
                  className={productGridItemClass(index)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}>
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recommended for You */}
          <RecommendedSection products={computedRecommended} />

          {/* Tagline Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="px-4 py-12 text-left">
            <motion.h2
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-primary-900/15 leading-tight flex items-center justify-start gap-3 flex-wrap"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}>
              <span>Grown with Care, Delivered to Your Farm</span>
              <motion.span
                animate={{
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: 2,
                }}
                className="text-gold-400 inline-block">
                <FiHeart className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl fill-gold-400" />
              </motion.span>
            </motion.h2>
          </motion.div>

          {/* Bottom Spacing */}
          <div className="h-4" />
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default MobileHome;
