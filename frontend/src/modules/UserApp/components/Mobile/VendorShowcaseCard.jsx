import { useNavigate } from 'react-router-dom';
import { FiStar, FiShoppingBag, FiCheckCircle, FiArrowRight } from 'react-icons/fi';
import { motion } from 'framer-motion';
import LazyImage from '../../../../shared/components/LazyImage';

const VendorShowcaseCard = ({ vendor, index = 0 }) => {
  const navigate = useNavigate();
  if (!vendor) return null;
  const vendorId = vendor.id || vendor._id;
  const displayName = vendor.storeName || vendor.legalBusinessName || vendor.name || 'Store';
  const productCount = vendor.totalProducts ?? vendor.productCount ?? 0;

  const handleClick = () => {
    window.scrollTo(0, 0);
    navigate(`/seller/${vendorId}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="glass-card rounded-xl p-4 flex flex-col items-center text-center w-[160px] min-w-[160px] h-full cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Vendor Logo/Avatar */}
      <div className="relative mb-3">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center overflow-hidden shadow-lg">
          {vendor.storeLogo ? (
            <LazyImage
              src={vendor.storeLogo}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=7C3AED&color=fff&size=128`;
              }}
            />
          ) : (
            <span className="text-2xl font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        {vendor.isVerified && (
          <div className="absolute -bottom-1 -right-1 bg-accent-500 rounded-full p-1 border-2 border-white">
            <FiCheckCircle className="text-white text-xs" />
          </div>
        )}
      </div>

      {/* Vendor Name */}
      <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2 min-h-[2.5rem]">
        {displayName}
      </h3>

      {/* Rating */}
      {vendor.rating > 0 && (
        <div className="flex items-center gap-1 mb-2">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <FiStar
                key={i}
                className={`text-[10px] ${i < Math.floor(vendor.rating)
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300'
                  }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-600 font-medium">
            {vendor.rating.toFixed(1)}
          </span>
        </div>
      )}

      {/* Product Count */}
      <div className="flex items-center gap-1 text-xs text-gray-600 mb-3">
        <FiShoppingBag className="text-primary-500" />
        <span>{productCount} products</span>
      </div>

      {/* Visit Store Button */}
      <div className="mt-auto w-full">
        <div className="flex items-center justify-center gap-1 text-primary-600 text-xs font-semibold">
          <span>Visit Store</span>
          <FiArrowRight className="text-xs" />
        </div>
      </div>
    </motion.div>
  );
};

export default VendorShowcaseCard;

