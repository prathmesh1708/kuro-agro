import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { matchPath, useNavigate } from "react-router-dom";
import { FiArrowRight, FiTag } from "react-icons/fi";

// Hero images for the parallax effect

// Brand gradients (green and gold) for promotional banners configured in Admin > Banners.
const gradientPalette = [
  "from-primary-700 via-primary-600 to-gold-500",
  "from-gold-600 via-gold-500 to-primary-600",
  "from-primary-900 via-primary-700 to-primary-500",
];

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

const AnimatedBanner = ({ banners = null }) => {
  const navigate = useNavigate();
  const [currentBanner, setCurrentBanner] = useState(0);

  const resolvedBanners =
    Array.isArray(banners) && banners.length > 0
      ? banners.map((banner, index) => ({
          id: banner.id || `banner-${index}`,
          title: banner.title || "Special Offer",
          subtitle: banner.subtitle || "Limited Time",
          discount: banner.discount || "Shop Now",
          description: banner.description || "",
          gradient:
            banner.gradient || gradientPalette[index % gradientPalette.length],
          link: resolveBannerLink(banner),
          icon: banner.icon || FiTag,
          heroImage: banner.image || banner.heroImage || "",
        }))
      : [];

  const handleBannerClick = (target) => {
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

  useEffect(() => {
    if (resolvedBanners.length < 2) return undefined;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % resolvedBanners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [resolvedBanners.length]);

  if (resolvedBanners.length === 0) return null;

  return (
    <div className="px-4 py-3">
      <div className="relative w-full h-32 rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-primary-800 to-primary-600">
        <AnimatePresence mode="wait">
          {resolvedBanners.map((banner, index) => {
            if (index !== currentBanner) return null;
            const Icon = banner.icon;

            return (
              <motion.div
                key={banner.id}
                initial={{ opacity: 0, scale: 1.1, x: "100%" }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: "-100%" }}
                transition={{
                  duration: 0.5,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
                style={{ willChange: "transform, opacity" }}
                className={`absolute inset-0 bg-gradient-to-br ${banner.gradient} p-3`}>
                {/* 3D Depth Parallax Background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                  {/* Layer 2: Midground (Bokeh Particles) */}
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{
                        opacity: 0,
                        x: Math.random() * 200,
                        y: Math.random() * 100
                      }}
                      animate={{
                        opacity: [0, 0.4, 0],
                        x: [null, Math.random() * -100],
                        y: [null, Math.random() * -50],
                      }}
                      transition={{
                        duration: 3 + Math.random() * 4,
                        repeat: Infinity,
                        delay: i * 0.5
                      }}
                      className="absolute w-1 h-1 bg-white rounded-full blur-[1px]"
                      style={{
                        right: `${10 + (i * 15)}%`,
                        top: `${20 + (i * 10)}%`,
                      }}
                    />
                  ))}

                  {/* Foreground: product photo */}
                  {banner.heroImage && (
                    <div className="absolute right-3 md:right-[5%] top-1/2 -translate-y-1/2">
                      <motion.img
                        src={banner.heroImage}
                        alt=""
                        className="w-24 h-24 md:w-28 md:h-28 rounded-2xl object-cover ring-2 ring-gold-300 shadow-xl"
                        initial={{ opacity: 0, x: 60, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1, y: [0, -4, 0] }}
                        transition={{
                          opacity: { duration: 0.4, delay: 0.2 },
                          x: { type: "spring", stiffness: 80, damping: 12, delay: 0.2 },
                          scale: { type: "spring", stiffness: 80, damping: 12, delay: 0.2 },
                          y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Content */}
                <button
                  type="button"
                  onClick={() => handleBannerClick(banner.link)}
                  disabled={!banner.link}
                  className="relative z-10 h-full w-full flex pt-2 pr-28 md:pr-40 justify-between text-left group">
                  <div className="flex-1">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center gap-2 mb-0">
                      <motion.div
                        animate={{
                          scale: [1, 1.2, 1],
                          rotate: [0, 10, -10, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}>
                        <Icon className="text-white text-lg drop-shadow-lg" />
                      </motion.div>
                      <motion.span
                        className="text-white/90 text-xs font-medium"
                        animate={{
                          opacity: [0.9, 1, 0.9],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}>
                        {banner.subtitle}
                      </motion.span>
                    </motion.div>

                    <motion.h3
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-white text-xl font-extrabold mb-0 drop-shadow-lg relative inline-block">
                      {banner.title}
                    </motion.h3>

                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-white/90 text-xs mb-1">
                      {banner.description}
                    </motion.p>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5, type: "spring" }}
                      style={{
                        willChange: "transform",
                        transform: "translateZ(0)",
                      }}
                      className="inline-flex items-center gap-2 bg-white/25 px-3 py-1.5 rounded-full relative overflow-hidden"
                      whileTap={{ scale: 0.95 }}>
                      <span className="text-white font-bold text-sm relative z-10">
                        {banner.discount}
                      </span>
                      <FiArrowRight className="text-white text-sm relative z-10" />
                    </motion.div>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Indicator Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
          {resolvedBanners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBanner(index)}
              className="focus:outline-none">
              <motion.div
                animate={{
                  width: index === currentBanner ? 24 : 6,
                  opacity: index === currentBanner ? 1 : 0.5,
                }}
                transition={{ duration: 0.3 }}
                className={`h-1.5 rounded-full bg-white ${index === currentBanner ? "w-6" : "w-1.5"
                  }`}
              />
            </button>
          ))}
        </div>
      </div>
    </div >
  );
};

export default AnimatedBanner;
