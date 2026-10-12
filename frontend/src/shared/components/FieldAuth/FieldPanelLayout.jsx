import { NavLink } from 'react-router-dom';
import brandLogo from '../../../assets/kuro-agro-logo.png';
import { ROLE_CONFIG } from './roleConfig';
import FieldBottomNav, { getNavItems } from './FieldBottomNav';

// Shell for the Sanchalak and Surveyor panels. Mobile: slim header + floating bottom nav.
// From md up: the same links move into a top tab bar and the bottom nav is hidden.
const FieldPanelLayout = ({ role, title, children }) => {
  const { label, theme } = ROLE_CONFIG[role];

  return (
    <div className="min-h-screen bg-gray-50 pb-28 md:pb-10">
      <header
        className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={brandLogo} alt="KuroAgro" className="h-8 w-auto object-contain shrink-0" />
            {title && <span className="md:hidden text-base font-bold text-gray-900 truncate">{title}</span>}
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${theme.badge}`}>{label}</span>
        </div>
        <nav className="hidden md:flex max-w-3xl mx-auto px-4 gap-1" aria-label="Sections">
          {getNavItems(role).map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.exact}
              className={({ isActive }) =>
                `px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors ${isActive ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-5">{children}</main>
      <FieldBottomNav role={role} />
    </div>
  );
};

export default FieldPanelLayout;
