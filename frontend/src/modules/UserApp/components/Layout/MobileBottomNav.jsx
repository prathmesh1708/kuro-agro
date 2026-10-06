import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, LayoutGrid, Search, Heart, User } from "lucide-react";
import { useWishlistStore } from "../../../../shared/store/wishlistStore";
import { useAuthStore } from "../../../../shared/store/authStore";

// Floating "LumaBar" style bottom nav (mobile only): glass pill, glowing active
// indicator, enlarged active icon and hover tooltips.
const MobileBottomNav = () => {
  const location = useLocation();
  const wishlistCount = useWishlistStore((state) => state.getItemCount());
  const { isAuthenticated } = useAuthStore();

  const navItems = [
    { path: "/home", icon: Home, label: "Home" },
    { path: "/categories", icon: LayoutGrid, label: "Categories" },
    { path: "/search", icon: Search, label: "Search" },
    {
      path: "/wishlist",
      icon: Heart,
      label: "Wishlist",
      badge: wishlistCount > 0 ? wishlistCount : null,
    },
    {
      path: isAuthenticated ? "/profile" : "/login",
      icon: User,
      label: "Account",
    },
  ];

  const isActive = (path) => {
    if (path === "/home") {
      return location.pathname === "/home";
    }
    return location.pathname.startsWith(path);
  };

  const activeIndex = navItems.findIndex((item) => isActive(item.path));

  const navContent = (
    <nav
      aria-label="Main navigation"
      className="fixed left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm md:hidden"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
      <div className="relative rounded-full bg-white/70 backdrop-blur-2xl border border-gray-200/60 shadow-xl">
        {/* Active indicator glow, clipped to the pill so it never bleeds onto the page */}
        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
          {activeIndex >= 0 && (
            <motion.div
              className="absolute top-1/2 w-16 h-16 rounded-full bg-gradient-to-r from-primary-400 to-gold-400 blur-2xl opacity-80"
              style={{ x: "-50%", y: "-50%" }}
              initial={false}
              animate={{ left: `${((activeIndex + 0.5) / navItems.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
        </div>

        <div className="relative flex items-center py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className="group relative flex flex-1 flex-col items-center outline-none">
                {/* Icon */}
                <motion.span
                  className={`flex items-center justify-center w-12 h-12 transition-colors ${
                    active ? "text-primary-700" : "text-gray-600 group-hover:text-primary-600"
                  }`}
                  initial={false}
                  animate={{ scale: active ? 1.4 : 1 }}
                  whileHover={{ scale: active ? 1.4 : 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                  <Icon size={24} strokeWidth={2} />
                </motion.span>

                {/* Badge */}
                {item.badge && (
                  <motion.span
                    key={item.badge}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute top-1 left-1/2 ml-1.5 w-5 h-5 rounded-full border-2 border-white bg-gold-400 shadow-md z-20 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  </motion.span>
                )}

                {/* Tooltip */}
                <span className="pointer-events-none absolute bottom-full mb-2 px-2 py-1 text-xs rounded-md bg-primary-800 text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );

  // Use portal to render outside of transformed containers (like PageTransition)
  return createPortal(navContent, document.body);
};

export default MobileBottomNav;
