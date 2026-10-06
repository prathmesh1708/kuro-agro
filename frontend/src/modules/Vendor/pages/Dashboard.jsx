import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FiPackage,
  FiShoppingBag,
  FiDollarSign,
  FiTrendingUp,
  FiArrowRight,
} from "react-icons/fi";
import { useVendorAuthStore } from "../store/vendorAuthStore";
import { useVendorProductStore } from "../store/vendorProductStore";
import { getVendorOrders, getVendorEarnings } from "../services/vendorService";
import { formatPrice } from "../../../shared/utils/helpers";
import toast from "react-hot-toast";

const VendorDashboard = () => {
  const navigate = useNavigate();
  const { vendor, updateProfile } = useVendorAuthStore();
  const { products, total: totalProductsCount, fetchProducts } = useVendorProductStore();

  const [gstFile, setGstFile] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [fssaiFile, setFssaiFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReuploadForm, setShowReuploadForm] = useState(false);

  const hasFoodCategory = useMemo(() => {
    return Array.isArray(vendor?.categories) && vendor.categories.some(
      (cat) =>
        String(cat.name || '').toLowerCase() === 'food' ||
        String(cat.slug || '').toLowerCase() === 'food'
    );
  }, [vendor?.categories]);

  const handleReuploadSubmit = async (e) => {
    e.preventDefault();
    if (!gstFile && !panFile && !fssaiFile) {
      toast.error("Please select at least one document to upload");
      return;
    }
    setIsSubmitting(true);
    try {
      const { uploadVendorImage } = await import("../services/vendorService");
      
      let gstCertificate = vendor.gstCertificate;
      let panCardDocument = vendor.panCardDocument;
      let fssaiLicenseDocument = vendor.fssaiLicenseDocument;

      if (gstFile) {
        const gstRes = await uploadVendorImage(gstFile, 'vendors/documents');
        const gstPayload = gstRes?.data ?? gstRes;
        gstCertificate = gstPayload.url || gstPayload;
      }

      if (panFile) {
        const panRes = await uploadVendorImage(panFile, 'vendors/documents');
        const panPayload = panRes?.data ?? panRes;
        panCardDocument = panPayload.url || panPayload;
      }

      if (fssaiFile) {
        const fssaiRes = await uploadVendorImage(fssaiFile, 'vendors/documents');
        const fssaiPayload = fssaiRes?.data ?? fssaiRes;
        fssaiLicenseDocument = fssaiPayload.url || fssaiPayload;
      }

      const updates = {
        gstCertificate,
        panCardDocument,
        fssaiLicenseDocument,
      };

      const res = await updateProfile(updates);
      if (res.success) {
        toast.success("Documents re-uploaded successfully!");
        setGstFile(null);
        setPanFile(null);
        setFssaiFile(null);
        setShowReuploadForm(false);
        useVendorAuthStore.setState({ vendor: res.vendor });
      }
    } catch (err) {
      toast.error(err.message || "Failed to upload documents");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [stats, setStats] = useState({
    totalProducts: 0,
    inStockProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const vendorId = vendor?.id;

  useEffect(() => {
    if (!vendorId) return;

    const syncProfile = async () => {
      try {
        const { getVendorProfile } = await import("../services/vendorService");
        const profileRes = await getVendorProfile();
        const profile = profileRes?.data ?? profileRes;
        if (profile) {
          useVendorAuthStore.setState({ vendor: profile });
        }
      } catch (err) {
        console.warn("Failed to sync vendor profile", err);
      }
    };
    syncProfile();

    if (vendor?.status !== 'approved') {
      return;
    }

    // Load products into the product store (reuse if already fetched)
    if (products.length === 0) {
      fetchProducts();
    }

    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        // Fetch orders and earnings in parallel
        const [ordersRes, earningsRes, pendingRes, processingRes] = await Promise.all([
          getVendorOrders({ page: 1, limit: 5 }),
          getVendorEarnings(),
          getVendorOrders({ page: 1, limit: 1, status: "pending" }),
          getVendorOrders({ page: 1, limit: 1, status: "processing" }),
        ]);

        const ordersData = ordersRes?.data ?? ordersRes;
        const earningsData = earningsRes?.data ?? earningsRes;
        const pendingData = pendingRes?.data ?? pendingRes;
        const processingData = processingRes?.data ?? processingRes;

        const orders = ordersData?.orders ?? [];
        const summary = earningsData?.summary ?? {};
        const pending =
          Number(pendingData?.total || 0) + Number(processingData?.total || 0);

        setStats((prev) => ({
          ...prev,
          totalOrders: ordersData?.total ?? orders.length,
          pendingOrders: pending,
          totalEarnings: summary.totalEarnings ?? 0,
          pendingEarnings: summary.pendingEarnings ?? 0,
        }));

        setRecentOrders(orders);
      } catch {
        // errors handled by api.js toast
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [vendorId, fetchProducts, products.length, vendor?.status]);

  // Sync product counts whenever the product store updates
  useEffect(() => {
    if (vendor?.status !== 'approved') return;
    const inStock = products.filter((p) => p.stock === "in_stock").length;
    setStats((prev) => ({
      ...prev,
      totalProducts: Number(totalProductsCount || 0),
      inStockProducts: inStock,
    }));
  }, [products, totalProductsCount, vendor?.status]);

  const statCards = [
    {
      icon: FiPackage,
      label: "Total Products",
      value: stats.totalProducts,
      color: "bg-blue-500",
      bgColor: "bg-blue-50",
      textColor: "text-blue-700",
      link: "/vendor/products",
    },
    {
      icon: FiShoppingBag,
      label: "Total Orders",
      value: stats.totalOrders,
      color: "bg-green-500",
      bgColor: "bg-green-50",
      textColor: "text-green-700",
      link: "/vendor/orders",
    },
    {
      icon: FiTrendingUp,
      label: "Pending Orders",
      value: stats.pendingOrders,
      color: "bg-orange-500",
      bgColor: "bg-orange-50",
      textColor: "text-orange-700",
      link: "/vendor/orders",
    },
    {
      icon: FiDollarSign,
      label: "Total Earnings",
      value: formatPrice(stats.totalEarnings || 0),
      color: "bg-purple-500",
      bgColor: "bg-purple-50",
      textColor: "text-purple-700",
      link: "/vendor/earnings",
    },
  ];

  const topProducts = useMemo(() => products.slice(0, 5), [products]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="lg:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
            Dashboard
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Welcome back, {vendor?.storeName || vendor?.name}! Here's your store
            overview.
          </p>
        </div>
      </div>

      {/* Bank Details Warning Banner */}
      {vendor && vendor.bankDetails?.status !== 'approved' && (
        <div className={`p-5 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm ${
          vendor.bankDetails?.status === 'pending'
            ? 'bg-blue-50 border-blue-200 text-blue-900'
            : vendor.bankDetails?.status === 'action_required' || vendor.bankDetails?.status === 'rejected'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-orange-50 border-orange-200 text-orange-900'
        }`}>
          <div className="space-y-1">
            <h3 className={`font-bold text-base flex items-center gap-2 ${
              vendor.bankDetails?.status === 'pending'
                ? 'text-blue-800'
                : vendor.bankDetails?.status === 'action_required' || vendor.bankDetails?.status === 'rejected'
                  ? 'text-amber-800'
                  : 'text-orange-800'
            }`}>
              {vendor.bankDetails?.status === 'pending'
                ? '⏳ Bank Details Under Verification'
                : vendor.bankDetails?.status === 'action_required' || vendor.bankDetails?.status === 'rejected'
                  ? '⚠️ Bank Details Action Required'
                  : '⚠️ Payout Setup Required'}
            </h3>
            <p className="text-sm">
              {vendor.bankDetails?.status === 'pending'
                ? 'Your bank details have been submitted and are under review by Admin. Settlements will be processed once verified.'
                : vendor.bankDetails?.status === 'action_required' || vendor.bankDetails?.status === 'rejected'
                  ? `Remarks: ${vendor.bankDetails?.remarks || 'Please update your bank details.'}`
                  : 'Complete your Bank Details to receive payouts. Currently, settlements are placed ON HOLD until details are verified.'}
            </p>
          </div>
          <button
            onClick={() => navigate('/vendor/payment-settlements/bank-details')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl whitespace-nowrap shadow-sm transition-colors text-white ${
              vendor.bankDetails?.status === 'pending'
                ? 'bg-blue-600 hover:bg-blue-700'
                : vendor.bankDetails?.status === 'action_required' || vendor.bankDetails?.status === 'rejected'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-orange-600 hover:bg-orange-700'
            }`}>
            {vendor.bankDetails?.status === 'pending'
              ? 'View Details'
              : vendor.bankDetails?.status === 'action_required' || vendor.bankDetails?.status === 'rejected'
                ? 'Update Details'
                : 'Complete Now'}
          </button>
        </div>
      )}

      {/* Verification Status Banner */}
      {vendor && vendor.status !== 'approved' && (
        <div className="space-y-4">
          <div className={`p-5 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
            vendor.status === 'pending'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : vendor.status === 'action_required'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="space-y-1">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span className="capitalize">{vendor.status === 'action_required' ? 'action required' : vendor.status}</span> Verification Status
              </h3>
              {vendor.status === 'pending' && (
                <p className="text-sm opacity-90">
                  Your business documents are pending administrator review. Once verified, you will be able to manage your store catalog and receive orders.
                </p>
              )}
              {vendor.status === 'action_required' && (
                <p className="text-sm opacity-90">
                  Remarks from Admin: <strong>{vendor.verificationTimeline?.[vendor.verificationTimeline.length - 1]?.remarks || 'See details below.'}</strong>
                </p>
              )}
              {vendor.status === 'rejected' && (
                <p className="text-sm opacity-90">
                  Remarks from Admin: <strong>{vendor.suspensionReason || 'Please contact support.'}</strong>
                </p>
              )}
            </div>
            {vendor.status !== 'pending' && (
              <button
                onClick={() => setShowReuploadForm(!showReuploadForm)}
                className={`px-4 py-2 text-sm font-semibold rounded-xl whitespace-nowrap shadow-sm transition-colors ${
                  vendor.status === 'action_required'
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-red-650 text-white hover:bg-red-755'
                }`}>
                {showReuploadForm ? "Cancel upload" : "Re-upload Documents"}
              </button>
            )}
          </div>

          {showReuploadForm && vendor.status !== 'pending' && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="font-bold text-gray-800 text-sm">Re-upload Verification Documents</h4>
              <form onSubmit={handleReuploadSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vendor.businessType === 'gst' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">GST Certificate File</label>
                      <input
                        type="file"
                        onChange={(e) => setGstFile(e.target.files?.[0] || null)}
                        accept=".pdf,image/*"
                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">PAN Card Document</label>
                    <input
                      type="file"
                      onChange={(e) => setPanFile(e.target.files?.[0] || null)}
                      accept=".pdf,image/*"
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  {hasFoodCategory && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">FSSAI License Document</label>
                      <input
                        type="file"
                        onChange={(e) => setFssaiFile(e.target.files?.[0] || null)}
                        accept=".pdf,image/*"
                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-primary-600 text-white font-semibold rounded-xl text-sm hover:bg-primary-700 transition-colors disabled:opacity-50">
                    {isSubmitting ? "Uploading..." : "Submit Documents"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {vendor?.status !== 'approved' && vendor?.verificationTimeline && vendor?.verificationTimeline.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-4">
          <h2 className="text-lg font-bold text-gray-800">Verification Timeline</h2>
          <div className="relative border-l border-gray-200 ml-4 space-y-6">
            {vendor.verificationTimeline.slice().reverse().map((timeline, idx) => (
              <div key={idx} className="relative pl-6 mb-6">
                <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-8 ring-white">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    timeline.status === 'approved' ? 'bg-green-600' :
                    timeline.status === 'pending' ? 'bg-blue-600' :
                    timeline.status === 'action_required' ? 'bg-amber-600' : 'bg-red-650 bg-red-600'
                  }`}></span>
                </span>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-150">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1 gap-1">
                    <span className="text-sm font-semibold text-gray-800 capitalize">
                      {timeline.status === 'action_required' ? 'Action Required' : timeline.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(timeline.updatedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {timeline.remarks}
                  </p>
                  <p className="text-xs text-gray-400">
                    Updated by: <span className="font-semibold">{timeline.updatedByName}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {vendor?.status === 'approved' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => stat.link && navigate(stat.link)}
                className={`${stat.bgColor} rounded-xl p-4 cursor-pointer hover:shadow-lg transition-shadow`}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <stat.icon className="text-white text-xl" />
                  </div>
                  <FiArrowRight className={`${stat.textColor} text-lg`} />
                </div>
                <h3 className={`${stat.textColor} text-sm font-medium mb-1`}>
                  {stat.label}
                </h3>
                <p className={`${stat.textColor} text-2xl font-bold`}>
                  {isLoading ? "—" : stat.value}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions & Profile Completion Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <div className="lg:col-span-2 bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => navigate("/vendor/products/add-product")}
                  className="flex items-center gap-3 p-4 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors text-left w-full">
                  <div className="bg-primary-500 p-2 rounded-lg flex-shrink-0">
                    <FiPackage className="text-white text-xl" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm sm:text-base">Add New Product</h3>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Create a new product listing
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/vendor/orders")}
                  className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left w-full">
                  <div className="bg-green-500 p-2 rounded-lg flex-shrink-0">
                    <FiShoppingBag className="text-white text-xl" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm sm:text-base">View Orders</h3>
                    <p className="text-xs sm:text-sm text-gray-600">Manage your orders</p>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/vendor/earnings")}
                  className="flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-left w-full">
                  <div className="bg-purple-500 p-2 rounded-lg flex-shrink-0">
                    <FiDollarSign className="text-white text-xl" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm sm:text-base">View Earnings</h3>
                    <p className="text-xs sm:text-sm text-gray-600">Check your earnings</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Profile Completion */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-4">Profile Completion</h2>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-full border-4 border-purple-500 flex items-center justify-center font-bold text-purple-700 text-lg flex-shrink-0">
                    {['approved', 'pending'].includes(vendor?.bankDetails?.status) ? 100 : 80}%
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">
                    {vendor?.bankDetails?.status === 'approved'
                      ? "Your profile is 100% complete. Payouts are fully active!"
                      : vendor?.bankDetails?.status === 'pending'
                        ? "Profile 100% submitted! Bank details are under admin verification."
                        : "Complete bank verification to activate payouts."}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Personal Details</span>
                    <span className="text-green-600 font-bold">✔</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Shop Details</span>
                    <span className="text-green-600 font-bold">✔</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Business Details</span>
                    <span className="text-green-600 font-bold">✔</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Bank Details</span>
                    {vendor?.bankDetails?.status === 'approved' ? (
                      <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-0.5 rounded border border-green-200">✔ Verified</span>
                    ) : vendor?.bankDetails?.status === 'pending' ? (
                      <span className="text-blue-700 font-bold text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-200">⏳ Pending Review</span>
                    ) : vendor?.bankDetails?.status === 'action_required' || vendor?.bankDetails?.status === 'rejected' ? (
                      <span className="text-amber-700 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded border border-amber-200">⚠️ Needs Action</span>
                    ) : (
                      <span className="text-red-500 font-bold text-xs bg-red-50 px-2 py-0.5 rounded border border-red-200">❌ Not Submitted</span>
                    )}
                  </div>
                </div>
              </div>
              {vendor?.bankDetails?.status !== 'approved' && (
                <button
                  onClick={() => navigate('/vendor/payment-settlements/bank-details')}
                  className={`w-full mt-5 py-2 text-sm font-semibold rounded-xl text-white transition-colors ${
                    vendor?.bankDetails?.status === 'pending'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}>
                  {vendor?.bankDetails?.status === 'pending'
                    ? 'View Bank Details'
                    : vendor?.bankDetails?.status === 'action_required' || vendor?.bankDetails?.status === 'rejected'
                      ? 'Update Bank Details'
                      : 'Add Bank Details'}
                </button>
              )}
            </div>
          </div>

          {/* Recent Orders & Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Recent Orders</h2>
                <button
                  onClick={() => navigate("/vendor/orders")}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  View All
                </button>
              </div>
              {isLoading ? (
                <p className="text-gray-400 text-center py-8">Loading orders...</p>
              ) : recentOrders.length > 0 ? (
                <div className="space-y-3">
                  {recentOrders.map((order) => {
                    const vendorItem = order.vendorItems?.find(
                      (vi) => vi.vendorId?.toString() === vendorId?.toString()
                    );
                    const displayStatus = vendorItem?.status ?? order.status;
                    const displayAmount =
                      vendorItem?.subtotal ?? order.totalAmount ?? order.total ?? 0;

                    return (
                      <div
                        key={order._id ?? order.orderId}
                        onClick={() =>
                          navigate(`/vendor/orders/${order.orderId ?? order._id}`)
                        }
                        className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                        <div>
                          <p className="font-semibold text-gray-800">
                            {order.orderId ?? order._id}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-800">
                            {formatPrice(displayAmount)}
                          </p>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${displayStatus === "delivered"
                              ? "bg-green-100 text-green-700"
                              : displayStatus === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                            {displayStatus}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No orders yet</p>
              )}
            </div>

            {/* Top Products */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Your Products</h2>
                <button
                  onClick={() => navigate("/vendor/products")}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  View All
                </button>
              </div>
              {topProducts.length > 0 ? (
                <div className="space-y-3">
                  {topProducts.map((product) => (
                    <div
                      key={product._id ?? product.id}
                      onClick={() =>
                        navigate(`/vendor/products/${product._id ?? product.id}`)
                      }
                      className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                      <img
                        src={product.image || product.images?.[0]}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded-lg"
                        onError={(e) => {
                          e.target.src =
                            "https://via.placeholder.com/48x48?text=P";
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">
                          {product.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatPrice(product.price || 0)}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${product.stock === "in_stock"
                          ? "bg-green-100 text-green-700"
                          : product.stock === "low_stock"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                        {product.stock === "in_stock"
                          ? "In Stock"
                          : product.stock === "low_stock"
                            ? "Low Stock"
                            : "Out of Stock"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No products yet</p>
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default VendorDashboard;
