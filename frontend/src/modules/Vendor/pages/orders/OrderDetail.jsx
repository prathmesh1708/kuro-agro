import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    FiArrowLeft,
    FiPackage,
    FiMapPin,
    FiUser,
    FiDollarSign,
    FiTruck,
    FiFileText,
    FiDownload,
    FiRefreshCw,
    FiXCircle,
    FiCheckCircle,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useVendorAuthStore } from '../../store/vendorAuthStore';
import {
    getVendorOrderById,
    updateVendorOrderStatus,
    createVendorShipment,
    scheduleVendorPickup,
    getVendorShipment,
    getVendorShipmentTracking,
    getVendorShipmentLabel,
    getVendorShipmentManifest,
    getVendorShipmentInvoice,
    cancelVendorShipment,
} from '../../services/vendorService';
import { formatPrice } from '../../../../shared/utils/helpers';
import Badge from '../../../../shared/components/Badge';
import AnimatedSelect from '../../../Admin/components/AnimatedSelect';
import toast from 'react-hot-toast';

const VendorOrderDetail = () => {
    const { id } = useParams();
    const { vendor } = useVendorAuthStore();

    const [order, setOrder] = useState(null);
    const [shipment, setShipment] = useState(null);
    const [pickupLocation, setPickupLocation] = useState(null);
    const [metrics, setMetrics] = useState({ weight: 0.5, length: 10, breadth: 10, height: 5 });
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    // Shipment modals & action states
    const [showShipmentModal, setShowShipmentModal] = useState(false);
    const [isCreatingShipment, setIsCreatingShipment] = useState(false);
    const [isSchedulingPickup, setIsSchedulingPickup] = useState(false);
    const [showTrackingModal, setShowTrackingModal] = useState(false);
    const [trackingData, setTrackingData] = useState(null);
    const [loadingTracking, setLoadingTracking] = useState(false);
    const [downloadingDoc, setDownloadingDoc] = useState(null);

    // Package dimensions form state
    const [packageForm, setPackageForm] = useState({
        weight: 0.5,
        length: 10,
        breadth: 10,
        height: 5,
    });

    const vendorId = vendor?.id;
    const shippingAddress = order?.shippingAddress ?? order?.address ?? null;
    const customerName =
        order?.customer?.name ??
        order?.userId?.name ??
        order?.guestInfo?.name ??
        'Guest';
    const customerEmail =
        order?.customer?.email ??
        order?.userId?.email ??
        order?.guestInfo?.email ??
        'N/A';

    const fetchOrderAndShipment = async () => {
        if (!id || !vendorId) return;
        setLoading(true);
        try {
            const orderRes = await getVendorOrderById(id);
            const orderData = orderRes?.data ?? orderRes;
            setOrder(orderData ?? null);

            // Fetch shipment details if any
            try {
                const shipmentRes = await getVendorShipment(id);
                const payload = shipmentRes?.data ?? shipmentRes;
                if (payload?.shipment) setShipment(payload.shipment);
                if (payload?.pickupLocation) setPickupLocation(payload.pickupLocation);
                if (payload?.metrics) {
                    setMetrics(payload.metrics);
                    setPackageForm(payload.metrics);
                }
            } catch {
                // No shipment record yet
            }
        } catch {
            setOrder(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrderAndShipment();
    }, [id, vendorId]);

    const handleStatusChange = async (newStatus) => {
        if (!order) return;
        setUpdatingStatus(true);
        try {
            await updateVendorOrderStatus(order.orderId ?? order._id, newStatus);
            setOrder((prev) => ({
                ...prev,
                vendorItems: prev.vendorItems?.map((vi) =>
                    vi.vendorId?.toString() === vendorId?.toString()
                        ? { ...vi, status: newStatus }
                        : vi
                ),
                status: newStatus,
            }));
            toast.success(`Order status updated to ${newStatus}`);
        } catch {
            // Error toasted by api interceptor
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleGenerateShipment = async () => {
        if (!order) return;
        setIsCreatingShipment(true);
        try {
            const res = await createVendorShipment(order.orderId ?? order._id, packageForm);
            const payload = res?.data ?? res;
            setShipment(payload.shipment);
            setOrder(payload.order);
            setShowShipmentModal(false);

            if (payload.isAwbAssigned) {
                toast.success(res?.message || 'Shiprocket shipment created & pickup scheduled successfully!');
            } else if (payload.isWalletLow) {
                toast.error('Shiprocket order created, but wallet balance is low. Please recharge wallet to schedule pickup.', { duration: 6000 });
            } else {
                toast.success(res?.message || 'Shiprocket order registered. Courier assignment pending.');
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || err.message || 'Failed to generate shipment.');
        } finally {
            setIsCreatingShipment(false);
        }
    };

    const handleSchedulePickup = async () => {
        if (!order) return;
        setIsSchedulingPickup(true);
        try {
            const res = await scheduleVendorPickup(order.orderId ?? order._id);
            const payload = res?.data ?? res;
            setShipment(payload.shipment);
            setOrder(payload.order);
            toast.success(res?.message || 'Courier assigned and pickup scheduled successfully!');
        } catch (err) {
            toast.error(err?.response?.data?.message || err.message || 'Failed to schedule pickup.');
        } finally {
            setIsSchedulingPickup(false);
        }
    };

    const handleViewTracking = async () => {
        setShowTrackingModal(true);
        setLoadingTracking(true);
        try {
            const res = await getVendorShipmentTracking(order.orderId ?? order._id);
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
            const res = await getVendorShipmentLabel(order.orderId ?? order._id);
            const labelUrl = res?.data?.labelUrl || res?.labelUrl;
            if (labelUrl) window.open(labelUrl, '_blank');
            else toast.error('Label link not available.');
        } catch {
            toast.error('Failed to fetch shipping label.');
        } finally {
            setDownloadingDoc(null);
        }
    };

    const handleDownloadManifest = async () => {
        setDownloadingDoc('manifest');
        try {
            const res = await getVendorShipmentManifest(order.orderId ?? order._id);
            const manifestUrl = res?.data?.manifestUrl || res?.manifestUrl;
            if (manifestUrl) window.open(manifestUrl, '_blank');
            else toast.error('Manifest link not available.');
        } catch {
            toast.error('Failed to fetch manifest.');
        } finally {
            setDownloadingDoc(null);
        }
    };

    const handleDownloadInvoice = async () => {
        setDownloadingDoc('invoice');
        try {
            const res = await getVendorShipmentInvoice(order.orderId ?? order._id);
            const invoiceUrl = res?.data?.invoiceUrl || res?.invoiceUrl;
            if (invoiceUrl) window.open(invoiceUrl, '_blank');
            else toast.error('Invoice link not available.');
        } catch {
            toast.error('Failed to fetch invoice.');
        } finally {
            setDownloadingDoc(null);
        }
    };

    const handleCancelShipment = async () => {
        if (!window.confirm('Are you sure you want to cancel this Shiprocket shipment?')) return;
        try {
            await cancelVendorShipment(order.orderId ?? order._id);
            toast.success('Shipment cancelled successfully.');
            fetchOrderAndShipment();
        } catch {
            toast.error('Failed to cancel shipment.');
        }
    };

    const statusOptions = [
        { value: 'pending', label: 'Pending', color: 'yellow' },
        { value: 'processing', label: 'Processing', color: 'blue' },
        { value: 'shipped', label: 'Shipped', color: 'purple' },
        { value: 'delivered', label: 'Delivered', color: 'green' },
        { value: 'cancelled', label: 'Cancelled', color: 'red' },
    ];

    const transitionMap = {
        pending: ['pending', 'processing', 'cancelled'],
        processing: ['processing', 'shipped', 'cancelled'],
        shipped: ['shipped', 'delivered'],
        delivered: ['delivered'],
        cancelled: ['cancelled'],
    };

    const vendorItem = order?.vendorItems?.find(
        (vi) => vi.vendorId?.toString() === vendorId?.toString()
    );
    const currentStatus = String(vendorItem?.status ?? order?.status ?? 'pending').toLowerCase();
    const allowedStatuses = transitionMap[currentStatus] || [currentStatus];
    const visibleStatusOptions = statusOptions.filter((option) =>
        allowedStatuses.includes(option.value)
    );

    const vendorItems = vendorItem?.items ?? [];
    const vendorSubtotal = vendorItem?.subtotal ?? 0;

    const activeAwb = vendorItem?.awbCode || shipment?.awbCode || order?.awbCode || null;
    const courierName = vendorItem?.courierName || shipment?.courierName || order?.courierName || 'Shiprocket Partner';
    const isShipmentActive = Boolean(activeAwb && shipment?.status !== 'cancelled' && shipment?.status !== 'failed');
    const srShipmentId = shipment?.shiprocketShipmentId || vendorItem?.shiprocketShipmentId || order?.shiprocketShipmentId;
    const isWalletLow = shipment?.pickupStatus === 'WALLET_RECHARGE_REQUIRED' || shipment?.timeline?.[0]?.status === 'WALLET_RECHARGE_REQUIRED';
    const isPendingAssignment = Boolean(srShipmentId && !isShipmentActive);

    if (loading) {
        return (
            <div className="p-6 text-center">
                <p className="text-gray-500">Loading order details...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="p-6 text-center space-y-3">
                <p className="text-gray-700 font-semibold">Order not found</p>
                <p className="text-sm text-gray-500">Order #{id} may not belong to your store.</p>
                <Link to="/vendor/orders" className="inline-block text-blue-600 hover:underline text-sm">
                    ← Back to Orders
                </Link>
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link to="/vendor/orders" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <FiArrowLeft className="text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Order #{order.orderId ?? order._id}</h1>
                        <p className="text-sm text-gray-500">
                            Placed on {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <AnimatedSelect
                        options={visibleStatusOptions}
                        value={currentStatus}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        disabled={updatingStatus}
                        color={visibleStatusOptions.find((opt) => opt.value === currentStatus)?.color || 'gray'}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Shiprocket Delivery Integration Card */}
                    <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-xl shadow-md p-5 border border-purple-800">
                        <div className="flex items-center justify-between border-b border-purple-700 pb-3 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-sm">
                                    <FiTruck className="text-xl text-purple-200" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-lg leading-tight">Shiprocket Logistics</h2>
                                    <p className="text-xs text-purple-200">Fulfill national shipments directly from your warehouse</p>
                                </div>
                            </div>
                            {isShipmentActive ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold rounded-full">
                                    <FiCheckCircle />
                                    Active Shipment
                                </span>
                            ) : isPendingAssignment ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold rounded-full">
                                    {isWalletLow ? 'Wallet Recharge Required' : 'Courier Assignment Pending'}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-semibold rounded-full">
                                    Ready for Shipment
                                </span>
                            )}
                        </div>

                        {isShipmentActive ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/10 p-3.5 rounded-lg backdrop-blur-sm text-sm">
                                    <div>
                                        <p className="text-xs text-purple-200">Courier Partner</p>
                                        <p className="font-semibold text-white truncate">{courierName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-purple-200">AWB Number</p>
                                        <p className="font-mono font-semibold text-white truncate">{activeAwb}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-purple-200">Pickup Status</p>
                                        <p className="font-semibold text-emerald-300">{shipment?.pickupStatus || 'SCHEDULED'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-purple-200">Status</p>
                                        <p className="font-semibold text-indigo-200">{shipment?.status?.toUpperCase() || 'CREATED'}</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <button
                                        onClick={handleViewTracking}
                                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                                    >
                                        <FiRefreshCw /> Track Live
                                    </button>
                                    <button
                                        onClick={handleDownloadLabel}
                                        disabled={downloadingDoc === 'label'}
                                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                    >
                                        <FiDownload /> {downloadingDoc === 'label' ? 'Downloading...' : 'Shipping Label'}
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
                                        <FiXCircle /> Cancel Shipment
                                    </button>
                                </div>
                            </div>
                        ) : isPendingAssignment ? (
                            <div className="space-y-4">
                                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-200 space-y-1">
                                    <p className="font-semibold text-white">
                                        Shiprocket Order Created (Shipment ID: #{srShipmentId})
                                    </p>
                                    <p className="text-amber-200 leading-relaxed">
                                        {isWalletLow
                                            ? '⚠️ Shiprocket wallet balance is low. Please recharge your Shiprocket account, then click the button below to assign courier & schedule pickup.'
                                            : 'Order is created in Shiprocket. Click below to assign the courier partner and schedule warehouse pickup.'}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 pt-1">
                                    <button
                                        onClick={handleSchedulePickup}
                                        disabled={isSchedulingPickup}
                                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-xs rounded-lg shadow-md transition-all flex items-center gap-2 disabled:opacity-60"
                                    >
                                        <FiTruck className="text-sm" />
                                        {isSchedulingPickup ? 'Scheduling Pickup...' : 'Assign Courier & Schedule Pickup'}
                                    </button>
                                    <button
                                        onClick={handleCancelShipment}
                                        className="px-3.5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ml-auto"
                                    >
                                        <FiXCircle /> Cancel Shipment
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="text-sm text-purple-100 space-y-1">
                                    <p className="font-semibold text-white">Generate courier shipment with automatic courier assignment & AWB generation.</p>
                                    <p className="text-xs text-purple-200">
                                        Pickup Location: <span className="font-medium text-white">{pickupLocation?.name || 'Seller Primary Warehouse'}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowShipmentModal(true)}
                                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-sm rounded-lg shadow-lg shadow-emerald-950/30 transition-all flex items-center gap-2 flex-shrink-0"
                                >
                                    <FiTruck className="text-base" /> Generate Shiprocket Shipment
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Order Items */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                <FiPackage />
                                Your Items in this Order
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-200">
                            {vendorItems.length > 0 ? (
                                vendorItems.map((item, index) => (
                                    <div key={index} className="p-4 flex gap-4">
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                            <img
                                                src={item.image}
                                                alt={item.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.target.src = 'https://via.placeholder.com/64?text=P';
                                                }}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-medium text-gray-800">{item.name}</h3>
                                                    <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                                                </div>
                                                <p className="font-semibold text-gray-800">
                                                    {formatPrice((item.price ?? 0) * (item.quantity ?? 1))}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-6 text-center text-gray-500 text-sm">
                                    No item details available for this order.
                                </div>
                            )}
                        </div>
                        {vendorSubtotal > 0 && (
                            <div className="p-4 border-t border-gray-200 flex justify-end">
                                <div className="text-right">
                                    <p className="text-sm text-gray-500">Your subtotal</p>
                                    <p className="text-lg font-bold text-gray-800">{formatPrice(vendorSubtotal)}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Order Status Summary */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <FiDollarSign />
                            Order Summary
                        </h2>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">Your items status</span>
                            <Badge
                                variant={
                                    currentStatus === 'delivered'
                                        ? 'success'
                                        : currentStatus === 'pending'
                                            ? 'warning'
                                            : currentStatus === 'cancelled'
                                                ? 'error'
                                                : 'info'
                                }
                            >
                                {currentStatus.toUpperCase()}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Customer Info */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <FiUser />
                            Customer Details
                        </h2>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-gray-500">Name</p>
                                <p className="font-medium">{customerName}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Email</p>
                                <p className="font-medium">{customerEmail}</p>
                            </div>
                        </div>
                    </div>

                    {/* Shipping Address */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <FiMapPin />
                            Shipping Address
                        </h2>
                        {shippingAddress ? (
                            <p className="text-gray-600 text-sm leading-relaxed">
                                {shippingAddress.address ?? shippingAddress.street ?? 'N/A'}
                                <br />
                                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}
                                <br />
                                {shippingAddress.country}
                            </p>
                        ) : (
                            <p className="text-sm text-gray-400">No address available</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal: Generate Shiprocket Shipment */}
            <AnimatePresence>
                {showShipmentModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100"
                        >
                            <div className="p-5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <FiTruck className="text-xl text-purple-300" />
                                    <h3 className="font-bold text-lg">Generate Shiprocket Shipment</h3>
                                </div>
                                <button
                                    onClick={() => setShowShipmentModal(false)}
                                    className="p-1 hover:bg-white/20 rounded-full transition-colors text-purple-200"
                                >
                                    <FiXCircle className="text-lg" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                                <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 text-xs text-purple-800 space-y-1">
                                    <p className="font-semibold">Registered Pickup Warehouse:</p>
                                    <p className="text-gray-700">{pickupLocation?.name || 'Primary Warehouse'} — {pickupLocation?.city || 'Default Location'} ({pickupLocation?.zipCode || 'Pincode'})</p>
                                </div>

                                <p className="text-xs text-gray-500 font-medium">
                                    Package dimensions & weight have been pre-filled from product metadata. Verify or adjust if necessary:
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Weight (kg)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0.1"
                                            value={packageForm.weight}
                                            onChange={(e) => setPackageForm((p) => ({ ...p, weight: Number(e.target.value) }))}
                                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Length (cm)</label>
                                        <input
                                            type="number"
                                            step="1"
                                            min="1"
                                            value={packageForm.length}
                                            onChange={(e) => setPackageForm((p) => ({ ...p, length: Number(e.target.value) }))}
                                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Breadth (cm)</label>
                                        <input
                                            type="number"
                                            step="1"
                                            min="1"
                                            value={packageForm.breadth}
                                            onChange={(e) => setPackageForm((p) => ({ ...p, breadth: Number(e.target.value) }))}
                                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Height (cm)</label>
                                        <input
                                            type="number"
                                            step="1"
                                            min="1"
                                            value={packageForm.height}
                                            onChange={(e) => setPackageForm((p) => ({ ...p, height: Number(e.target.value) }))}
                                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                                <button
                                    onClick={() => setShowShipmentModal(false)}
                                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleGenerateShipment}
                                    disabled={isCreatingShipment}
                                    className="px-5 py-2 text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow transition-colors flex items-center gap-2 disabled:opacity-60"
                                >
                                    {isCreatingShipment ? 'Generating Shipment...' : 'Confirm & Create Shipment'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

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
                                    <FiTruck className="text-purple-400" /> Live Tracking Info
                                </h3>
                                <button
                                    onClick={() => setShowTrackingModal(false)}
                                    className="p-1 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    <FiXCircle className="text-lg" />
                                </button>
                            </div>

                            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
                                {loadingTracking ? (
                                    <p className="text-center py-6 text-sm text-gray-500">Fetching live updates from courier...</p>
                                ) : trackingData?.events?.length > 0 ? (
                                    <div className="space-y-4 border-l-2 border-purple-200 ml-3 pl-4">
                                        {trackingData.events.map((event, idx) => (
                                            <div key={idx} className="relative">
                                                <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-purple-600 border-2 border-white" />
                                                <p className="text-sm font-semibold text-gray-800">{event.status}</p>
                                                {event.location && <p className="text-xs text-gray-500">{event.location}</p>}
                                                <p className="text-[11px] text-gray-400">{new Date(event.timestamp).toLocaleString()}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 space-y-2">
                                        <p className="text-sm font-medium text-gray-700">Shipment Status: {shipment?.status?.toUpperCase() || 'CREATED'}</p>
                                        <p className="text-xs text-gray-500">Tracking AWB: {activeAwb}</p>
                                        <p className="text-xs text-gray-400">Live courier activities will appear once parcel is scanned at pickup.</p>
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

export default VendorOrderDetail;
