import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiBell,
    FiCheck,
    FiX,
    FiPackage,
    FiMapPin,
    FiCreditCard,
    FiClock,
    FiLayers,
    FiUser,
} from 'react-icons/fi';
import { formatPrice } from '../../../../shared/utils/helpers';
import { useVendorOrderModalStore } from '../../store/vendorOrderModalStore';

const VendorNewOrderModal = () => {
    const {
        isOpen,
        activeOrder,
        orderQueue,
        isAccepting,
        isDeclining,
        acceptActiveOrder,
        declineActiveOrder,
        closeModal,
    } = useVendorOrderModalStore();

    // Visual timer progress bar for UI excitement
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (!isOpen || !activeOrder) {
            setProgress(100);
            return;
        }

        // Visual timer bar (60 seconds countdown for prompt action)
        const duration = 60000;
        const interval = 500;
        const step = (interval / duration) * 100;
        setProgress(100);

        const timer = setInterval(() => {
            setProgress((prev) => {
                const next = prev - step;
                return next > 0 ? next : 0;
            });
        }, interval);

        return () => clearInterval(timer);
    }, [isOpen, activeOrder]);

    if (!isOpen || !activeOrder) return null;

    const items = Array.isArray(activeOrder.items) ? activeOrder.items : [];
    const orderTotal = activeOrder.total || activeOrder.subtotal || 0;
    const orderId = activeOrder.orderId || activeOrder._id || 'N/A';
    const customerName = activeOrder.customerName || activeOrder.shippingAddress?.name || 'Customer';
    const city = activeOrder.shippingAddress?.city;
    const state = activeOrder.shippingAddress?.state;
    const locationString = city && state ? `${city}, ${state}` : city || state || 'Delivery Address';
    const paymentMethod = String(activeOrder.paymentMethod || 'COD').toUpperCase();
    const isPaid = activeOrder.paymentStatus === 'paid';
    const queueCount = orderQueue.length;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                {/* Backdrop overlay with blur */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
                    onClick={closeModal}
                />

                {/* Centered Modal Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-10 my-auto"
                >
                    {/* Header Banner */}
                    <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-primary-600 px-5 pt-6 pb-5 text-white overflow-hidden">
                        {/* Decorative background glows */}
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
                        <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-amber-400/20 rounded-full blur-lg pointer-events-none" />

                        {/* Dismiss X button */}
                        <button
                            onClick={closeModal}
                            disabled={isAccepting || isDeclining}
                            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-full transition-colors"
                            aria-label="Dismiss order popup"
                        >
                            <FiX className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3.5 relative z-10">
                            {/* Animated Bell Badge */}
                            <div className="relative flex-shrink-0">
                                <motion.div
                                    animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                                    transition={{ repeat: Infinity, duration: 2, repeatDelay: 1.5 }}
                                    className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner"
                                >
                                    <FiBell className="w-7 h-7 text-white" />
                                </motion.div>
                                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
                                </span>
                            </div>

                            <div className="flex-1 min-w-0 pr-6">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-sm">
                                        New Order Received!
                                    </h2>
                                    {queueCount > 0 && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-white text-orange-600 shadow-sm animate-pulse">
                                            +{queueCount} more in queue
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-white/90 text-xs sm:text-sm font-medium">
                                    <span className="font-mono bg-black/20 px-2 py-0.5 rounded-md border border-white/10">
                                        {orderId}
                                    </span>
                                    <span className="text-white/75 flex items-center gap-1">
                                        <FiClock className="w-3.5 h-3.5" />
                                        Just now
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Visual Countdown Progress Indicator */}
                        <div className="mt-4 pt-1">
                            <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden">
                                <motion.div
                                    className="bg-emerald-300 h-full rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Order Details Body */}
                    <div className="p-5 sm:p-6 space-y-4 max-h-[calc(85vh-200px)] overflow-y-auto">
                        {/* Highlights Summary Grid */}
                        <div className="grid grid-cols-2 gap-3 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
                            {/* Customer Info */}
                            <div className="flex items-start gap-2.5">
                                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 mt-0.5">
                                    <FiUser className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] uppercase tracking-wider font-bold text-gray-400">Customer</p>
                                    <p className="text-sm font-bold text-gray-800 truncate">{customerName}</p>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 truncate mt-0.5">
                                        <FiMapPin className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate">{locationString}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Total Amount & Payment Mode */}
                            <div className="flex items-start gap-2.5">
                                <div className={`p-2 rounded-xl mt-0.5 ${isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                    <FiCreditCard className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] uppercase tracking-wider font-bold text-gray-400">Total Amount</p>
                                    <p className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                                        {formatPrice(orderTotal)}
                                    </p>
                                    <span
                                        className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 ${
                                            isPaid
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}
                                    >
                                        {paymentMethod} {isPaid ? '• PAID' : '• PENDING'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Ordered Items List */}
                        <div>
                            <div className="flex items-center justify-between mb-2 px-1">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <FiPackage className="w-3.5 h-3.5 text-primary-500" />
                                    Ordered Items ({items.length})
                                </span>
                                <span className="text-xs font-semibold text-gray-400">
                                    Subtotal: {formatPrice(activeOrder.subtotal || orderTotal)}
                                </span>
                            </div>

                            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                                {items.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-gray-100 shadow-sm hover:border-gray-200 transition-colors"
                                    >
                                        {/* Thumbnail */}
                                        <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                            {item.image ? (
                                                <img
                                                    src={item.image}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <FiPackage className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-gray-800 truncate" title={item.name}>
                                                {item.name}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                                {item.variantKey && (
                                                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono text-[10px]">
                                                        {item.variantKey}
                                                    </span>
                                                )}
                                                <span className="font-medium text-gray-700">
                                                    Qty: <strong className="text-gray-900">{item.quantity}</strong>
                                                </span>
                                                <span>×</span>
                                                <span>{formatPrice(item.price)}</span>
                                            </div>
                                        </div>

                                        {/* Line Total */}
                                        <div className="text-right flex-shrink-0">
                                            <span className="text-sm font-bold text-gray-900">
                                                {formatPrice((item.price || 0) * (item.quantity || 1))}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer with Actions */}
                    <div className="p-4 sm:p-5 bg-gray-50/90 border-t border-gray-100 flex items-center gap-3">
                        {/* Decline / Reject Button */}
                        <button
                            type="button"
                            onClick={declineActiveOrder}
                            disabled={isAccepting || isDeclining}
                            className="flex-1 py-3 px-4 rounded-xl border-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 font-bold text-sm sm:text-base transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                            {isDeclining ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                                    <span>Declining...</span>
                                </>
                            ) : (
                                <>
                                    <FiX className="w-4 h-4" />
                                    <span>Decline</span>
                                </>
                            )}
                        </button>

                        {/* Accept Order Button */}
                        <button
                            type="button"
                            onClick={acceptActiveOrder}
                            disabled={isAccepting || isDeclining}
                            className="flex-[1.6] py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-emerald-500/25 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                            {isAccepting ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Accepting...</span>
                                </>
                            ) : (
                                <>
                                    <FiCheck className="w-5 h-5" strokeWidth={2.5} />
                                    <span>Accept Order</span>
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default VendorNewOrderModal;
