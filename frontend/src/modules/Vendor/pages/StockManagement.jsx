import { useState, useEffect, useMemo } from "react";
import {
  FiSearch,
  FiAlertTriangle,
  FiEdit,
  FiPackage,
  FiPlus,
  FiMinus,
  FiTrendingDown,
  FiX,
  FiEye,
  FiLayers,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import DataTable from "../../Admin/components/DataTable";
import ExportButton from "../../Admin/components/ExportButton";
import Badge from "../../../shared/components/Badge";
import { getPlaceholderImage } from "../../../shared/utils/helpers";
import AnimatedSelect from "../../Admin/components/AnimatedSelect";
import { formatPrice } from "../../../shared/utils/helpers";
import { useVendorAuthStore } from "../store/vendorAuthStore";
import { useVendorProductStore } from "../store/vendorProductStore";
import { getVariantStockDetails } from "../utils/variantHelpers";
import toast from "react-hot-toast";

const StockManagement = () => {
  const { vendor } = useVendorAuthStore();
  const { products, isLoading, fetchProducts, patchStock } = useVendorProductStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [alertThreshold, setAlertThreshold] = useState(10);
  const [stockModal, setStockModal] = useState({
    isOpen: false,
    product: null,
  });
  const [viewVariantsModal, setViewVariantsModal] = useState({
    isOpen: false,
    product: null,
  });

  const vendorId = vendor?.id;

  useEffect(() => {
    if (vendorId) {
      fetchProducts({ fetchAll: true, limit: 200 });
    }
  }, [vendorId, fetchProducts]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Stock filter (use backend-computed status for consistency)
    if (stockFilter !== "all") {
      filtered = filtered.filter(
        (product) => String(product.stock || "") === stockFilter
      );
    }

    return filtered;
  }, [products, searchQuery, stockFilter]);

  // Stock statistics
  const stockStats = useMemo(() => {
    const totalProducts = products.length;
    const inStock = products.filter((p) => p.stock === "in_stock").length;
    const lowStock = products.filter((p) => p.stock === "low_stock").length;
    const outOfStock = products.filter((p) => p.stock === "out_of_stock").length;
    const totalValue = products.reduce(
      (sum, p) => sum + p.price * (p.stockQuantity || 0),
      0
    );

    return { totalProducts, inStock, lowStock, outOfStock, totalValue };
  }, [products]);

  const handleStockUpdate = async (productId, payload) => {
    const success = await patchStock(productId, payload);
    if (success) {
      setStockModal({ isOpen: false, product: null });
    }
  };

  // Table columns
  const columns = [
    {
      key: "_id",
      label: "ID",
      sortable: true,
      render: (value, row) => String(value ?? row.id ?? "").slice(-8).toUpperCase(),
    },
    {
      key: "name",
      label: "Product Name",
      sortable: true,
      render: (value, row) => {
        const variantsList = getVariantStockDetails(row);
        const hasVariants = variantsList.length > 0;
        return (
          <div className="flex items-center gap-3">
            <img
              src={row.image || row.images?.[0]}
              alt={value}
              className="w-10 h-10 object-cover rounded-lg border border-gray-100"
              onError={(e) => {
                e.target.src = "https://via.placeholder.com/50x50?text=Product";
              }}
            />
            <div>
              <span className="font-medium text-gray-900 block">{value}</span>
              {hasVariants && (
                <button
                  type="button"
                  onClick={() => setViewVariantsModal({ isOpen: true, product: row })}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-0.5 font-medium"
                >
                  <FiLayers className="text-xs" />
                  {variantsList.length} Variants Stock Breakdown
                </button>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "price",
      label: "Price",
      sortable: true,
      render: (value) => formatPrice(value),
    },
    {
      key: "stockQuantity",
      label: "Exact Stock",
      sortable: true,
      render: (value, row) => {
        const variantsList = getVariantStockDetails(row);
        const hasVariants = variantsList.length > 0;
        const stockNum = Number(value || 0);

        return (
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <span
                className={`font-bold px-2.5 py-1 rounded-md text-sm ${
                  stockNum === 0
                    ? "bg-red-100 text-red-700 border border-red-200"
                    : stockNum <= (row.lowStockThreshold || alertThreshold)
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                }`}
              >
                {stockNum.toLocaleString()} Units
              </span>
            </div>
            {hasVariants && (
              <span className="text-[11px] text-gray-500 font-medium">
                Combined from {variantsList.length} variants
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "stock",
      label: "Status",
      sortable: true,
      render: (value) => (
        <Badge
          variant={
            value === "in_stock"
              ? "success"
              : value === "low_stock"
                ? "warning"
                : "error"
          }>
          {value?.replace("_", " ").toUpperCase() || "N/A"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => {
        const variantsList = getVariantStockDetails(row);
        const hasVariants = variantsList.length > 0;

        return (
          <div className="flex items-center gap-2">
            {hasVariants && (
              <button
                title="View Variant Breakdown"
                onClick={() => setViewVariantsModal({ isOpen: true, product: row })}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <FiEye className="text-lg" />
              </button>
            )}
            <button
              title="Update Stock"
              onClick={() => setStockModal({ isOpen: true, product: row })}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 font-medium text-xs bg-blue-50 px-3 py-1.5"
            >
              <FiEdit /> Edit Stock
            </button>
          </div>
        );
      },
    },
  ];

  if (!vendorId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please log in to manage stock</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="lg:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
            Stock Management
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Manage your product inventory and exact stock levels
          </p>
        </div>
      </div>

      {/* Stock Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Products</p>
            <FiPackage className="text-blue-500 text-xl" />
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {stockStats.totalProducts}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">In Stock</p>
            <FiPackage className="text-green-500 text-xl" />
          </div>
          <p className="text-2xl font-bold text-green-600">
            {stockStats.inStock}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Low Stock</p>
            <FiAlertTriangle className="text-orange-500 text-xl" />
          </div>
          <p className="text-2xl font-bold text-orange-600">
            {stockStats.lowStock}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Out of Stock</p>
            <FiTrendingDown className="text-red-500 text-xl" />
          </div>
          <p className="text-2xl font-bold text-red-600">
            {stockStats.outOfStock}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <AnimatedSelect
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            options={[
              { value: "all", label: "All Stock Status" },
              { value: "in_stock", label: "In Stock" },
              { value: "low_stock", label: "Low Stock" },
              { value: "out_of_stock", label: "Out of Stock" },
            ]}
            className="w-full sm:w-auto min-w-[160px]"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">
              Low Stock Alert Threshold:
            </label>
            <input
              type="number"
              value={alertThreshold}
              onChange={(e) =>
                setAlertThreshold(parseInt(e.target.value, 10) || 10)
              }
              min="1"
              className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* DataTable */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading products stock...</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <>
            <div className="mb-4 flex justify-between items-center">
              <span className="text-sm text-gray-500 font-medium">
                Showing {filteredProducts.length} items with exact stock numbers
              </span>
              <ExportButton
                data={filteredProducts}
                headers={[
                  { label: "ID", accessor: (row) => String(row._id ?? row.id ?? "") },
                  { label: "Name", accessor: (row) => row.name },
                  { label: "Price", accessor: (row) => formatPrice(row.price) },
                  { label: "Exact Stock", accessor: (row) => row.stockQuantity || 0 },
                  { label: "Status", accessor: (row) => row.stock || "N/A" },
                ]}
                filename="vendor-exact-stock"
              />
            </div>
            <DataTable
              data={filteredProducts}
              columns={columns}
              pagination={true}
              itemsPerPage={10}
            />
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No products found</p>
          </div>
        )}
      </div>

      {/* Stock Update Modal */}
      <StockUpdateModal
        isOpen={stockModal.isOpen}
        product={stockModal.product}
        alertThreshold={alertThreshold}
        onClose={() => setStockModal({ isOpen: false, product: null })}
        onUpdate={(payload) => {
          if (stockModal.product) {
            handleStockUpdate(stockModal.product._id ?? stockModal.product.id, payload);
          }
        }}
      />

      {/* View Variants Modal */}
      <ViewVariantsModal
        isOpen={viewVariantsModal.isOpen}
        product={viewVariantsModal.product}
        onClose={() => setViewVariantsModal({ isOpen: false, product: null })}
        onEditClick={() => {
          const p = viewVariantsModal.product;
          setViewVariantsModal({ isOpen: false, product: null });
          setStockModal({ isOpen: true, product: p });
        }}
      />
    </motion.div>
  );
};

// View Variants Breakdown Modal
const ViewVariantsModal = ({ isOpen, product, onClose, onEditClick }) => {
  if (!product || !isOpen) return null;
  const variantDetails = getVariantStockDetails(product);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Variant Stock Breakdown
                  </h2>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Product: {product.name}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <FiX className="text-gray-500" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <span className="text-sm font-semibold text-blue-900">Total Product Stock</span>
                  <span className="text-base font-bold text-blue-700 bg-white px-3 py-1 rounded-md shadow-xs">
                    {(product.stockQuantity || 0).toLocaleString()} Units
                  </span>
                </div>

                {variantDetails.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                    {variantDetails.map((variant) => {
                      const qty = variant.stockQuantity;
                      return (
                        <div
                          key={variant.key}
                          className="flex items-center justify-between p-3 bg-white hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FiLayers className="text-gray-400" />
                            <span className="font-medium text-sm text-gray-800">
                              {variant.label}
                            </span>
                          </div>
                          <span
                            className={`font-bold text-xs px-2.5 py-1 rounded-full ${
                              qty === 0
                                ? "bg-red-100 text-red-700"
                                : qty <= (product.lowStockThreshold || 10)
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {qty === 0 ? "Out of Stock (0)" : `${qty} Units`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    No individual variant stock details found. Total stock is managed as a single pool.
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={onEditClick}
                  className="px-4 py-2 gradient-blue text-white rounded-lg hover:shadow-glow-blue text-sm font-semibold flex items-center gap-1.5"
                >
                  <FiEdit /> Edit Variant Stock
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Stock Update Modal Component (Supports Single Stock & Variant Stock Map)
const StockUpdateModal = ({
  isOpen,
  product,
  alertThreshold,
  onClose,
  onUpdate,
}) => {
  const [stockQuantity, setStockQuantity] = useState(0);
  const [stockAdjustment, setStockAdjustment] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("set");
  const [variantStockMap, setVariantStockMap] = useState({});

  const variantDetails = useMemo(() => {
    return product ? getVariantStockDetails(product) : [];
  }, [product]);

  const hasVariants = variantDetails.length > 0;

  useEffect(() => {
    if (product) {
      setStockQuantity(product.stockQuantity || 0);
      setStockAdjustment("");
      setAdjustmentType("set");

      if (hasVariants) {
        const initialMap = {};
        variantDetails.forEach((v) => {
          initialMap[v.key] = v.stockQuantity;
        });
        setVariantStockMap(initialMap);
      } else {
        setVariantStockMap({});
      }
    }
  }, [product, hasVariants, variantDetails]);

  // Recalculate variant sum whenever variantStockMap changes
  const computedVariantTotal = useMemo(() => {
    if (!hasVariants) return stockQuantity;
    return Object.values(variantStockMap).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [hasVariants, variantStockMap, stockQuantity]);

  if (!product || !isOpen) return null;

  const handleVariantStockChange = (key, value) => {
    const num = Math.max(0, parseInt(value, 10) || 0);
    setVariantStockMap((prev) => ({
      ...prev,
      [key]: num,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (hasVariants) {
      onUpdate({
        variantStockMap,
        stockQuantity: computedVariantTotal,
      });
      return;
    }

    let newQuantity = stockQuantity;
    const adjustment = Math.max(0, parseInt(stockAdjustment, 10) || 0);

    if (adjustmentType === "set") {
      newQuantity = stockQuantity;
    } else if (adjustmentType === "add") {
      newQuantity = (product.stockQuantity || 0) + adjustment;
    } else if (adjustmentType === "subtract") {
      newQuantity = Math.max(0, (product.stockQuantity || 0) - adjustment);
    }

    if (newQuantity < 0) {
      toast.error("Stock quantity cannot be negative");
      return;
    }

    onUpdate({ stockQuantity: newQuantity });
  };

  const quickAdjust = (amount) => {
    const newQuantity = Math.max(0, stockQuantity + amount);
    setStockQuantity(newQuantity);
  };

  const effectiveThreshold = Number(
    product?.lowStockThreshold ?? alertThreshold ?? 10
  );

  const activeTotalStock = hasVariants ? computedVariantTotal : stockQuantity;

  const newStockStatus =
    activeTotalStock === 0
      ? "out_of_stock"
      : activeTotalStock <= effectiveThreshold
        ? "low_stock"
        : "in_stock";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    Update Exact Stock
                  </h2>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <FiX className="text-gray-500" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <img
                    src={product.image || product.images?.[0] || getPlaceholderImage(100, 100, product.name || "Product")}
                    alt={product.name}
                    className="w-14 h-14 object-cover rounded-lg border border-gray-100"
                    onError={(e) => {
                      e.target.src = getPlaceholderImage(100, 100, product.name || "Product");
                    }}
                  />
                  <div>
                    <h3 className="font-semibold text-gray-800 line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Current Stock: <span className="font-bold text-gray-800">{(product.stockQuantity || 0).toLocaleString()} Units</span>
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
                {hasVariants ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-semibold text-gray-700">
                        Exact Stock per Variant ({variantDetails.length})
                      </label>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                        Total: {computedVariantTotal} Units
                      </span>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50 max-h-60 overflow-y-auto">
                      {variantDetails.map((variant) => (
                        <div
                          key={variant.key}
                          className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs"
                        >
                          <span className="text-xs font-medium text-gray-800 truncate flex-1">
                            {variant.label}
                          </span>
                          <div className="flex items-center gap-1 w-28">
                            <input
                              type="number"
                              min="0"
                              value={variantStockMap[variant.key] ?? 0}
                              onChange={(e) => handleVariantStockChange(variant.key, e.target.value)}
                              className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-md text-right font-bold text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                            />
                            <span className="text-[11px] text-gray-400">units</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Adjustment Type
                      </label>
                      <AnimatedSelect
                        value={adjustmentType}
                        onChange={(e) => setAdjustmentType(e.target.value)}
                        options={[
                          { value: "set", label: "Set Quantity" },
                          { value: "add", label: "Add Stock" },
                          { value: "subtract", label: "Subtract Stock" },
                        ]}
                      />
                    </div>

                    {adjustmentType === "set" ? (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          New Stock Quantity
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => quickAdjust(-10)}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg">
                            <FiMinus />
                          </button>
                          <input
                            type="number"
                            value={stockQuantity}
                            onChange={(e) =>
                              setStockQuantity(
                                Math.max(0, parseInt(e.target.value) || 0)
                              )
                            }
                            min="0"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-bold text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <button
                            type="button"
                            onClick={() => quickAdjust(10)}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg">
                            <FiPlus />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {adjustmentType === "add" ? "Add" : "Subtract"} Quantity
                        </label>
                        <input
                          type="number"
                          value={stockAdjustment}
                          onChange={(e) => setStockAdjustment(e.target.value)}
                          min="0"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg font-bold text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">
                      Calculated Status (Alert &le; {effectiveThreshold}):
                    </p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">
                      {activeTotalStock.toLocaleString()} Total Units
                    </p>
                  </div>
                  <Badge
                    variant={
                      newStockStatus === "in_stock"
                        ? "success"
                        : newStockStatus === "low_stock"
                          ? "warning"
                          : "error"
                    }>
                    {newStockStatus.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold text-sm">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 gradient-green text-white rounded-lg hover:shadow-glow-green transition-all font-semibold text-sm">
                    Save Stock Changes
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default StockManagement;
