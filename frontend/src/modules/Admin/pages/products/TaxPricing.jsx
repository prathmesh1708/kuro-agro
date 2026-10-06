import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { FiPlus, FiEdit, FiTrash2, FiSave, FiSettings, FiActivity, FiTag, FiShoppingBag, FiInfo } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import ConfirmModal from "../../components/ConfirmModal";
import AnimatedSelect from "../../components/AnimatedSelect";
import { formatPrice } from "../../../../shared/utils/helpers";
import {
  getTaxPricingRules,
  updateTaxPricingRules,
  getGstRules,
  createGstRule,
  updateGstRule,
  toggleGstRule,
  deleteGstRule,
  getGstHistory,
  getAllCategories,
  getAllProducts,
  getGstLedger,
} from "../../services/adminService";
import toast from "react-hot-toast";

const TaxPricing = () => {
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith("/app");

  // Tab state
  const [activeMainTab, setActiveMainTab] = useState("gst"); // "gst" or "pricing"
  const [activeGstTab, setActiveGstTab] = useState("global"); // "global", "category", "product", "history", "ledger"

  // Data states
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [gstRules, setGstRules] = useState([]);
  const [gstHistory, setGstHistory] = useState([]);
  const [gstLedger, setGstLedger] = useState({
    orders: [],
    summary: { totalGst: 0, totalCgst: 0, totalSgst: 0, totalTaxableAmount: 0 }
  });
  const [isLoading, setIsLoading] = useState(false);

  // Pricing rules from legacy Settings (preserved as requested)
  const [pricingRules, setPricingRules] = useState([]);
  const [editingPricing, setEditingPricing] = useState(null);

  // GST Modals / forms
  const [isGstModalOpen, setIsGstModalOpen] = useState(false);
  const [editingGstRule, setEditingGstRule] = useState(null); // null for new, GstRule object for edit
  const [gstFormType, setGstFormType] = useState("global"); // 'global', 'category', 'product'
  const [gstForm, setGstForm] = useState({
    name: "",
    rate: 18,
    hsnCode: "",
    categoryId: "",
    productId: "",
    description: "",
    reason: "",
  });

  // Toggle/Delete confirmation states
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    id: null,
    type: null, // "gst" or "pricing"
  });
  const [ruleReason, setRuleReason] = useState("");

  // Load Categories & Products on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const catRes = await getAllCategories();
        if (catRes?.data) setCategories(catRes.data);

        const prodRes = await getAllProducts({ limit: 100 });
        if (prodRes?.data) {
          setProducts(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data.products || []);
        }
      } catch (err) {
        console.error("Error loading categories/products:", err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch GST rules & history
  const loadGstData = async () => {
    setIsLoading(true);
    try {
      const rulesRes = await getGstRules();
      if (rulesRes?.data) setGstRules(rulesRes.data);

      const historyRes = await getGstHistory();
      if (historyRes?.data) setGstHistory(historyRes.data);

      const ledgerRes = await getGstLedger();
      if (ledgerRes?.data) setGstLedger(ledgerRes.data);
    } catch (err) {
      console.error("Error loading GST data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load rules & legacy pricing rules
  useEffect(() => {
    const loadRules = async () => {
      try {
        const response = await getTaxPricingRules();
        const payload = response?.data || {};
        if (Array.isArray(payload.pricingRules) && payload.pricingRules.length > 0) {
          setPricingRules(payload.pricingRules);
        }
      } catch (error) {
        console.error("Error loading pricing rules:", error);
      }
    };

    loadRules();
    loadGstData();
  }, []);

  // Handle saving legacy pricing rules
  const handleSavePricing = async (pricingData) => {
    const currentPricingRules = [...pricingRules];
    let nextPricingRules = [];

    if (editingPricing?.id) {
      nextPricingRules = currentPricingRules.map((p) =>
        p.id === editingPricing.id ? { ...pricingData, id: editingPricing.id } : p
      );
      toast.success("Pricing rule updated");
    } else {
      nextPricingRules = [...currentPricingRules, { ...pricingData, id: currentPricingRules.length + 1 }];
      toast.success("Pricing rule added");
    }

    try {
      await updateTaxPricingRules({
        taxRules: [], // Ignored now in favor of GstRule collection
        pricingRules: nextPricingRules,
      });
      setPricingRules(nextPricingRules);
      setEditingPricing(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle saving GST rules
  const handleSaveGstRule = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: gstForm.name,
        rate: Number(gstForm.rate),
        hsnCode: gstForm.hsnCode,
        type: gstFormType,
        categoryId: gstFormType === "category" ? gstForm.categoryId : null,
        productId: gstFormType === "product" ? gstForm.productId : null,
        description: gstForm.description,
        reason: gstForm.reason,
      };

      if (editingGstRule) {
        await updateGstRule(editingGstRule._id, data);
        toast.success("GST Rule updated successfully");
      } else {
        await createGstRule(data);
        toast.success("GST Rule created successfully");
      }

      setIsGstModalOpen(false);
      setEditingGstRule(null);
      setGstForm({
        name: "",
        rate: 18,
        hsnCode: "",
        categoryId: "",
        productId: "",
        description: "",
        reason: "",
      });
      loadGstData();
    } catch (err) {
      // Axios interceptor shows error toasts
    }
  };

  const handleToggleGst = async (rule) => {
    try {
      await toggleGstRule(rule._id, "Toggled rule status via admin switch");
      toast.success(`GST Rule ${rule.isActive ? "deactivated" : "activated"} successfully`);
      loadGstData();
    } catch (err) {
      console.error(err);
    }
  };

  const openDeleteModal = (id, type) => {
    setDeleteConfirmModal({
      isOpen: true,
      id,
      type,
    });
    setRuleReason("");
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteConfirmModal.type === "gst") {
        await deleteGstRule(deleteConfirmModal.id, ruleReason || "Deleted by Administrator");
        toast.success("GST Rule deleted successfully");
        loadGstData();
      } else {
        const nextPricingRules = pricingRules.filter((p) => p.id !== deleteConfirmModal.id);
        await updateTaxPricingRules({
          taxRules: [],
          pricingRules: nextPricingRules,
        });
        setPricingRules(nextPricingRules);
        toast.success("Pricing rule deleted");
      }
      setDeleteConfirmModal({ isOpen: false, id: null, type: null });
    } catch (err) {
      console.error(err);
    }
  };

  const openAddGstModal = (type) => {
    setGstFormType(type);
    setEditingGstRule(null);
    setGstForm({
      name: type === "global" ? "Default Global GST" : "",
      rate: 18,
      hsnCode: "",
      categoryId: "",
      productId: "",
      description: "",
      reason: "",
    });
    setIsGstModalOpen(true);
  };

  const openEditGstModal = (rule) => {
    setGstFormType(rule.type);
    setEditingGstRule(rule);
    setGstForm({
      name: rule.name,
      rate: rule.rate,
      hsnCode: rule.hsnCode || "",
      categoryId: rule.categoryId?._id || rule.categoryId || "",
      productId: rule.productId?._id || rule.productId || "",
      description: rule.description || "",
      reason: "",
    });
    setIsGstModalOpen(true);
  };

  // Filter rules by type
  const globalRules = gstRules.filter((r) => r.type === "global");
  const categoryRules = gstRules.filter((r) => r.type === "category");
  const productRules = gstRules.filter((r) => r.type === "product");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            GST & Tax Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure GST rules, priority category taxation, product overrides, and view compliance audits.
          </p>
        </div>

        {/* Main tabs switch */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveMainTab("gst")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              activeMainTab === "gst"
                ? "bg-white text-primary-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            GST Engine Rules
          </button>
          <button
            onClick={() => setActiveMainTab("pricing")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              activeMainTab === "pricing"
                ? "bg-white text-primary-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Custom Pricing Rules
          </button>
        </div>
      </div>

      {activeMainTab === "gst" ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sub Sidebar for GST */}
          <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2 h-fit">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-3">
              GST Configuration
            </h3>
            <button
              onClick={() => setActiveGstTab("global")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                activeGstTab === "global"
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <FiSettings className="w-4 h-4" />
              <span>Global Default GST</span>
            </button>
            <button
              onClick={() => setActiveGstTab("category")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                activeGstTab === "category"
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <FiTag className="w-4 h-4" />
              <span>Category GST Rules</span>
            </button>
            <button
              onClick={() => setActiveGstTab("product")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                activeGstTab === "product"
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <FiShoppingBag className="w-4 h-4" />
              <span>Product Overrides</span>
            </button>
            <button
              onClick={() => setActiveGstTab("history")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                activeGstTab === "history"
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <FiActivity className="w-4 h-4" />
              <span>GST Compliance Log</span>
            </button>
            <button
              onClick={() => setActiveGstTab("ledger")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                activeGstTab === "ledger"
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <FiInfo className="w-4 h-4" />
              <span>GST Tax Ledger (Govt)</span>
            </button>

            <div className="pt-4 border-t border-gray-100 px-2">
              <div className="flex gap-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                <FiInfo className="shrink-0 mt-0.5" />
                <p>
                  <strong>Priority order:</strong> Product Override &rarr; Category GST &rarr; Global Default GST.
                </p>
              </div>
            </div>
          </div>

          {/* Main GST Workspace */}
          <div className="lg:col-span-3">
            {activeGstTab === "global" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Global Default GST</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Applied to all products by default unless overridden.</p>
                  </div>
                  {globalRules.length === 0 && (
                    <button
                      onClick={() => openAddGstModal("global")}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                    >
                      <FiPlus /> Initialize Global GST
                    </button>
                  )}
                </div>

                {globalRules.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {globalRules.map((rule) => (
                      <div key={rule._id} className="border border-gray-200 rounded-xl p-5 relative bg-gray-50/50">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="px-2.5 py-1 bg-primary-100 text-primary-800 rounded-full text-xs font-bold uppercase">
                              Active Global Rule
                            </span>
                            <h3 className="text-lg font-bold text-gray-800 mt-3">{rule.name}</h3>
                            <p className="text-3xl font-black text-gray-900 mt-2">{rule.rate}%</p>
                            {rule.hsnCode && (
                              <p className="text-sm text-gray-500 mt-2 font-mono">HSN Code: {rule.hsnCode}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-3">{rule.description || "No description provided."}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditGstModal(rule)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <FiEdit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => openDeleteModal(rule._id, "gst")}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <FiTrash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                    <FiSettings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No Global Default GST configured yet.</p>
                  </div>
                )}
              </div>
            )}

            {activeGstTab === "category" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Category-wise GST Rules</h2>
                    <p className="text-sm text-gray-500 mt-0.5">View custom tax rates per category level (configured by sellers).</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-xs font-bold uppercase">
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Rule Name</th>
                        <th className="py-3 px-4">GST Rate</th>
                        <th className="py-3 px-4">HSN Code</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {categoryRules.map((rule) => (
                        <tr key={rule._id} className="hover:bg-gray-50">
                          <td className="py-4 px-4 font-bold text-gray-800">
                            {rule.categoryId?.name || "N/A"}
                          </td>
                          <td className="py-4 px-4 text-gray-600">{rule.name}</td>
                          <td className="py-4 px-4 font-black text-gray-900">{rule.rate}%</td>
                          <td className="py-4 px-4 font-mono text-gray-500">{rule.hsnCode || "—"}</td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${rule.isActive ? 'bg-green-100 text-green-850' : 'bg-gray-100 text-gray-600'}`}>
                              {rule.isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {categoryRules.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-gray-400">
                            No Category rules configured yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeGstTab === "product" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Product Specific GST Overrides</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Maximum priority GST rates applied directly to unique products (configured by sellers).</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-xs font-bold uppercase">
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-4">Rule Name</th>
                        <th className="py-3 px-4">GST Rate</th>
                        <th className="py-3 px-4">HSN Code</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {productRules.map((rule) => (
                        <tr key={rule._id} className="hover:bg-gray-50">
                          <td className="py-4 px-4 font-bold text-gray-800">
                            {rule.productId?.name || "N/A"}
                          </td>
                          <td className="py-4 px-4 text-gray-600">{rule.name}</td>
                          <td className="py-4 px-4 font-black text-gray-900">{rule.rate}%</td>
                          <td className="py-4 px-4 font-mono text-gray-500">{rule.hsnCode || "—"}</td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${rule.isActive ? 'bg-green-100 text-green-850' : 'bg-gray-100 text-gray-600'}`}>
                              {rule.isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {productRules.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-gray-400">
                            No Product GST overrides configured.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeGstTab === "history" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">GST Compliance Audit Log</h2>
                  <p className="text-sm text-gray-500 mt-0.5">History of GST rule creation, updates, and removals with change reason.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-xs font-bold uppercase">
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Rule Affected</th>
                        <th className="py-3 px-4">Rate Change</th>
                        <th className="py-3 px-4">Modified By</th>
                        <th className="py-3 px-4">Change Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {gstHistory.map((log) => {
                        const rateOld = log.oldValue?.rate !== undefined ? `${log.oldValue.rate}%` : "—";
                        const rateNew = log.newValue?.rate !== undefined ? `${log.newValue.rate}%` : "—";

                        return (
                          <tr key={log._id} className="hover:bg-gray-50">
                            <td className="py-4 px-4 text-xs text-gray-500">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="py-4 px-4 font-semibold">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                log.action === 'create' ? 'bg-green-100 text-green-800' :
                                log.action === 'update' ? 'bg-blue-100 text-blue-800' :
                                log.action === 'delete' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-gray-800 font-medium">
                              {log.gstRuleId?.name || log.oldValue?.name || "Deleted Rule"}
                            </td>
                            <td className="py-4 px-4 font-mono font-bold text-gray-700">
                              {log.action === 'create' ? rateNew : `${rateOld} → ${rateNew}`}
                            </td>
                            <td className="py-4 px-4 text-gray-600">{log.changedBy?.name || "System"}</td>
                            <td className="py-4 px-4 text-gray-500 italic max-w-xs truncate" title={log.reason}>
                              {log.reason || "—"}
                            </td>
                          </tr>
                        );
                      })}
                      {gstHistory.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-400">
                            No compliance logs available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeGstTab === "ledger" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 font-extrabold">GST Tax Ledger</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Real-time ledger compiling all collected GST/CGST/SGST taxes from orders.</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <span className="text-gray-500 text-xs font-semibold block">Total Taxable Amount</span>
                    <span className="text-xl font-bold text-gray-900">{formatPrice(gstLedger.summary?.totalTaxableAmount || 0)}</span>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <span className="text-blue-700 text-xs font-semibold block">CGST Collected (Central)</span>
                    <span className="text-xl font-bold text-blue-900">{formatPrice(gstLedger.summary?.totalCgst || 0)}</span>
                  </div>
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <span className="text-emerald-700 text-xs font-semibold block">SGST Collected (State)</span>
                    <span className="text-xl font-bold text-emerald-900">{formatPrice(gstLedger.summary?.totalSgst || 0)}</span>
                  </div>
                  <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl">
                    <span className="text-primary-700 text-xs font-semibold block">Total GST Liability</span>
                    <span className="text-xl font-black text-primary-900">{formatPrice(gstLedger.summary?.totalGst || 0)}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-xs font-bold uppercase">
                        <th className="py-3 px-4">Order ID</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4 text-right">Taxable Amount</th>
                        <th className="py-3 px-4 text-right">CGST (50%)</th>
                        <th className="py-3 px-4 text-right">SGST (50%)</th>
                        <th className="py-3 px-4 text-right">Total GST</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {gstLedger.orders?.map((ord) => {
                        const taxableAmt = (ord.subtotal || 0) - (ord.discount || 0);
                        const gst = ord.tax || 0;
                        return (
                          <tr key={ord._id} className="hover:bg-gray-50">
                            <td className="py-4 px-4 font-semibold text-primary-600">#{ord.orderId}</td>
                            <td className="py-4 px-4 text-xs text-gray-500">{new Date(ord.createdAt).toLocaleDateString()}</td>
                            <td className="py-4 px-4 font-medium text-gray-800">{ord.shippingAddress?.name || "Guest User"}</td>
                            <td className="py-4 px-4 text-right font-mono">{formatPrice(taxableAmt)}</td>
                            <td className="py-4 px-4 text-right text-gray-600 font-mono">{formatPrice(gst / 2)}</td>
                            <td className="py-4 px-4 text-right text-gray-600 font-mono">{formatPrice(gst / 2)}</td>
                            <td className="py-4 px-4 text-right font-bold text-gray-900 font-mono">{formatPrice(gst)}</td>
                          </tr>
                        );
                      })}
                      {(!gstLedger.orders || gstLedger.orders.length === 0) && (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-gray-400">
                            No tax ledger transactions found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* LEGACY PRICING RULES (PRESERVED) */
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Custom Pricing Strategies</h2>
              <p className="text-xs text-gray-500 mt-0.5">Apply bulk discounts and markups across client categories.</p>
            </div>
            <button
              onClick={() => setEditingPricing({})}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-semibold"
            >
              <FiPlus />
              <span>Add Pricing Rule</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pricingRules.map((pricing) => (
              <div key={pricing.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{pricing.name}</h3>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>Type: {pricing.type}</p>
                      <p>Value: {pricing.value}%</p>
                      {pricing.minQuantity && <p>Min Quantity: {pricing.minQuantity}</p>}
                      <p
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          pricing.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {pricing.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingPricing(pricing)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <FiEdit />
                    </button>
                    <button
                      onClick={() => openDeleteModal(pricing.id, "pricing")}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {pricingRules.length === 0 && (
              <div className="col-span-2 text-center py-6 text-gray-400">
                No pricing rules defined.
              </div>
            )}
          </div>
        </div>
      )}

      {/* GST Rule Add/Edit Modal */}
      <AnimatePresence>
        {isGstModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGstModalOpen(false)}
              className="fixed inset-0 bg-black/60 z-[10000] backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
                <h3 className="text-xl font-bold text-gray-800">
                  {editingGstRule ? `Edit GST Rule` : `Add New GST Rule`}
                </h3>

                <form onSubmit={handleSaveGstRule} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rule Name</label>
                    <input
                      type="text"
                      required
                      value={gstForm.name}
                      onChange={(e) => setGstForm({ ...gstForm, name: e.target.value })}
                      placeholder="e.g. Standard rate, Luxury items tax"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">GST Rate (%)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        step="0.01"
                        value={gstForm.rate}
                        onChange={(e) => setGstForm({ ...gstForm, rate: e.target.value })}
                        placeholder="18"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">HSN Code</label>
                      <input
                        type="text"
                        value={gstForm.hsnCode}
                        onChange={(e) => setGstForm({ ...gstForm, hsnCode: e.target.value })}
                        placeholder="e.g. 84713010"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm font-mono"
                      />
                    </div>
                  </div>

                  {gstFormType === "category" && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Category</label>
                      <AnimatedSelect
                        value={gstForm.categoryId}
                        onChange={(e) => setGstForm({ ...gstForm, categoryId: e.target.value })}
                        options={[
                          { value: "", label: "Select Category..." },
                          ...categories.map((c) => ({ value: c.id || c._id, label: c.name })),
                        ]}
                      />
                    </div>
                  )}

                  {gstFormType === "product" && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Product</label>
                      <AnimatedSelect
                        value={gstForm.productId}
                        onChange={(e) => setGstForm({ ...gstForm, productId: e.target.value })}
                        options={[
                          { value: "", label: "Select Product..." },
                          ...products.map((p) => ({ value: p.id || p._id, label: p.name })),
                        ]}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                    <textarea
                      value={gstForm.description}
                      onChange={(e) => setGstForm({ ...gstForm, description: e.target.value })}
                      placeholder="Add compliance notes or details..."
                      rows="2"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reason for Change (Audit Log)</label>
                    <input
                      type="text"
                      required
                      value={gstForm.reason}
                      onChange={(e) => setGstForm({ ...gstForm, reason: e.target.value })}
                      placeholder="Reason required for compliance audit logs..."
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                    >
                      Save Rule Configuration
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsGstModalOpen(false)}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-bold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Pricing Rule Modal (Legacy preserved) */}
      <AnimatePresence>
        {editingPricing !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingPricing(null)}
              className="fixed inset-0 bg-black/60 z-[10000] backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4">
                <h3 className="text-lg font-bold text-gray-800">
                  {editingPricing.id ? "Edit Pricing Rule" : "Add Pricing Rule"}
                </h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    await handleSavePricing({
                      name: formData.get("name"),
                      type: formData.get("type"),
                      value: parseFloat(formData.get("value")),
                      minQuantity: formData.get("minQuantity") ? parseInt(formData.get("minQuantity")) : null,
                      applicableTo: formData.get("applicableTo") || null,
                      status: formData.get("status"),
                    });
                  }}
                  className="space-y-4"
                >
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingPricing.name || ""}
                    placeholder="Rule Name"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none text-sm"
                  />
                  <AnimatedSelect
                    name="type"
                    value={editingPricing.type || "discount"}
                    onChange={(e) => setEditingPricing({ ...editingPricing, type: e.target.value })}
                    options={[
                      { value: "discount", label: "Discount" },
                      { value: "markup", label: "Markup" },
                    ]}
                  />
                  <input
                    type="number"
                    name="value"
                    defaultValue={editingPricing.value || ""}
                    placeholder="Value (%)"
                    required
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none text-sm font-mono"
                  />
                  <input
                    type="number"
                    name="minQuantity"
                    defaultValue={editingPricing.minQuantity || ""}
                    placeholder="Min Quantity (optional)"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none text-sm font-mono"
                  />
                  <input
                    type="text"
                    name="applicableTo"
                    defaultValue={editingPricing.applicableTo || ""}
                    placeholder="Applicable To (e.g. vip, retail)"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none text-sm"
                  />
                  <AnimatedSelect
                    name="status"
                    value={editingPricing.status || "active"}
                    onChange={(e) => setEditingPricing({ ...editingPricing, status: e.target.value })}
                    options={[
                      { value: "active", label: "Active" },
                      { value: "inactive", label: "Inactive" },
                    ]}
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-2 bg-primary-600 text-white rounded-lg font-bold">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingPricing(null)} className="flex-1 py-2 bg-gray-200 rounded-lg font-bold">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete / Audit Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, id: null, type: null })}
        onConfirm={handleConfirmDelete}
        title={deleteConfirmModal.type === "gst" ? "Delete GST Compliance Rule?" : "Delete Pricing Rule?"}
        message={
          deleteConfirmModal.type === "gst" ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete this GST Rule? A mandatory audit trail reason must be provided.
              </p>
              <input
                type="text"
                required
                value={ruleReason}
                onChange={(e) => setRuleReason(e.target.value)}
                placeholder="Reason for deletion (mandatory)..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-red-500"
              />
            </div>
          ) : (
            "Are you sure you want to delete this pricing rule? This action cannot be undone."
          )
        }
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        disabled={deleteConfirmModal.type === "gst" && ruleReason.trim().length < 5}
      />
    </motion.div>
  );
};

export default TaxPricing;
