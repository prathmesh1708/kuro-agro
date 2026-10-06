import { io } from 'socket.io-client';
import { API_BASE_URL } from '../../../shared/utils/constants';

let vendorSocket = null;
let currentToken = null;

const getSocketBaseUrl = () => {
    if (import.meta.env.VITE_SOCKET_URL) {
        return import.meta.env.VITE_SOCKET_URL;
    }
    const apiUrl = API_BASE_URL || 'http://localhost:5000/api';
    return apiUrl.replace(/\/api\/?$/, '');
};

/**
 * Connect to Socket.IO server as authenticated vendor
 * @param {string} token - Vendor JWT access token
 */
export const connectVendorSocket = (token) => {
    const validToken = token || localStorage.getItem('vendor-token');

    if (!validToken) {
        console.warn('[Vendor Socket] No token provided for socket connection');
        return null;
    }

    if (vendorSocket?.connected && currentToken === validToken) {
        return vendorSocket;
    }

    if (vendorSocket) {
        vendorSocket.disconnect();
        vendorSocket = null;
    }

    currentToken = validToken;
    const socketUrl = getSocketBaseUrl();

    vendorSocket = io(socketUrl, {
        auth: {
            token: validToken,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
    });

    vendorSocket.on('connect', () => {
        console.log('⚡ [Vendor Socket] Connected to realtime server. ID:', vendorSocket.id);
    });

    vendorSocket.on('connect_error', (error) => {
        console.warn('⚠️ [Vendor Socket] Connection error:', error.message);
    });

    vendorSocket.on('disconnect', (reason) => {
        console.log('🔌 [Vendor Socket] Disconnected:', reason);
    });

    vendorSocket.on('reconnect', (attemptNumber) => {
        console.log('🔄 [Vendor Socket] Reconnected after attempt:', attemptNumber);
    });

    return vendorSocket;
};

/**
 * Disconnect current vendor socket connection
 */
export const disconnectVendorSocket = () => {
    if (vendorSocket) {
        vendorSocket.disconnect();
        vendorSocket = null;
        currentToken = null;
        console.log('🔌 [Vendor Socket] Disconnected by application');
    }
};

/**
 * Get current active vendor socket instance
 */
export const getVendorSocket = () => vendorSocket;

/**
 * Register listener for new order real-time events
 * @param {(order: object) => void} callback
 * @returns {() => void} cleanup function
 */
export const subscribeToNewOrders = (callback) => {
    if (!vendorSocket) {
        console.warn('[Vendor Socket] Socket not connected, cannot subscribe to new-order');
        return () => {};
    }

    vendorSocket.on('new-order', callback);
    return () => {
        if (vendorSocket) {
            vendorSocket.off('new-order', callback);
        }
    };
};

export default {
    connectVendorSocket,
    disconnectVendorSocket,
    getVendorSocket,
    subscribeToNewOrders,
};
