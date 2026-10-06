import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiEdit,
  FiCheck,
  FiX,
  FiPhone,
  FiMapPin,
  FiTruck,
  FiCalendar,
  FiTag,
  FiPackage,
  FiClock,
  FiMail,
  FiDownload,
  FiFileText,
  FiRefreshCw,
  FiXCircle,
  FiCheckCircle
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import Badge from '../../../shared/components/Badge';
import AnimatedSelect from '../components/AnimatedSelect';
import { formatCurrency, formatDateTime } from '../utils/adminHelpers';
import {
  getOrderById,
  updateOrderStatus,
  getAdminOrderShipment,
  getAdminOrderTracking,
  getAdminOrderLabel,
  getAdminOrderManifest,
  getAdminOrderInvoice,
  cancelAdminOrderShipment
} from '../services/adminService';
import toast from 'react-hot-toast';

const AdminOrderDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Document & tracking modal states
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState(null);

  const fetchOrderData = async () => {
    setIsLoading(true);
    try {
      const response = await getOrderById(id);
      const o = response.data;

      const normalizedOrder = {
        ...o,
        id: o.orderId || o._id,
        customer: {
          name: o.userId?.name || 'Unknown',
          email: o.userId?.email || '',
          phone: o.userId?.phone || ''
        },
        date: o.createdAt
      };

      setOrder(normalizedOrder);
      setStatus(o.status);

      // Fetch stored shipment details if present
      try {
        const shipmentRes = await getAdminOrderShipment(id);
        const payload = shipmentRes?.data ?? shipmentRes;
        if (payload?.shipment) setShipment(payload.shipment);
      } catch {
        // No third-party shipment record yet
      }
    } catch (error) {
      console.error("Fetch order detail error:", error);
      toast.error('Order not found');
      navigate('/admin/orders/all-orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderData();
  }, [id]);

  const handleStatusUpdate = async () => {
    try {
      await updateOrderStatus(id, status);
      setOrder({ ...order, status });
      setIsEditing(false);
      toast.success('Order status updated successfully');
    } catch (error) {
      console.error("Status update error:", error);
    }
  };

  const handleViewTracking = async () => {
    setShowTrackingModal(true);
    setLoadingTracking(true);
    try {
      const res = await getAdminOrderTracking(order.id);
      const payload = res?.data ?? res;
      setTrackingData(payload.liveTracking || payload.shipment);
    } catch {
      toast.error('Could not load live tracking information.');
    } finally {
      setLoadingTracking(false);
    }
  };

  const handleDownloadLabel = async () => {
    setDownloadingDoc('label');
    try {
      const res = await getAdminOrderLabel(order.id);
      const labelUrl = res?.data?.labelUrl || res?.labelUrl;
      if (labelUrl) window.open(labelUrl, '_blank');
      else toast.error('Label URL not available.');
    } catch {
      toast.error('Failed to fetch shipping label.');
    } finally {
      setDownloadingDoc(null);
    }
  };

  const handleDownloadManifest = async () => {
    setDownloadingDoc('manifest');
    try {
      const res = await getAdminOrderManifest(order.id);
      const manifestUrl = res?.data?.manifestUrl || res?.manifestUrl;
      if (manifestUrl) window.open(manifestUrl, '_blank');
      else toast.error('Manifest URL not available.');
    } catch {
      toast.error('Failed to fetch manifest.');
    } finally {
      setDownloadingDoc(null);
    }
  };

  const handleDownloadInvoice = async () => {
    setDownloadingDoc('invoice');
    try {
      const res = await getAdminOrderInvoice(order.id);
      const invoiceUrl = res?.data?.invoiceUrl || res?.invoiceUrl;
      if (invoiceUrl) window.open(invoiceUrl, '_blank');
      else toast.error('Invoice URL not available.');
    } catch {
      toast.error('Failed to fetch invoice.');
    } finally {
      setDownloadingDoc(null);
    }
  };

  const handleCancelShipment = async () => {
    if (!window.confirm('Are you sure you want to cancel this Shiprocket shipment as Admin?')) return;
    try {
      await cancelAdminOrderShipment(order.id);
      toast.success('Shipment cancelled successfully.');
      fetchOrderData();
    } catch {
      toast.error('Failed to cancel shipment.');
    }
  };

  if (isLoading || !order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading order details...</p>
      </div>
    );
  }

  const statusOptions = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
  const itemsCount = Array.isArray(order.items) ? order.items.length : (typeof order.items === 'number' ? order.items : 0);
  const itemsArray = Array.isArray(order.items) ? order.items : [];

  const subtotal = order.subtotal ?? (order.total * 0.95);
  const shipping = order.shipping ?? (order.total * 0.05);
  const tax = order.tax ?? 0;
  const discount = order.discount ?? 0;

  const getPaymentMethodName = (method) => {
    if (!method) return 'N/A';
    const methods = {
      card: 'Credit/Debit Card',
      cash: 'Cash on Delivery',
      cod: 'Cash on Delivery',
      online: 'Online Payment (Razorpay)',
      razorpay: 'Online Payment (Razorpay)',
      upi: 'UPI',
      wallet: 'Digital Wallet',
      bank: 'Bank Transfer'
    };
    return methods[method.toLowerCase()] || method;
  };

  const getProductImage = (item) => {
    if (item.image) return item.image;
    if (item.productId?.images?.[0]) return item.productId.images[0];
    return 'https://via.placeholder.com/100x100?text=Product';
  };

  const activeAwb = order?.awbCode || shipment?.awbCode || order?.externalShipmentId || shipment?.externalShipmentId;
  const courierName = order?.courierName || shipment?.courierName || 'Shiprocket Courier';
  const isShipmentActive = Boolean(activeAwb && shipment?.status !== 'cancelled' && shipment?.status !== 'failed');

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <FiArrowLeft className="text-lg text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{order.id}</h1>
            <p className="text-xs text-gray-500">{formatDateTime(order.date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleStatusUpdate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
              >
                <FiCheck className="text-sm" /> Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setStatus(order.status);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-semibold"
              >
                <FiX className="text-sm" /> Cancel
              </button>
            </>
          ) : (
            <>
              <Badge variant={order.status}>{order.status.toUpperCase()}</Badge>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-semibold"
              >
                <FiEdit className="text-sm" /> Edit Status
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Third-Party Shipment Logistics Monitoring Card */}
          <div className="bg-gradient-to-r from-gray-900 via-indigo-950 to-gray-900 text-white rounded-xl shadow-md p-5 border border-indigo-900">
            <div className="flex items-center justify-between border-b border-indigo-800 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                  <FiTruck className="text-xl text-indigo-300" />
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight">Shiprocket Logistics Supervisor</h2>
                  <p className="text-xs text-indigo-300">Seller fulfillment & courier lifecycle monitor</p>
                </div>
              </div>
              {isShipmentActive ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold rounded-full">
                  <FiCheckCircle /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-500/20 text-gray-300 border border-gray-500/40 text-xs font-semibold rounded-full">
                  No Active Shipment
                </span>
              )}
            </div>

            {isShipmentActive ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/5 p-3.5 rounded-lg border border-white/10 text-sm">
                  <div>
                    <p className="text-xs text-indigo-300">Courier Partner</p>
                    <p className="font-semibold text-white truncate">{courierName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-indigo-300">AWB Number</p>
                    <p className="font-mono font-semibold text-white truncate">{activeAwb}</p>
                  </div>
                  <div>
                    <p className="text-xs text-indigo-300">Pickup Status</p>
                    <p className="font-semibold text-emerald-300">{shipment?.pickupStatus || 'SCHEDULED'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-indigo-300">Shipment Status</p>
                    <p className="font-semibold text-indigo-200">{shipment?.status?.toUpperCase() || 'CREATED'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={handleViewTracking}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <FiRefreshCw /> Live Tracking Logs
                  </button>
                  <button
                    onClick={handleDownloadLabel}
                    disabled={downloadingDoc === 'label'}
                    className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <FiDownload /> {downloadingDoc === 'label' ? 'Downloading...' : 'Label PDF'}
                  </button>
                  <button
                    onClick={handleDownloadManifest}
                    disabled={downloadingDoc === 'manifest'}
                    className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <FiFileText /> {downloadingDoc === 'manifest' ? 'Downloading...' : 'Manifest'}
                  </button>
                  <button
                    onClick={handleDownloadInvoice}
                    disabled={downloadingDoc === 'invoice'}
                    className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <FiFileText /> {downloadingDoc === 'invoice' ? 'Downloading...' : 'Invoice'}
                  </button>
                  <button
                    onClick={handleCancelShipment}
                    className="px-3.5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ml-auto"
                  >
                    <FiXCircle /> Admin Override Cancel
                  </button>
                </div>

                {order.vendorItems && order.vendorItems.length > 1 && (
                  <div className="mt-4 pt-3 border-t border-indigo-800/80 space-y-2">
                    <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Multi-Vendor Shipments Breakdown</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {order.vendorItems.map((vi, idx) => (
                        <div key={vi._id || idx} className="bg-black/20 p-2.5 rounded-lg border border-white/5 text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-white">{vi.vendorName || `Vendor ${idx + 1}`}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${vi.status === 'shipped' ? 'bg-indigo-500/20 text-indigo-300' : vi.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-300'}`}>
                              {vi.status?.toUpperCase() || 'PENDING'}
                            </span>
                          </div>
                          <p className="text-indigo-200 font-mono text-[11px]">AWB: {vi.awbCode || 'Not Generated'}</p>
                          <p className="text-gray-400 text-[11px]">Courier: {vi.courierName || 'Shiprocket Partner'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-indigo-200 leading-relaxed">
                Shipment has not been generated by the vendor yet. The assigned seller will generate Shiprocket shipment once the parcel is packed at their warehouse.
              </p>
            )}
          </div>

          {/* Order Overview Card */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            {isEditing ? (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Order Status</label>
                <AnimatedSelect
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  options={statusOptions.map((option) => ({
                    value: option,
                    label: option.charAt(0).toUpperCase() + option.slice(1),
                  }))}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Total</p>
                  <p className="font-bold text-gray-800 text-lg">{formatCurrency(order.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Items</p>
                  <p className="font-semibold text-gray-800">{itemsCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Payment</p>
                  <p className="text-xs font-semibold text-gray-800 capitalize">{getPaymentMethodName(order.paymentMethod)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Payment Status</p>
                  <Badge variant={order.paymentStatus === 'paid' ? 'delivered' : order.paymentStatus === 'pending' ? 'pending' : 'cancelled'} className="text-xs">
                    {order.paymentStatus || (order.paymentMethod === 'cash' ? 'Pending' : 'Paid')}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Order Items */}
          {itemsArray.length > 0 && (
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <FiPackage className="text-primary-600 text-base" /> Order Items ({itemsCount})
              </h2>
              <div className="space-y-2">
                {itemsArray.map((item) => (
                  <div key={item.id || item.name} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                    <img
                      src={getProductImage(item)}
                      alt={item.name || 'Product'}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/100x100?text=Product'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">{item.name || 'Unknown Product'}</p>
                      <p className="text-xs text-gray-600">{formatCurrency(item.price || 0)} x {item.quantity || 1}</p>
                    </div>
                    <p className="font-bold text-sm text-gray-800">{formatCurrency((item.price || 0) * (item.quantity || 1))}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer & Shipping Combined Card */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                  <FiMail className="text-primary-600 text-base" /> Customer
                </h2>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="font-semibold text-sm text-gray-800">{order.customer?.name || order.shippingAddress?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-semibold text-xs text-gray-800 break-all">{order.customer?.email || order.shippingAddress?.email || 'N/A'}</p>
                  </div>
                  {(order.customer?.phone || order.shippingAddress?.phone) && (
                    <div>
                      <p className="text-xs text-gray-500 flex items-center gap-1"><FiPhone className="text-xs" /> Phone</p>
                      <p className="font-semibold text-sm text-gray-800">{order.customer?.phone || order.shippingAddress?.phone}</p>
                    </div>
                  )}
                </div>
              </div>

              {order.shippingAddress && (
                <div>
                  <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                    <FiMapPin className="text-primary-600 text-base" /> Shipping Address
                  </h2>
                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold text-gray-800">{order.shippingAddress.name || 'N/A'}</p>
                    {order.shippingAddress.address && <p className="text-gray-700">{order.shippingAddress.address}</p>}
                    {(order.shippingAddress.city || order.shippingAddress.state || order.shippingAddress.zipCode) && (
                      <p className="text-gray-700">
                        {[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.zipCode].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {order.shippingAddress.country && <p className="text-gray-700">{order.shippingAddress.country}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Order Financial Summary */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <h2 className="text-sm font-bold text-gray-800 mb-3">Financial Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span className="flex items-center gap-1">
                    <FiTag className="text-xs" /> Discount
                  </span>
                  <span className="font-semibold">-{formatCurrency(discount)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-semibold">{formatCurrency(tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Shipping</span>
                <span className="font-semibold">{formatCurrency(shipping)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                <span className="font-bold text-gray-800">Total</span>
                <span className="font-bold text-lg text-gray-800">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
              <FiCalendar className="text-primary-600 text-base" /> Timeline
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800">Order Placed</p>
                  <p className="text-gray-500">{formatDateTime(order.date)}</p>
                </div>
              </div>
              {order.status === 'shipped' && (
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-800">Shipped (Shiprocket)</p>
                    {order.shipmentCreatedAt && <p className="text-gray-500">{formatDateTime(order.shipmentCreatedAt)}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Live Tracking */}
      <AnimatePresence>
        {showTrackingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100"
            >
              <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <FiTruck className="text-indigo-400" /> Courier Live Tracking Log
                </h3>
                <button onClick={() => setShowTrackingModal(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                  <FiXCircle className="text-lg" />
                </button>
              </div>

              <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
                {loadingTracking ? (
                  <p className="text-center py-6 text-sm text-gray-500">Fetching live status from Shiprocket...</p>
                ) : trackingData?.events?.length > 0 ? (
                  <div className="space-y-4 border-l-2 border-indigo-200 ml-3 pl-4">
                    {trackingData.events.map((event, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white" />
                        <p className="text-sm font-semibold text-gray-800">{event.status}</p>
                        {event.location && <p className="text-xs text-gray-500">{event.location}</p>}
                        <p className="text-[11px] text-gray-400">{new Date(event.timestamp).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-sm font-medium text-gray-700">Shipment Status: {shipment?.status?.toUpperCase() || 'CREATED'}</p>
                    <p className="text-xs text-gray-500">AWB Code: {activeAwb}</p>
                    <p className="text-xs text-gray-400">Live events will appear as parcel progresses through courier network.</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 border-t flex justify-end">
                <button
                  onClick={() => setShowTrackingModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminOrderDetail;
