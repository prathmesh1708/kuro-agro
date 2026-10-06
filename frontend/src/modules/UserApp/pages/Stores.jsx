import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiArrowLeft, FiShoppingBag, FiStar, FiCheckCircle } from 'react-icons/fi';
import { motion } from 'framer-motion';
import MobileLayout from '../components/Layout/MobileLayout';
import PageTransition from '../../../shared/components/PageTransition';
import LazyImage from '../../../shared/components/LazyImage';
import api from '../../../shared/utils/api';

const normalizeVendor = (raw) => {
  const id = String(raw?.id || raw?._id || '');
  const storeName = raw?.storeName || raw?.legalBusinessName || raw?.name || 'Store';
  const totalProducts = Number(raw?.totalProducts ?? raw?.productCount ?? 0);
  return {
    ...raw,
    id,
    _id: id,
    storeName,
    isVerified: !!raw?.isVerified,
    rating: Number(raw?.rating) || 0,
    reviewCount: Number(raw?.reviewCount) || 0,
    totalProducts,
    productCount: totalProducts,
  };
};

const Stores = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let active = true;
    const fetchVendors = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/vendors/all', {
          params: { status: 'approved', page: 1, limit: 100 },
        });
        if (!active) return;
        const payload = response?.data ?? response;
        const vendorList = Array.isArray(payload?.vendors) ? payload.vendors : [];
        setVendors(vendorList.map(normalizeVendor));
      } catch (error) {
        if (active) setVendors([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchVendors();
    return () => {
      active = false;
    };
  }, []);

  const filteredVendors = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return vendors;
    return vendors.filter((v) =>
      v.storeName.toLowerCase().includes(trimmed) ||
      (v.name && v.name.toLowerCase().includes(trimmed)) ||
      (v.legalBusinessName && v.legalBusinessName.toLowerCase().includes(trimmed))
    );
  }, [vendors, searchQuery]);

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={true}>
        <div className="w-full pb-24 lg:pb-12 max-w-7xl mx-auto min-h-screen bg-gray-50">
          {/* Top Header */}
          <div className="bg-[#E8E2FF] border-b border-purple-100 sticky top-0 z-30 px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-white/50 rounded-full transition-colors"
              >
                <FiArrowLeft className="text-xl text-gray-700" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">All Stores</h1>
                <p className="text-xs text-gray-600">Explore trusted sellers & brands</p>
              </div>
            </div>

            {/* Search Bar for Stores */}
            <div className="relative">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base" />
              <input
                type="text"
                placeholder="Search shop name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm border border-purple-100"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Stats bar */}
          <div className="px-4 py-3 flex items-center justify-between bg-white border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <FiShoppingBag className="text-primary-600" />
              <span>{filteredVendors.length} Stores Available</span>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[50vh] p-4">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-gray-600">Loading stores...</p>
              </div>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
              <FiShoppingBag className="text-5xl text-gray-300 mb-3" />
              <h3 className="text-lg font-bold text-gray-800 mb-1">No Stores Found</h3>
              <p className="text-xs text-gray-500 max-w-xs">
                {searchQuery
                  ? `No sellers match "${searchQuery}". Try a different keyword.`
                  : 'No approved sellers available right now.'}
              </p>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {filteredVendors.map((vendor, index) => (
                <motion.div
                  key={vendor.id || vendor._id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.5) }}
                  onClick={() => navigate(`/seller/${vendor.id || vendor._id}`)}
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group"
                >
                  {/* Store Logo */}
                  <div className="relative mb-3">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center overflow-hidden shadow-md group-hover:scale-105 transition-transform">
                      {vendor.storeLogo ? (
                        <LazyImage
                          src={vendor.storeLogo}
                          alt={vendor.storeName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              vendor.storeName
                            )}&background=7C3AED&color=fff&size=128`;
                          }}
                        />
                      ) : (
                        <span className="text-2xl font-bold text-white">
                          {vendor.storeName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {vendor.isVerified && (
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1 border-2 border-white shadow-xs">
                        <FiCheckCircle className="text-white text-xs" />
                      </div>
                    )}
                  </div>

                  {/* Store Name */}
                  <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2 min-h-[2.5rem] group-hover:text-primary-600 transition-colors">
                    {vendor.storeName}
                  </h3>

                  {/* Rating */}
                  {vendor.rating > 0 && (
                    <div className="flex items-center gap-1 mb-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <FiStar
                            key={i}
                            className={`text-[10px] ${
                              i < Math.floor(vendor.rating)
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-600 font-medium">
                        {vendor.rating.toFixed(1)}
                      </span>
                    </div>
                  )}

                  {/* Product count */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-auto pt-2 border-t border-gray-50 w-full justify-center">
                    <FiShoppingBag className="text-primary-500 text-xs" />
                    <span className="font-medium">{vendor.totalProducts} Products</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default Stores;
