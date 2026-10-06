import { useState, useEffect } from "react";
import { FiCheck, FiX, FiEdit, FiGitMerge, FiTrash2, FiSearch, FiExternalLink } from "react-icons/fi";
import { motion } from "framer-motion";
import { useBrandStore } from "../../../../shared/store/brandStore";
import { getBrandApprovals, updateBrandStatus, renameBrand, mergeBrands, deleteBrand } from "../../services/adminService";
import DataTable from "../../components/DataTable";
import ConfirmModal from "../../components/ConfirmModal";
import AnimatedSelect from "../../components/AnimatedSelect";
import toast from "react-hot-toast";

const BrandApprovals = () => {
  const { brands: allBrands, initialize: initBrands } = useBrandStore();
  const [approvals, setApprovals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Modals state
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: "", brand: null });
  const [renameModal, setRenameModal] = useState({ isOpen: false, brand: null, newName: "" });
  const [mergeModal, setMergeModal] = useState({ isOpen: false, sourceBrand: null, targetBrandId: "" });

  const fetchApprovals = async () => {
    setIsLoading(true);
    try {
      const res = await getBrandApprovals();
      setApprovals(res?.data || []);
    } catch (err) {
      toast.error("Failed to load brand approvals");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
    initBrands();
  }, []);

  const handleStatusChange = async (brandId, status) => {
    try {
      await updateBrandStatus(brandId, status);
      toast.success(`Brand ${status.toLowerCase()} successfully`);
      fetchApprovals();
      initBrands();
    } catch (err) {
      // Handled by api interceptor
    }
  };

  const handleRename = async () => {
    const { brand, newName } = renameModal;
    if (!newName.trim()) {
      toast.error("Brand name cannot be empty");
      return;
    }
    try {
      await renameBrand(brand._id || brand.id, newName.trim());
      toast.success("Brand renamed successfully");
      setRenameModal({ isOpen: false, brand: null, newName: "" });
      fetchApprovals();
      initBrands();
    } catch (err) {
      // Handled by api interceptor
    }
  };

  const handleMerge = async () => {
    const { sourceBrand, targetBrandId } = mergeModal;
    if (!targetBrandId) {
      toast.error("Please select a target brand");
      return;
    }
    try {
      await mergeBrands(sourceBrand._id || sourceBrand.id, targetBrandId);
      toast.success("Brands merged successfully");
      setMergeModal({ isOpen: false, sourceBrand: null, targetBrandId: "" });
      fetchApprovals();
      initBrands();
    } catch (err) {
      // Handled by api interceptor
    }
  };

  const handleDelete = async (brandId) => {
    try {
      await deleteBrand(brandId);
      toast.success("Empty brand deleted successfully");
      fetchApprovals();
      initBrands();
    } catch (err) {
      // Handled by api interceptor (e.g. 409 conflict if brand is not empty)
    }
  };

  const filteredApprovals = approvals.filter((brand) => {
    const matchesSearch =
      !searchQuery ||
      brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (brand.vendorName || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      selectedStatus === "all" ||
      brand.status?.toLowerCase() === selectedStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      key: "name",
      label: "Brand Name",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          {row.logo ? (
            <img
              src={row.logo}
              alt={value}
              className="w-10 h-10 object-cover rounded-lg border border-gray-200"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xs border border-gray-200">
              N/A
            </div>
          )}
          <div>
            <span className="font-semibold text-gray-900 block">{value}</span>
            <span className="text-xs text-gray-500">Slug: {row.slug}</span>
          </div>
        </div>
      ),
    },
    {
      key: "vendorName",
      label: "Created By Seller",
      sortable: true,
      render: (value, row) => (
        <div>
          <span className="font-medium text-gray-800 block">{value || "Unknown Store"}</span>
          <span className="text-xs text-gray-500">{row.vendorEmail}</span>
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Creation Date",
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: "totalProducts",
      label: "Total Products",
      sortable: true,
      render: (value) => (
        <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">
          {value || 0}
        </span>
      ),
    },
    {
      key: "website",
      label: "Website / Country",
      render: (_, row) => (
        <div>
          {row.website ? (
            <a
              href={row.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline flex items-center gap-1 text-xs">
              <span>{row.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
              <FiExternalLink />
            </a>
          ) : (
            <span className="text-xs text-gray-400">No Website</span>
          )}
          {row.country && <span className="text-xs text-gray-500 block mt-0.5">Country: {row.country}</span>}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            value === "Approved"
              ? "bg-green-100 text-green-800"
              : value === "Rejected"
              ? "bg-red-100 text-red-800"
              : "bg-yellow-100 text-yellow-800"
          }`}>
          {value || "Pending"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1.5">
          {row.status !== "Approved" && (
            <button
              onClick={() => handleStatusChange(row._id || row.id, "Approved")}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Approve Brand">
              <FiCheck className="text-lg" />
            </button>
          )}
          {row.status !== "Rejected" && (
            <button
              onClick={() => handleStatusChange(row._id || row.id, "Rejected")}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Reject Brand">
              <FiX className="text-lg" />
            </button>
          )}
          <button
            onClick={() => setRenameModal({ isOpen: true, brand: row, newName: row.name })}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Rename Brand">
            <FiEdit className="text-base" />
          </button>
          <button
            onClick={() => setMergeModal({ isOpen: true, sourceBrand: row, targetBrandId: "" })}
            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Merge Brand">
            <FiGitMerge className="text-base" />
          </button>
          {(!row.totalProducts || row.totalProducts === 0) && (
            <button
              onClick={() => setConfirmModal({ isOpen: true, type: "delete", brand: row })}
              className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 rounded-lg transition-colors"
              title="Delete Empty Brand">
              <FiTrash2 className="text-base" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Brand Approval Management</h1>
        <p className="text-sm text-gray-500">
          Review and manage product brands suggested by marketplace sellers.
        </p>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="relative flex-1 w-full">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by brand name or vendor..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          <AnimatedSelect
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
            ]}
            className="w-full sm:w-auto min-w-[160px]"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <DataTable
          data={filteredApprovals}
          columns={columns}
          pagination={true}
          itemsPerPage={10}
          isLoading={isLoading}
        />
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: "", brand: null })}
        onConfirm={() => {
          if (confirmModal.brand) {
            handleDelete(confirmModal.brand._id || confirmModal.brand.id);
          }
          setConfirmModal({ isOpen: false, type: "", brand: null });
        }}
        title="Delete Empty Brand?"
        message={`Are you sure you want to delete "${confirmModal.brand?.name}"? This brand has no products and will be permanently removed.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* Rename Modal */}
      {renameModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Rename Brand</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Brand Name
                </label>
                <input
                  type="text"
                  value={renameModal.newName}
                  onChange={(e) => setRenameModal(prev => ({ ...prev, newName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setRenameModal({ isOpen: false, brand: null, newName: "" })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 font-semibold transition-colors">
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-colors">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">Merge Duplicate Brand</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                You are merging <strong>{mergeModal.sourceBrand?.name}</strong>. All products under this brand will be moved to the target brand.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Select Target Brand
                </label>
                <AnimatedSelect
                  value={mergeModal.targetBrandId}
                  onChange={(e) => setMergeModal(prev => ({ ...prev, targetBrandId: e.target.value }))}
                  placeholder="Select target brand..."
                  searchable={true}
                  options={allBrands
                    .filter((b) => (b._id || b.id) !== (mergeModal.sourceBrand?._id || mergeModal.sourceBrand?.id))
                    .map((b) => ({ value: String(b._id || b.id), label: b.name }))}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setMergeModal({ isOpen: false, sourceBrand: null, targetBrandId: "" })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 font-semibold transition-colors">
                Cancel
              </button>
              <button
                onClick={handleMerge}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors">
                Merge Brands
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default BrandApprovals;
