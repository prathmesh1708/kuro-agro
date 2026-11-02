import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiFileText,
  FiArrowLeft,
  FiClock,
  FiShield,
  FiSearch,
  FiCheckCircle,
} from "react-icons/fi";
import {
  TERMS_CONDITIONS_SECTIONS,
  ROLE_TABS,
  LAST_UPDATED_DATE,
} from "../data/kuroAgroLegalData";

const StaticTermsConditions = ({ defaultRole }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine initial role from props, query parameter, or URL path
  const initialRole = useMemo(() => {
    if (defaultRole) return defaultRole;
    const params = new URLSearchParams(location.search);
    const queryRole = params.get("role");
    if (queryRole && ROLE_TABS.some((tab) => tab.id === queryRole)) {
      return queryRole;
    }
    if (location.pathname.includes("/delivery/")) return "delivery";
    if (location.pathname.includes("/vendor/")) return "vendor";
    return "all";
  }, [defaultRole, location]);

  const [activeRole, setActiveRole] = useState(initialRole);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (initialRole) {
      setActiveRole(initialRole);
    }
  }, [initialRole]);

  // Filter sections by selected role and search query
  const filteredSections = useMemo(() => {
    return TERMS_CONDITIONS_SECTIONS.filter((section) => {
      const matchesRole =
        activeRole === "all" || section.roles.includes(activeRole);
      if (!matchesRole) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = section.title.toLowerCase().includes(q);
      const inBody = section.body.some((p) => p.toLowerCase().includes(q));
      return inTitle || inBody;
    });
  }, [activeRole, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
              className="p-2 sm:p-2.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
              aria-label="Go Back"
            >
              <FiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight flex items-center gap-2">
                <FiFileText className="w-5 h-5 text-purple-600 shrink-0" />
                Terms & Conditions
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                KuroAgro Agri-Solutions · Updated {LAST_UPDATED_DATE}
              </p>
            </div>
          </div>

          <Link
            to="/privacy-policy"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
          >
            <FiShield className="w-3.5 h-3.5" />
            Privacy Policy →
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Banner Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 mb-2">
                <FiCheckCircle className="w-3.5 h-3.5" />
                Rules for Using KuroAgro
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Role-Based Platform Terms & Operating Rules
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                These terms govern your relationship with KuroAgro as a Customer, Delivery Partner,
                Farmer (Kisan), Vendor, or Field Executive. Select your role below for specific rules.
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 shrink-0">
              <FiClock className="w-4 h-4 text-purple-600" />
              <span>Effective: {LAST_UPDATED_DATE}</span>
            </div>
          </div>

          {/* Role Filter Tabs */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Select Role View
            </label>
            <div className="flex flex-wrap gap-2">
              {ROLE_TABS.map((tab) => {
                const isActive = activeRole === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveRole(tab.id);
                      setSearchQuery("");
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Filter Bar */}
          <div className="mt-4 relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in terms clauses..."
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all text-slate-800"
            />
          </div>
        </motion.div>

        {/* Content Sections */}
        <div className="space-y-4">
          {filteredSections.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
              <p className="text-slate-500 font-medium">No matching terms sections found.</p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-3 px-4 py-1.5 text-xs font-semibold text-purple-600 bg-purple-50 rounded-lg"
              >
                Clear Search Filter
              </button>
            </div>
          ) : (
            filteredSections.map((section, idx) => (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm hover:shadow transition-shadow"
              >
                <div className="flex items-start gap-3.5">
                  <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-purple-50 text-purple-700 text-xs font-extrabold border border-purple-200 shrink-0 mt-0.5">
                    {section.badge}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {section.title}
                    </h3>
                    <div className="mt-3 space-y-2.5">
                      {section.body.map((paragraph, pIdx) => (
                        <p
                          key={pIdx}
                          className="text-xs sm:text-sm text-slate-650 text-slate-600 leading-relaxed"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Footer Navigation Link */}
        <div className="pt-2 pb-6 text-center">
          <Link
            to="/privacy-policy"
            className="inline-flex items-center gap-2 text-sm font-bold text-purple-700 hover:text-purple-800 transition-colors py-2 px-4 rounded-xl hover:bg-purple-50"
          >
            <span>Read KuroAgro Privacy Policy</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StaticTermsConditions;

