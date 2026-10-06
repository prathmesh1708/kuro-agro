import { Link } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { categories as fallbackCategories } from "../../../../data/categories";
import LazyImage from "../../../../shared/components/LazyImage";
import { useCategoryStore } from "../../../../shared/store/categoryStore";
import { getCategoryFallbackImage } from "../../../../shared/utils/helpers";

const normalizeId = (value) => String(value ?? "").trim();

const MobileCategoryGrid = () => {
  const { categories, initialize, getRootCategories } = useCategoryStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const displayCategories = useMemo(() => {
    const roots = getRootCategories().filter((cat) => cat.isActive !== false);
    if (!roots.length) return fallbackCategories;

    return roots.map((cat) => {
      const fallbackCat = fallbackCategories.find(
        (fc) =>
          normalizeId(fc.id) === normalizeId(cat.id) ||
          fc.name?.toLowerCase() === cat.name?.toLowerCase()
      );
      const img = cat.image || fallbackCat?.image || getCategoryFallbackImage(cat.name);
      return {
        ...(fallbackCat || {}),
        ...cat,
        image: img,
      };
    });
  }, [categories, getRootCategories]);

  return (
    <div className="px-4 py-4">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Browse Categories
      </h2>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
        {displayCategories.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="flex-shrink-0">
            <Link
              to={`/category/${category.id}`}
              className="flex flex-col items-center gap-2 w-20">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 ring-2 ring-gray-200">
                <LazyImage
                  src={category.image || getCategoryFallbackImage(category.name)}
                  alt={category.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = getCategoryFallbackImage(category.name);
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-700 text-center line-clamp-2">
                {category.name}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default MobileCategoryGrid;
