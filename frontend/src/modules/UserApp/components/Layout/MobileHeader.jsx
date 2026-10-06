import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FiShoppingBag,
  FiMoon,
  FiUser,
  FiSearch,
} from "react-icons/fi";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCartStore, useUIStore } from "../../../../shared/store/useStore";
import { useAuthStore } from "../../../../shared/store/authStore";
import { useLocationStore } from "../../../../shared/store/locationStore";
import raathiLogo from "../../../../assets/raathifinalogo.png";
const appLogo = {
  src: raathiLogo,
  alt: "Rathi"
};
import { motion } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

// Category gradient mapping - Very subtle pastel colors
const categoryGradients = {
  1: "from-pink-50 via-rose-50 to-pink-100", // Clothing - Pinkish
  2: "from-amber-50 via-amber-100 to-yellow-50", // Footwear - Brownish
  3: "from-orange-50 via-orange-100 to-orange-50", // Bags - Orangeish
  4: "from-green-50 via-emerald-50 to-teal-50", // Jewelry - Greenish
  5: "from-purple-50 via-purple-100 to-indigo-50", // Accessories - Purple
  6: "from-blue-50 via-cyan-50 to-teal-50", // Athletic
};

const MobileHeader = () => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCartAnimation, setShowCartAnimation] = useState(false);
  const [positionsReady, setPositionsReady] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [animationPositions, setAnimationPositions] = useState({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });
  const [isTopRowVisible, setIsTopRowVisible] = useState(true);
  const [topRowHeight, setTopRowHeight] = useState(70);
  const lastScrollYRef = useRef(0);
  const topRowRef = useRef(null);
  const userMenuRef = useRef(null);
  const logoRef = useRef(null);
  const cartRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const itemCount = useCartStore((state) => state.getItemCount());
  const toggleCart = useUIStore((state) => state.toggleCart);
  const cartAnimationTrigger = useUIStore(
    (state) => state.cartAnimationTrigger
  );
  const { user, isAuthenticated, logout } = useAuthStore();
  const { locationName, isLoading: isLocationLoading, fetchCurrentLocation } = useLocationStore();

  // Fetch location automatically on header mount
  useEffect(() => {
    fetchCurrentLocation();
  }, [fetchCurrentLocation]);

  // Measure top row height
  useEffect(() => {
    const measureTopRow = () => {
      if (topRowRef.current) {
        const height = topRowRef.current.offsetHeight;
        setTopRowHeight(height);
      }
    };

    measureTopRow();
    window.addEventListener("resize", measureTopRow);
    return () => window.removeEventListener("resize", measureTopRow);
  }, []);

  // Handle scroll to hide/show top row with smooth throttling
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const lastScrollY = lastScrollYRef.current;

          // Show top row when at top or scrolling up
          if (currentScrollY < 10) {
            setIsTopRowVisible(true);
          } else if (currentScrollY < lastScrollY) {
            // Scrolling up - show top row
            setIsTopRowVisible(true);
          } else if (currentScrollY > lastScrollY && currentScrollY > 50) {
            // Scrolling down and past threshold - hide top row
            setIsTopRowVisible(false);
          }

          lastScrollYRef.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Calculate animation positions after component mounts
  useEffect(() => {
    const calculatePositions = () => {
      if (logoRef.current && cartRef.current) {
        const logoRect = logoRef.current.getBoundingClientRect();
        const cartRect = cartRef.current.getBoundingClientRect();

        const positions = {
          startX: logoRect.left + logoRect.width / 2,
          startY: logoRect.top + logoRect.height / 2,
          endX: cartRect.left + cartRect.width / 2,
          endY: cartRect.top + cartRect.height / 2,
        };

        // Only set positions if they're valid and animation hasn't played yet
        if (
          positions.startX > 0 &&
          positions.endX > 0 &&
          positions.startY > 0 &&
          positions.endY > 0 &&
          !hasPlayed
        ) {
          setAnimationPositions(positions);
          setPositionsReady(true);
          // Start animation once positions are ready
          setShowCartAnimation(true);
          setHasPlayed(true);
        }
      }
    };

    // Calculate positions after delays to ensure elements are rendered
    const timer1 = setTimeout(calculatePositions, 100);
    const timer2 = setTimeout(calculatePositions, 500);
    const timer3 = setTimeout(calculatePositions, 1000);

    // Recalculate on resize
    window.addEventListener("resize", calculatePositions);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener("resize", calculatePositions);
    };
  }, [hasPlayed]);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate("/");
  };

  // Animation content - straight line movement only, starting from behind logo
  const shouldShowAnimation =
    showCartAnimation &&
    positionsReady &&
    animationPositions.startX > 0 &&
    animationPositions.endX > 0;

  const animationContent = shouldShowAnimation ? (
    <motion.div
      className="fixed pointer-events-none"
      style={{
        left: 0,
        top: 0,
        zIndex: 10000, // Above navbar but will be behind logo due to stacking context
        willChange: "transform, opacity",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
      initial={{
        x: animationPositions.startX - 24,
        y: animationPositions.startY - 24,
        scale: 0.8,
        opacity: 0,
      }}
      animate={{
        x: animationPositions.endX - 24,
        y: animationPositions.endY - 24,
        scale: [0.8, 1, 1.05, 0.95],
        opacity: [0, 1, 1, 0.8, 0],
      }}
      transition={{
        duration: 4,
        ease: [0.25, 0.1, 0.25, 1],
        times: [0, 0.1, 0.7, 0.9, 1],
        type: "tween",
      }}
      onAnimationComplete={() => {
        setShowCartAnimation(false);
      }}>
      <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
        <DotLottieReact
          src="https://lottie.host/083a2680-e854-4006-a50b-674276be82cd/oQMRcuZUkS.lottie"
          autoplay
          loop={false}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </motion.div>
  ) : null;

  const headerContent = (
    <motion.header
      key="mobile-header" // Stable key to prevent re-mounting
      className="fixed top-0 left-0 right-0 z-[9999] shadow-md overflow-visible md:hidden bg-[#E8E2FA] border-b border-purple-200"
      initial={false}
      animate={{
        y: isTopRowVisible ? 0 : -(topRowHeight + 12),
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      }}>
      <div className="px-4 pt-3.5 pb-3 overflow-visible flex flex-col gap-2.5">
        {/* First Row: Location & Actions */}
        <motion.div
          ref={topRowRef}
          className="flex items-center justify-between gap-3"
          initial={false}
          animate={{
            opacity: isTopRowVisible ? 1 : 0,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 35,
            mass: 0.6,
          }}
          style={{
            pointerEvents: isTopRowVisible ? "auto" : "none",
          }}>
          {/* Logo and Location details */}
          <div className="flex items-center gap-2.5 text-left">
            <Link to="/home" className="flex-shrink-0 flex items-center">
              <img
                src={appLogo.src}
                alt={appLogo.alt}
                className="h-10 w-auto object-contain"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </Link>
            <div
              className="flex flex-col justify-center cursor-pointer select-none max-w-[170px]"
              onClick={() => {
                if (isAuthenticated) {
                  navigate("/addresses");
                } else {
                  navigate("/login", { state: { from: "/addresses" } });
                }
              }}
              title="Click to select or manage address"
            >
              <div className="flex items-center gap-0.5 leading-none">
                <span className="text-orange-500 font-bold text-sm">⚡</span>
                <span className="text-gray-950 font-black text-xs tracking-wider uppercase">10 MINUTES</span>
              </div>
              <div className="flex items-center gap-0.5 text-gray-550 text-[9px] font-bold mt-1 ml-0.5 max-w-full">
                <span className="truncate max-w-[150px]">
                  {isLocationLoading ? 'Fetching location...' : locationName}
                </span>
                <span className="text-[7px] text-gray-400 flex-shrink-0">▼</span>
              </div>
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1">
            {/* Profile Button */}
            <Link to="/profile" className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200 flex items-center">
              <FiUser className="text-lg text-gray-800" />
            </Link>
            {/* Cart Button */}
            <motion.button
              ref={cartRef}
              data-cart-icon
              onClick={toggleCart}
              className="relative p-2 hover:bg-white/20 rounded-full transition-all duration-300 flex items-center"
              animate={
                cartAnimationTrigger > 0
                  ? {
                    scale: [1, 1.2, 1],
                  }
                  : {}
              }
              transition={{ duration: 0.5, ease: "easeOut" }}>
              <FiShoppingBag className="text-lg text-gray-800" />
              {itemCount > 0 && (
                <motion.span
                  key={itemCount}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ backgroundColor: "#ffc101" }}>
                  {itemCount > 9 ? "9+" : itemCount}
                </motion.span>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Second Row: Tab Navigation */}
        <div className="flex items-center gap-3">
          <Link to="/home" className="flex-1 py-2 px-3 rounded-full bg-[#E5DDFB] border border-purple-300 text-center font-black text-[#5B21B6] text-xs shadow-sm flex items-center justify-center">
            Rathi
          </Link>
          <Link to="/categories" className="flex-1 py-2 px-3 rounded-full bg-white border border-gray-200 text-center font-bold text-gray-800 text-xs shadow-sm flex items-center justify-center">
            Categories
          </Link>
          <Link to="/offers" className="flex-1 py-2 px-3 rounded-full bg-white border border-gray-200 text-center font-black text-emerald-700 text-xs shadow-sm flex items-center justify-center">
            OFFER
          </Link>
        </div>

        {/* Third Row: Search and Celebrate Badge */}
        <div className="flex items-center gap-2.5">
          {/* Search Box */}
          <div 
            onClick={() => navigate("/search")} 
            className="flex-1 flex items-center gap-2 px-3.5 py-2.5 bg-white rounded-full border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <FiSearch className="text-gray-400 text-base" />
            <span className="text-gray-400 text-xs truncate">Search for "Earphones"</span>
          </div>

          {/* Celebrate Offers Badge */}
          <Link 
            to="/offers" 
            className="flex items-center gap-1.5 px-3 py-1 bg-[#FFFBEB] border border-amber-300 rounded-xl shadow-sm hover:bg-[#FEF3C7] transition-colors shrink-0"
          >
            <div className="flex flex-col text-left leading-none">
              <span className="text-[7px] font-extrabold text-[#B45309] uppercase tracking-wider">CELEBRATE</span>
              <span className="text-[10px] font-bold text-gray-850">Offers</span>
            </div>
            <span className="text-sm">🎁</span>
          </Link>
        </div>
      </div>
    </motion.header>
  );

  // Use portal to render outside of transformed containers (like PageTransition)
  return (
    <>
      {typeof document !== "undefined" &&
        createPortal(headerContent, document.body)}
      {typeof document !== "undefined" &&
        createPortal(animationContent, document.body)}
    </>
  );
};

export default MobileHeader;
