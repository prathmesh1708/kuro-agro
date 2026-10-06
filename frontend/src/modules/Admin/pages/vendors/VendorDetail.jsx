import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiMail,
  FiPhone,
  FiMapPin,
  FiShoppingBag,
  FiDollarSign,
  FiClock,
  FiEdit,
  FiPackage,
  FiCheckCircle,
  FiXCircle,
  FiTrendingUp,
  FiUser,
  FiFileText,
  FiShield,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useVendorStore } from "../../store/vendorStore";
import { getAllOrders, getVendorCommissions } from "../../services/adminService";
import Badge from "../../../../shared/components/Badge";
import DataTable from "../../components/DataTable";
import { formatPrice } from "../../../../shared/utils/helpers";
// import { formatDateTime } from '../../../utils/adminHelpers';
import toast from "react-hot-toast";

const VendorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getVendor, updateVendorStatus, updateCommissionRate, updateVendorVerification } =
    useVendorStore();

  const [vendor, setVendor] = useState(null);
  const [vendorOrders, setVendorOrders] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [earningsSummary, setEarningsSummary] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditingCommission, setIsEditingCommission] = useState(false);
  const [commissionRate, setCommissionRate] = useState("");
  
  const [isEditingVerification, setIsEditingVerification] = useState(false);
  const [verificationForm, setVerificationForm] = useState({
    businessType: "non-gst",
    legalBusinessName: "",
    gstin: "",
    panNumber: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "India",
  });
  const [gstFile, setGstFile] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);

  const openEditVerification = () => {
    setVerificationForm({
      businessType: vendor.businessType || "non-gst",
      legalBusinessName: vendor.legalBusinessName || "",
      gstin: vendor.gstin || "",
      panNumber: vendor.panNumber || "",
      street: vendor.businessAddress?.street || "",
      city: vendor.businessAddress?.city || "",
      state: vendor.businessAddress?.state || "",
      zipCode: vendor.businessAddress?.zipCode || "",
      country: vendor.businessAddress?.country || "India",
    });
    setGstFile(null);
    setPanFile(null);
    setIsEditingVerification(true);
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingVerification(true);
    try {
      const formData = new FormData();
      formData.append("businessType", verificationForm.businessType);
      formData.append("panNumber", verificationForm.panNumber);
      
      if (verificationForm.businessType === "gst") {
        formData.append("legalBusinessName", verificationForm.legalBusinessName);
        formData.append("gstin", verificationForm.gstin);
        formData.append("businessAddress", JSON.stringify({
          street: verificationForm.street,
          city: verificationForm.city,
          state: verificationForm.state,
          zipCode: verificationForm.zipCode,
          country: verificationForm.country,
        }));
      }

      if (gstFile) {
        formData.append("gstCertificate", gstFile);
      }
      if (panFile) {
        formData.append("panCardDocument", panFile);
      }

      const success = await updateVendorVerification(vendor.id, formData);
      if (success) {
        toast.success("Verification details updated successfully");
        setIsEditingVerification(false);
        const data = await getVendor(id);
        if (data) {
          setVendor(data);
          setCommissionRate(((data.commissionRate || 0) * 100).toFixed(1));
        }
      } else {
        toast.error("Failed to update verification details");
      }
    } catch (err) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  const isSameVendorId = (a, b) => String(a) === String(b);

  useEffect(() => {
    const fetchVendorData = async () => {
      // 1. Fetch Vendor Details
      const data = await getVendor(id);
      if (data) {
        setVendor(data);
        setCommissionRate(((data.commissionRate || 0) * 100).toFixed(1));

        // 2. Fetch Vendor Orders (all pages)
        try {
          const fetchedOrders = [];
          let page = 1;
          let pages = 1;
          do {
            const ordersResponse = await getAllOrders({
              vendorId: id,
              page,
              limit: 200,
            });
            const payload = ordersResponse?.data ?? ordersResponse;
            const orderPage = Array.isArray(payload?.orders) ? payload.orders : [];
            fetchedOrders.push(...orderPage);
            pages = Math.max(Number(payload?.pages) || 1, 1);
            page += 1;
          } while (page <= pages);

          const normalizedOrders = fetchedOrders.map((order) => ({
            ...order,
            id: order.orderId || order._id,
            date: order.date || order.createdAt,
          }));
          setVendorOrders(normalizedOrders);
        } catch (error) {
          console.error("Failed to fetch vendor orders:", error);
          toast.error("Failed to load vendor orders");
        }

        // 3. Fetch vendor commissions for commissions tab + earnings summary
        try {
          const fetchedCommissions = [];
          let page = 1;
          let pages = 1;
          do {
            const response = await getVendorCommissions(id, { page, limit: 200 });
            const payload = response?.data ?? response;
            const pageCommissions = Array.isArray(payload?.commissions)
              ? payload.commissions
              : [];
            fetchedCommissions.push(...pageCommissions);
            pages = Math.max(Number(payload?.pages) || 1, 1);
            page += 1;
          } while (page <= pages);
          setCommissions(fetchedCommissions);
        } catch {
          setCommissions([]);
        }
      } else {
        toast.error("Vendor not found");
        navigate("/admin/vendors");
      }
    };
    fetchVendorData();
  }, [id, getVendor, navigate]);

  useEffect(() => {
    if (!vendor) return;

    const summary = commissions.reduce(
      (acc, row) => {
        const earnings = Number(row.vendorEarnings || 0);
        acc.totalEarnings += earnings;
        if (row.status === "pending") acc.pendingEarnings += earnings;
        return acc;
      },
      { totalEarnings: 0, pendingEarnings: 0 }
    );

    setEarningsSummary(summary);
  }, [vendor, commissions]);

  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    status: null,
  });
  const [statusReason, setStatusReason] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);

  const handleStatusUpdate = async (newStatus, reason = "") => {
    const success = await updateVendorStatus(vendor.id, newStatus, reason);
    if (success) {
      toast.success(`Vendor status updated to ${newStatus}`);
      const data = await getVendor(id);
      if (data) {
        setVendor(data);
        setCommissionRate(((data.commissionRate || 0) * 100).toFixed(1));
      }
    } else {
      toast.error("Failed to update vendor status");
    }
  };

  const handleStatusSubmit = async () => {
    const { status } = statusModal;
    if ((status === "rejected" || status === "action_required" || status === "suspended") && !statusReason.trim()) {
      toast.error("A reason / remark is mandatory");
      return;
    }
    await handleStatusUpdate(status, statusReason.trim());
    setStatusModal({ isOpen: false, status: null });
    setStatusReason("");
  };

  const handleCommissionUpdate = async () => {
    const rate = parseFloat(commissionRate) / 100;
    if (isNaN(rate) || rate < 0 || rate > 1) {
      toast.error("Please enter a valid commission rate (0-100%)");
      return;
    }
    const success = await updateCommissionRate(vendor.id, rate);
    if (success) {
      setVendor({ ...vendor, commissionRate: rate });
      setIsEditingCommission(false);
      toast.success("Commission rate updated successfully");
    } else {
      toast.error("Failed to update commission rate");
    }
  };

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const orderColumns = [
    {
      key: "id",
      label: "Order ID",
      sortable: true,
    },
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <Badge
          variant={
            value === "delivered"
              ? "success"
              : value === "pending"
                ? "warning"
                : value === "cancelled" || value === "canceled"
                  ? "error"
                  : "info"
          }>
          {value?.toUpperCase() || "N/A"}
        </Badge>
      ),
    },
    {
      key: "total",
      label: "Amount",
      sortable: true,
      render: (_, row) => {
        const vendorItem = row.vendorItems?.find(
          (vi) => isSameVendorId(vi.vendorId, vendor.id)
        );
        return formatPrice(vendorItem?.subtotal || 0);
      },
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <button
          onClick={() => navigate(`/admin/orders/${row.id}`)}
          className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
          View
        </button>
      ),
    },
  ];

  const commissionColumns = [
    {
      key: "orderId",
      label: "Order ID",
      sortable: true,
    },
    {
      key: "createdAt",
      label: "Date",
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: "subtotal",
      label: "Subtotal",
      sortable: true,
      render: (value) => formatPrice(value),
    },
    {
      key: "commission",
      label: "Commission",
      sortable: true,
      render: (value) => (
        <span className="text-red-600">-{formatPrice(value)}</span>
      ),
    },
    {
      key: "vendorEarnings",
      label: "Vendor Earnings",
      sortable: true,
      render: (value) => (
        <span className="text-green-600">{formatPrice(value)}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <Badge
          variant={
            value === "paid"
              ? "success"
              : value === "pending"
                ? "warning"
                : "error"
          }>
          {value?.toUpperCase()}
        </Badge>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <FiArrowLeft className="text-lg text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              {vendor.storeName || vendor.name}
            </h1>
            <p className="text-xs text-gray-500">Vendor ID: {vendor.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={
              vendor.status === "approved"
                ? "success"
                : vendor.status === "pending"
                  ? "warning"
                  : vendor.status === "action_required"
                    ? "info"
                    : "error"
            }>
            {vendor.status === "action_required" ? "ACTION REQUIRED" : vendor.status?.toUpperCase()}
          </Badge>
          {(vendor.status === "pending" || vendor.status === "action_required") && (
            <>
              <button
                onClick={() => setStatusModal({ isOpen: true, status: "approved" })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold">
                <FiCheckCircle />
                Approve
              </button>
              <button
                onClick={() => setStatusModal({ isOpen: true, status: "rejected" })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold">
                <FiXCircle />
                Reject
              </button>
              <button
                onClick={() => setStatusModal({ isOpen: true, status: "action_required" })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-semibold">
                <FiClock />
                Request Re-upload
              </button>
            </>
          )}
          {vendor.status === "approved" && (
            <button
              onClick={() => setStatusModal({ isOpen: true, status: "suspended" })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-650 text-white rounded-lg hover:bg-red-755 transition-colors text-sm font-semibold">
              <FiXCircle />
              Suspend
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {["overview", "orders", "commissions", "timeline", "settings"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold text-sm transition-colors whitespace-nowrap ${activeTab === tab
                ? "text-primary-600 border-b-2 border-primary-600"
                : "text-gray-600 hover:text-gray-800"
                }`}>
              {tab === "timeline" ? "Verification History" : (tab.charAt(0).toUpperCase() + tab.slice(1))}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Vendor Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-4">
                    Vendor Information
                  </h2>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <FiUser className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-600">Name</p>
                        <p className="font-semibold text-gray-800">
                          {vendor.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <FiMail className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-600">Email</p>
                        <p className="font-semibold text-gray-800">
                          {vendor.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <FiPhone className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-600">Phone</p>
                        <p className="font-semibold text-gray-800">
                          {vendor.phone || "N/A"}
                        </p>
                      </div>
                    </div>
                    {vendor.address && (
                      <div className="flex items-start gap-3">
                        <FiMapPin className="text-gray-400 mt-1" />
                        <div>
                          <p className="text-xs text-gray-600">Address</p>
                          <p className="font-semibold text-gray-800">
                            {vendor.address.street || ""}
                            {vendor.address.city && `, ${vendor.address.city}`}
                            {vendor.address.state &&
                              `, ${vendor.address.state}`}
                            {vendor.address.zipCode &&
                              ` ${vendor.address.zipCode}`}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <FiClock className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-600">Join Date</p>
                        <p className="font-semibold text-gray-800">
                          {new Date(vendor.joinDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {vendor.categories && vendor.categories.length > 0 && (
                      <div className="flex items-start gap-3 pt-2">
                        <FiFileText className="text-gray-400 mt-1" />
                        <div>
                          <p className="text-xs text-gray-650">Product Categories</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {vendor.categories.map((cat) => (
                              <span key={cat._id || cat.id} className="px-2.5 py-1 bg-primary-50 border border-primary-100 text-primary-700 rounded-lg text-xs font-semibold">
                                {cat.name || cat}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {vendor.fssaiLicenseNumber && (
                      <div className="flex items-start gap-3 pt-3 mt-3 border-t border-gray-100">
                        <FiFileText className="text-gray-400 mt-1" />
                        <div>
                          <p className="text-xs text-gray-650">FSSAI License Number</p>
                          <p className="font-bold text-gray-800 mt-0.5">{vendor.fssaiLicenseNumber}</p>
                          {vendor.fssaiLicenseDocument && (
                            <div className="flex gap-3 mt-1.5">
                              <button
                                onClick={() => setPreviewDoc({ url: vendor.fssaiLicenseDocument, name: "FSSAI License Document" })}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                                Preview FSSAI &rarr;
                              </button>
                              <a
                                href={vendor.fssaiLicenseDocument}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-green-600 hover:text-green-700 hover:underline">
                                Download
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Business Verification Details */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800">
                      Business Verification Details
                    </h2>
                    <button
                      onClick={openEditVerification}
                      className="flex items-center gap-1 px-2.5 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                    >
                      <FiEdit className="text-xs" />
                      Edit Details
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <FiFileText className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-600">Business Type</p>
                        <p className="font-semibold text-gray-800 uppercase">
                          {vendor.businessType || "non-gst"}
                        </p>
                      </div>
                    </div>
                    {vendor.businessType === "gst" && (
                      <>
                        <div className="flex items-start gap-3">
                          <FiUser className="text-gray-400 mt-1" />
                          <div>
                            <p className="text-xs text-gray-600">Legal Business Name</p>
                            <p className="font-semibold text-gray-800">
                              {vendor.legalBusinessName || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <FiFileText className="text-gray-400 mt-1" />
                          <div>
                            <p className="text-xs text-gray-600">GSTIN</p>
                            <p className="font-bold text-gray-800">
                              {vendor.gstin || "N/A"}
                            </p>
                          </div>
                        </div>
                        {vendor.gstCertificate && (
                          <div className="flex items-start gap-3">
                            <FiFileText className="text-gray-400 mt-1" />
                            <div>
                              <p className="text-xs text-gray-600">GST Certificate</p>
                              <div className="flex gap-3 mt-1">
                                <button
                                  onClick={() => setPreviewDoc({ url: vendor.gstCertificate, name: "GST Certificate" })}
                                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                                  Preview GST &rarr;
                                </button>
                                <a
                                  href={vendor.gstCertificate}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-semibold text-green-600 hover:text-green-700 hover:underline">
                                  Download
                                </a>
                              </div>
                            </div>
                          </div>
                        )}
                        {vendor.businessAddress && (
                          <div className="flex items-start gap-3">
                            <FiMapPin className="text-gray-400 mt-1" />
                            <div>
                              <p className="text-xs text-gray-600">GST Registered Address</p>
                              <p className="font-semibold text-gray-800">
                                {vendor.businessAddress.street || ""}
                                {vendor.businessAddress.city && `, ${vendor.businessAddress.city}`}
                                {vendor.businessAddress.state && `, ${vendor.businessAddress.state}`}
                                {vendor.businessAddress.zipCode && ` ${vendor.businessAddress.zipCode}`}
                                {vendor.businessAddress.country && `, ${vendor.businessAddress.country}`}
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex items-start gap-3">
                      <FiFileText className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-600">PAN Number</p>
                        <p className="font-bold text-gray-800">
                          {vendor.panNumber || "N/A"}
                        </p>
                      </div>
                    </div>
                    {vendor.panCardDocument && (
                      <div className="flex items-start gap-3">
                        <FiFileText className="text-gray-400 mt-1" />
                        <div>
                          <p className="text-xs text-gray-600">PAN Card Document</p>
                          <div className="flex gap-3 mt-1">
                            <button
                              onClick={() => setPreviewDoc({ url: vendor.panCardDocument, name: "PAN Card Document" })}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                              Preview PAN &rarr;
                            </button>
                            <a
                              href={vendor.panCardDocument}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-green-600 hover:text-green-700 hover:underline">
                              Download
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Performance Stats */}
              <div className="pt-6 border-t border-gray-150">
                <h2 className="text-lg font-bold text-gray-800 mb-4">
                  Performance
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-xs text-blue-600 mb-1">Total Orders</p>
                    <p className="text-2xl font-bold text-blue-800">
                      {vendorOrders.length}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-xs text-green-600 mb-1">
                      Total Earnings
                    </p>
                    <p className="text-2xl font-bold text-green-800">
                      {earningsSummary
                        ? formatPrice(earningsSummary.totalEarnings)
                        : formatPrice(0)}
                    </p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <p className="text-xs text-yellow-600 mb-1">
                      Pending Earnings
                    </p>
                    <p className="text-2xl font-bold text-yellow-800">
                      {earningsSummary
                        ? formatPrice(earningsSummary.pendingEarnings)
                        : formatPrice(0)}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-xs text-purple-600 mb-1">
                      Commission Rate
                    </p>
                    <p className="text-2xl font-bold text-purple-800">
                      {((vendor.commissionRate || 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === "orders" && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Vendor Orders
              </h2>
              {vendorOrders.length > 0 ? (
                <DataTable
                  data={vendorOrders}
                  columns={orderColumns}
                  pagination={true}
                  itemsPerPage={10}
                />
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No orders found
                </p>
              )}
            </div>
          )}

          {/* Commissions Tab */}
          {activeTab === "commissions" && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Commission History
              </h2>
              {commissions.length > 0 ? (
                <DataTable
                  data={commissions}
                  columns={commissionColumns}
                  pagination={true}
                  itemsPerPage={10}
                />
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No commission records found
                </p>
              )}
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === "timeline" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-4">
                  Verification Timeline
                </h2>
                {vendor.verificationTimeline && vendor.verificationTimeline.length > 0 ? (
                  <div className="relative border-l border-gray-200 ml-3 space-y-6">
                    {vendor.verificationTimeline.map((item, idx) => (
                      <div key={idx} className="mb-6 ml-6">
                        <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full ring-8 ring-white">
                          <FiClock className="text-blue-600 text-xs" />
                        </span>
                        <h3 className="flex items-center mb-1 text-sm font-semibold text-gray-800">
                          Status: <span className="uppercase ml-1 text-primary-600 font-bold">{item.status}</span>
                        </h3>
                        <time className="block mb-2 text-xs font-normal leading-none text-gray-400">
                          {new Date(item.updatedAt).toLocaleString()} by {item.updatedByName || "System"}
                        </time>
                        <p className="text-sm font-normal text-gray-600">
                          {item.remarks || "No remarks provided."}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No timeline events recorded yet.</p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">
                  Verification Audit Log
                </h2>
                {vendor.verificationAuditLog && vendor.verificationAuditLog.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th className="px-4 py-3">Action</th>
                          <th className="px-4 py-3">Details</th>
                          <th className="px-4 py-3">Performed By</th>
                          <th className="px-4 py-3">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendor.verificationAuditLog.map((log, idx) => (
                          <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                            <td className="px-4 py-3 font-semibold text-gray-800">{log.action}</td>
                            <td className="px-4 py-3">{log.details}</td>
                            <td className="px-4 py-3">
                              {log.performedBy?.name} ({log.performedBy?.role})
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500">No audit log records found.</p>
                )}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-4">
                  Commission Rate
                </h2>
                <div className="flex items-center gap-4">
                  {isEditingCommission ? (
                    <>
                      <input
                        type="number"
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(e.target.value)}
                        min="0"
                        max="100"
                        step="0.1"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-32"
                        placeholder="10.0"
                      />
                      <button
                        onClick={handleCommissionUpdate}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingCommission(false);
                          setCommissionRate(
                            ((vendor.commissionRate || 0) * 100).toFixed(1)
                          );
                        }}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-gray-800">
                        {((vendor.commissionRate || 0) * 100).toFixed(1)}%
                      </p>
                      <button
                        onClick={() => setIsEditingCommission(true)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2">
                        <FiEdit />
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{previewDoc.name}</h3>
              <div className="flex gap-2">
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center">
                  Open in New Tab
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="text-gray-500 hover:text-gray-800 font-bold px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 p-4">
              {previewDoc.url.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.name}
                  className="w-full h-full border-0 rounded-xl"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center overflow-auto">
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.name}
                    className="max-w-full max-h-full object-contain rounded-xl shadow"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verification Action Modal */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 capitalize">
              {statusModal.status === "approved" ? "Approve Seller?" : statusModal.status === "action_required" ? "Request Document Re-upload?" : `${statusModal.status} Seller?`}
            </h3>
            <p className="text-sm text-gray-650 mb-4">
              {statusModal.status === "approved"
                ? "Are you sure you want to approve this seller? They will be allowed to start listing and selling products immediately."
                : statusModal.status === "action_required"
                  ? "Specify what corrections or documents need to be re-uploaded. The seller will see these remarks on their dashboard."
                  : "Provide a reason/remarks for rejecting this seller application."}
            </p>
            {(statusModal.status === "rejected" || statusModal.status === "action_required" || statusModal.status === "suspended") && (
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Remarks / Reason <span className="text-red-500">*</span></label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Please upload a clearer copy of the GST Certificate."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  required
                />
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setStatusModal({ isOpen: false, status: null });
                  setStatusReason("");
                }}
                className="px-4 py-2 border border-gray-300 text-gray-650 rounded-xl hover:bg-gray-50 transition-colors text-sm font-semibold">
                Cancel
              </button>
              <button
                onClick={handleStatusSubmit}
                className={`px-4 py-2 text-white rounded-xl transition-colors text-sm font-semibold ${
                  statusModal.status === "approved"
                    ? "bg-green-600 hover:bg-green-700"
                    : statusModal.status === "action_required"
                      ? "bg-amber-500 hover:bg-amber-600"
                      : "bg-red-650 hover:bg-red-755"
                }`}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Verification Details Modal */}
      {isEditingVerification && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl p-6 my-8 max-h-[90vh] flex flex-col">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-3 flex items-center gap-2">
              <FiShield className="text-primary-600" />
              Edit Business Verification Details
            </h3>
            
            <form onSubmit={handleVerificationSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4 text-left">
              {/* Business Type selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Business Verification Type <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100">
                    <input
                      type="radio"
                      name="businessType"
                      value="non-gst"
                      checked={verificationForm.businessType === 'non-gst'}
                      onChange={(e) => setVerificationForm({ ...verificationForm, businessType: e.target.value })}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    Non-GST Registered
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100">
                    <input
                      type="radio"
                      name="businessType"
                      value="gst"
                      checked={verificationForm.businessType === 'gst'}
                      onChange={(e) => setVerificationForm({ ...verificationForm, businessType: e.target.value })}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    GST Registered
                  </label>
                </div>
              </div>

              {/* GST Details */}
              {verificationForm.businessType === 'gst' && (
                <div className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-200">
                  <h4 className="font-semibold text-gray-800 text-sm">GST Certification Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Legal Business Name *</label>
                      <input
                        type="text"
                        value={verificationForm.legalBusinessName}
                        onChange={(e) => setVerificationForm({ ...verificationForm, legalBusinessName: e.target.value })}
                        placeholder="Legal Business Name"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-gray-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">GSTIN *</label>
                      <input
                        type="text"
                        value={verificationForm.gstin}
                        onChange={(e) => setVerificationForm({ ...verificationForm, gstin: e.target.value })}
                        placeholder="GSTIN"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-gray-800"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      GST Certificate File {vendor.gstCertificate && "(Keep empty to keep current)"}
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setGstFile(e.target.files?.[0] || null)}
                      accept=".pdf,image/*"
                      className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  <div className="border-t border-gray-200/60 pt-3 space-y-3">
                    <h5 className="font-semibold text-gray-800 text-xs">GST Registered Address</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-700 mb-1">Street Address</label>
                        <input
                          type="text"
                          value={verificationForm.street}
                          onChange={(e) => setVerificationForm({ ...verificationForm, street: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-705 mb-1">City</label>
                        <input
                          type="text"
                          value={verificationForm.city}
                          onChange={(e) => setVerificationForm({ ...verificationForm, city: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-705 mb-1">State</label>
                        <input
                          type="text"
                          value={verificationForm.state}
                          onChange={(e) => setVerificationForm({ ...verificationForm, state: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-705 mb-1">Zip Code</label>
                        <input
                          type="text"
                          value={verificationForm.zipCode}
                          onChange={(e) => setVerificationForm({ ...verificationForm, zipCode: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-gray-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PAN Details */}
              <div className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-200">
                <h4 className="font-semibold text-gray-800 text-sm">PAN Card Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">PAN Number *</label>
                    <input
                      type="text"
                      value={verificationForm.panNumber}
                      onChange={(e) => setVerificationForm({ ...verificationForm, panNumber: e.target.value })}
                      placeholder="PAN Number"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-gray-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      PAN Card Document {vendor.panCardDocument && "(Keep empty to keep current)"}
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setPanFile(e.target.files?.[0] || null)}
                      accept=".pdf,image/*"
                      className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-105">
                <button
                  type="button"
                  onClick={() => setIsEditingVerification(false)}
                  disabled={isSubmittingVerification}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-semibold disabled:opacity-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVerification}
                  className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors text-sm font-semibold disabled:opacity-50">
                  {isSubmittingVerification ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default VendorDetail;
