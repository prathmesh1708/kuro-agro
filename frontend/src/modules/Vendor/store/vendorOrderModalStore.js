import { create } from 'zustand';
import toast from 'react-hot-toast';
import { updateVendorOrderStatus } from '../services/vendorService';
import { playOrderAlertSound } from '../../../shared/utils/soundHelper';

export const useVendorOrderModalStore = create((set, get) => ({
    isOpen: false,
    activeOrder: null,
    orderQueue: [],
    processedOrderIds: new Set(),
    isAccepting: false,
    isDeclining: false,

    /**
     * Enqueue a new incoming order received via WebSocket
     * Handles deduplication, alert sound, and instant modal display or queueing.
     * @param {object} order
     */
    enqueueOrder: (order) => {
        if (!order) return;

        const uniqueKey = String(order.orderId || order._id || '');
        if (!uniqueKey) return;

        const state = get();

        // 1. Deduplication check against processed/active/queued IDs
        if (state.processedOrderIds.has(uniqueKey)) {
            console.log(`[Order Modal Store] Ignored duplicate order event: ${uniqueKey}`);
            return;
        }

        // Also check if matches active order or queued order
        const isCurrentActive =
            (state.activeOrder?.orderId && state.activeOrder.orderId === order.orderId) ||
            (state.activeOrder?._id && state.activeOrder._id === order._id);
        if (isCurrentActive) return;

        const isAlreadyInQueue = state.orderQueue.some(
            (o) => (o.orderId && o.orderId === order.orderId) || (o._id && o._id === order._id)
        );
        if (isAlreadyInQueue) return;

        // 2. Play alert chime
        playOrderAlertSound();

        const updatedSet = new Set(state.processedOrderIds);
        updatedSet.add(uniqueKey);
        if (order._id) updatedSet.add(String(order._id));
        if (order.orderId) updatedSet.add(String(order.orderId));

        // 3. Set as active order or push to queue
        if (!state.activeOrder && !state.isOpen) {
            set({
                isOpen: true,
                activeOrder: order,
                processedOrderIds: updatedSet,
            });
        } else {
            set({
                orderQueue: [...state.orderQueue, order],
                processedOrderIds: updatedSet,
            });
            toast('New order queued', {
                icon: '🔔',
                duration: 3000,
            });
        }
    },

    /**
     * Accept the active order using the existing backend status API
     */
    acceptActiveOrder: async () => {
        const { activeOrder, orderQueue } = get();
        if (!activeOrder) return;

        const orderId = activeOrder.orderId || activeOrder._id;
        set({ isAccepting: true });

        try {
            await updateVendorOrderStatus(orderId, 'processing');
            toast.success(`Order ${activeOrder.orderId || orderId} accepted!`);

            // Trigger real-time refresh event for any open order tables/dashboards
            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new CustomEvent('vendor-order-updated', {
                        detail: { orderId, status: 'processing' },
                    })
                );
            }

            // Advance to next queued order if available, else close
            if (orderQueue.length > 0) {
                const [nextOrder, ...remainingQueue] = orderQueue;
                set({
                    activeOrder: nextOrder,
                    orderQueue: remainingQueue,
                    isOpen: true,
                    isAccepting: false,
                });
            } else {
                set({
                    activeOrder: null,
                    isOpen: false,
                    isAccepting: false,
                });
            }
        } catch (error) {
            console.error('[Order Modal Store] Failed to accept order:', error);
            set({ isAccepting: false });
        }
    },

    /**
     * Decline / Reject the active order using the existing backend status API
     */
    declineActiveOrder: async () => {
        const { activeOrder, orderQueue } = get();
        if (!activeOrder) return;

        const orderId = activeOrder.orderId || activeOrder._id;
        set({ isDeclining: true });

        try {
            await updateVendorOrderStatus(orderId, 'cancelled');
            toast.success(`Order ${activeOrder.orderId || orderId} declined.`);

            // Trigger real-time refresh event
            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new CustomEvent('vendor-order-updated', {
                        detail: { orderId, status: 'cancelled' },
                    })
                );
            }

            // Advance to next queued order if available, else close
            if (orderQueue.length > 0) {
                const [nextOrder, ...remainingQueue] = orderQueue;
                set({
                    activeOrder: nextOrder,
                    orderQueue: remainingQueue,
                    isOpen: true,
                    isDeclining: false,
                });
            } else {
                set({
                    activeOrder: null,
                    isOpen: false,
                    isDeclining: false,
                });
            }
        } catch (error) {
            console.error('[Order Modal Store] Failed to decline order:', error);
            set({ isDeclining: false });
        }
    },

    /**
     * Manually close or dismiss current modal without action
     * (Advances to next in queue if available)
     */
    closeModal: () => {
        const { orderQueue } = get();
        if (orderQueue.length > 0) {
            const [nextOrder, ...remainingQueue] = orderQueue;
            set({
                activeOrder: nextOrder,
                orderQueue: remainingQueue,
                isOpen: true,
            });
        } else {
            set({
                isOpen: false,
                activeOrder: null,
            });
        }
    },

    /**
     * Reset store state on logout
     */
    resetStore: () => {
        set({
            isOpen: false,
            activeOrder: null,
            orderQueue: [],
            processedOrderIds: new Set(),
            isAccepting: false,
            isDeclining: false,
        });
    },
}));

export default useVendorOrderModalStore;
