import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Users, UserPlus, User, ShoppingBasket, Warehouse, Truck, Wheat, ClipboardList } from 'lucide-react';

// Same floating "LumaBar" pill as the customer app, with items per role.
const NAV_ITEMS = {
  surveyor: [
    { path: '/surveyor/dashboard', icon: Home, label: 'Home' },
    { path: '/surveyor/farmers', icon: Users, label: 'Farmers', exact: true },
    { path: '/surveyor/farmers/new', icon: UserPlus, label: 'Add Farmer' },
    { path: '/surveyor/profile', icon: User, label: 'Profile' },
  ],
  // Farmers and Surveyors are reached from the Home tiles.
  sanchalak: [
    { path: '/sanchalak/dashboard', icon: Home, label: 'Home' },
    { path: '/sanchalak/purchases', icon: ShoppingBasket, label: 'Purchases' },
    { path: '/sanchalak/warehouse', icon: Warehouse, label: 'Warehouse' },
    { path: '/sanchalak/sales', icon: Truck, label: 'To Admin' },
    { path: '/sanchalak/profile', icon: User, label: 'Profile' },
  ],
  kisan: [
    { path: '/kisan/dashboard', icon: Home, label: 'Home' },
    { path: '/kisan/sell', icon: Wheat, label: 'Sell' },
    { path: '/kisan/requests', icon: ClipboardList, label: 'My Offers' },
    { path: '/kisan/profile', icon: User, label: 'Profile' },
  ],
};

export const getNavItems = (role) => NAV_ITEMS[role] || [];

// Index of the item matching the current path; the most specific match wins.
const findActiveIndex = (items, pathname) => {
  let best = -1;
  items.forEach((item, index) => {
    const matches = item.exact ? pathname === item.path || /^\/[^/]+\/farmers\/[^/]+(\/edit)?$/.test(pathname) && !pathname.endsWith('/new') : pathname === item.path || pathname.startsWith(`${item.path}/`);
    if (matches && (best === -1 || item.path.length > items[best].path.length)) best = index;
  });
  return best;
};

const FieldBottomNav = ({ role }) => {
  const { pathname } = useLocation();
  const items = getNavItems(role);
  const activeIndex = findActiveIndex(items, pathname);

  const nav = (
    <nav
      aria-label="Main navigation"
      className="fixed left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm md:hidden"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="relative rounded-full bg-white/80 backdrop-blur-2xl border border-gray-200/60 shadow-xl">
        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
          {activeIndex >= 0 && (
            <motion.div
              className="absolute top-1/2 w-16 h-16 rounded-full bg-gradient-to-r from-primary-400 to-gold-400 blur-2xl opacity-80"
              style={{ x: '-50%', y: '-50%' }}
              initial={false}
              animate={{ left: `${((activeIndex + 0.5) / items.length) * 100}%` }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </div>

        <div className="relative flex items-center py-1.5">
          {items.map((item, index) => {
            const Icon = item.icon;
            const active = index === activeIndex;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-1 flex-col items-center outline-none"
              >
                <motion.span
                  className={`flex items-center justify-center w-12 h-10 transition-colors ${active ? 'text-primary-700' : 'text-gray-600'}`}
                  initial={false}
                  animate={{ scale: active ? 1.3 : 1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Icon size={22} strokeWidth={2} />
                </motion.span>
                <span className={`text-[10px] font-semibold -mt-1 pb-0.5 ${active ? 'text-primary-700' : 'text-gray-500'}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );

  return createPortal(nav, document.body);
};

export default FieldBottomNav;
