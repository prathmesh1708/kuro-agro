import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiX, FiClock, FiShoppingBag, FiCheckCircle } from 'react-icons/fi';
import { getCatalogProducts } from '../../data/catalogData';
import api from '../../../../shared/utils/api';

const SearchSuggestions = ({
  query,
  isOpen,
  onSelect,
  onClose,
  recentSearches = [],
  onDeleteRecent,
  onClearRecent,
}) => {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [matchingStores, setMatchingStores] = useState([]);
  const trimmedQuery = String(query || '').trim();

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    let cancelled = false;

    const fetchSuggestions = async () => {
      if (!isOpen || !trimmedQuery) {
        setSuggestions([]);
        setMatchingStores([]);
        return;
      }

      try {
        const [productsRes, vendorsRes] = await Promise.allSettled([
          api.get('/products', {
            params: { q: trimmedQuery, page: 1, limit: 5, sort: 'newest' },
          }),
          api.get('/vendors/all', {
            params: { search: trimmedQuery, status: 'approved', page: 1, limit: 4 },
          }),
        ]);

        if (cancelled) return;

        if (productsRes.status === 'fulfilled') {
          const payload = productsRes.value?.data ?? productsRes.value;
          const products = Array.isArray(payload?.products) ? payload.products : [];
          setSuggestions(
            products.map((product) => ({
              id: product?._id || product?.id,
              name: product?.name || '',
              image: product?.image || product?.images?.[0] || '',
              price: Number(product?.price) || 0,
            }))
          );
        } else {
          const fallback = getCatalogProducts()
            .filter((product) =>
              String(product?.name || '').toLowerCase().includes(trimmedQuery.toLowerCase())
            )
            .slice(0, 5);
          setSuggestions(fallback);
        }

        if (vendorsRes.status === 'fulfilled') {
          const vPayload = vendorsRes.value?.data ?? vendorsRes.value;
          const vendors = Array.isArray(vPayload?.vendors) ? vPayload.vendors : [];
          setMatchingStores(
            vendors.map((v) => ({
              id: String(v.id || v._id || ''),
              storeName: v.storeName || v.legalBusinessName || v.name || 'Store',
              storeLogo: v.storeLogo || '',
              isVerified: !!v.isVerified,
              totalProducts: Number(v.totalProducts ?? v.productCount ?? 0),
            }))
          );
        } else {
          setMatchingStores([]);
        }
      } catch {
        if (cancelled) return;
        setSuggestions([]);
        setMatchingStores([]);
      }
    };

    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [isOpen, trimmedQuery]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-96 overflow-y-auto"
        >
          {/* Recent Searches */}
          {recentSearches.length > 0 && trimmedQuery.length === 0 && (
            <div className="p-2">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-semibold text-gray-600">Recent Searches</span>
                <button
                  onClick={() => {
                    if (onClearRecent) {
                      onClearRecent();
                    }
                  }}
                  className="text-xs text-primary-600 font-medium"
                >
                  Clear All
                </button>
              </div>
              {recentSearches.map((search, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onSelect(search)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-colors text-left"
                >
                  <FiClock className="text-gray-400 text-sm" />
                  <span className="text-sm text-gray-700 flex-1">{search}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRecent(index);
                    }}
                    className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <FiX className="text-gray-500 text-xs" />
                  </button>
                </motion.button>
              ))}
            </div>
          )}

          {/* Matching Stores / Shops */}
          {trimmedQuery.length > 0 && matchingStores.length > 0 && (
            <div className="p-2 border-b border-gray-100 bg-purple-50/40">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-xs font-bold text-purple-800 flex items-center gap-1.5">
                  <FiShoppingBag className="text-purple-600" />
                  Matching Stores
                </span>
                <span className="text-[10px] text-purple-600 font-medium">{matchingStores.length} found</span>
              </div>
              <div className="grid grid-cols-1 gap-1 mt-1">
                {matchingStores.map((store) => (
                  <button
                    key={store.id}
                    onClick={() => {
                      onClose?.();
                      navigate(`/seller/${store.id}`);
                    }}
                    className="w-full flex items-center gap-3 p-2 hover:bg-purple-100/60 rounded-lg transition-colors text-left border border-purple-100 bg-white"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                      {store.storeLogo ? (
                        <img src={store.storeLogo} alt={store.storeName} className="w-full h-full object-cover" />
                      ) : (
                        store.storeName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-gray-800 truncate">{store.storeName}</span>
                        {store.isVerified && <FiCheckCircle className="text-emerald-500 text-[10px] shrink-0" />}
                      </div>
                      <span className="text-[10px] text-gray-500">{store.totalProducts} Products</span>
                    </div>
                    <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                      Visit Store
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product Suggestions */}
          {trimmedQuery.length > 0 && suggestions.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2">
                <span className="text-xs font-semibold text-gray-600">Product Suggestions</span>
              </div>
              {suggestions.map((product, index) => (
                <motion.button
                  key={product.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onSelect(product.name)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-colors text-left"
                >
                  <FiSearch className="text-gray-400 text-sm" />
                  <span className="text-sm text-gray-700">{product.name}</span>
                </motion.button>
              ))}
            </div>
          )}

          {suggestions.length === 0 && matchingStores.length === 0 && recentSearches.length === 0 && trimmedQuery.length > 0 && (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500">No stores or products found</p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchSuggestions;

