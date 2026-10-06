import { Server } from 'socket.io';
import { verifyAccessToken } from '../config/jwt.js';

let io = null;

/**
 * Initialize Socket.IO with the HTTP server
 * @param {import('http').Server} httpServer
 */
export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: true,
            credentials: true,
        },
        pingTimeout: 30000,
        pingInterval: 25000,
    });

    // JWT Authentication Middleware for Socket Connections
    io.use((socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

            if (!token) {
                return next(new Error('Authentication required for socket connection.'));
            }

            const decoded = verifyAccessToken(token);
            socket.user = decoded; // { id, role, email }
            next();
        } catch (err) {
            console.warn('[Socket Auth Error]:', err.message);
            return next(new Error('Invalid or expired socket token.'));
        }
    });

    io.on('connection', (socket) => {
        const { id, role } = socket.user || {};

        if (role === 'vendor' && id) {
            const room = `vendor:${id}`;
            socket.join(room);
            console.log(`[Socket] Vendor authenticated & joined room: ${room} (Socket ID: ${socket.id})`);
        } else if (role === 'admin' || role === 'superadmin') {
            socket.join('admin');
            console.log(`[Socket] Admin joined admin room (Socket ID: ${socket.id})`);
        }

        socket.on('disconnect', (reason) => {
            console.log(`[Socket] Client disconnected: ${socket.id} (Reason: ${reason})`);
        });
    });

    console.log('⚡ Socket.IO initialized successfully');
    return io;
};

/**
 * Get active Socket.IO instance
 */
export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io has not been initialized. Please call initSocket first.');
    }
    return io;
};

/**
 * Safely emit event to a specific vendor's private room
 * @param {string} vendorId
 * @param {string} eventName
 * @param {object} data
 */
export const emitToVendor = (vendorId, eventName, data) => {
    try {
        if (!io) {
            console.warn('[Socket] Cannot emit event, Socket.IO is not initialized.');
            return false;
        }
        const room = `vendor:${vendorId}`;
        io.to(room).emit(eventName, data);
        console.log(`[Socket] Emitted event "${eventName}" to room "${room}"`);
        return true;
    } catch (err) {
        console.error(`[Socket] Failed to emit event "${eventName}" to vendor ${vendorId}:`, err);
        return false;
    }
};

/**
 * Notify all vendors who have items in the newly created order
 * @param {object} order - Newly created Mongoose Order document
 */
export const notifyVendorsOfNewOrder = (order) => {
    try {
        if (!order || !Array.isArray(order.vendorItems) || order.vendorItems.length === 0) {
            return;
        }

        for (const vendorGroup of order.vendorItems) {
            const vendorId = vendorGroup.vendorId?._id || vendorGroup.vendorId;
            if (!vendorId) continue;

            const vendorItemsList = Array.isArray(vendorGroup.items)
                ? vendorGroup.items.map((item) => ({
                      productId: item.productId?._id || item.productId,
                      name: item.name || 'Product',
                      image: item.image || '',
                      price: Number(item.price || 0),
                      quantity: Number(item.quantity || 1),
                      variant: item.variant || {},
                      variantKey: item.variantKey || '',
                  }))
                : [];

            const subtotal = Number(vendorGroup.subtotal || 0);
            const shipping = Number(vendorGroup.shipping || 0);
            const tax = Number(vendorGroup.tax || 0);
            const discount = Number(vendorGroup.discount || 0);
            const total = Number((subtotal + shipping + tax - discount).toFixed(2));

            const payload = {
                orderId: order.orderId,
                _id: String(order._id),
                createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
                items: vendorItemsList,
                subtotal,
                shipping,
                tax,
                discount,
                total,
                paymentMethod: order.paymentMethod || 'cod',
                paymentStatus: order.paymentStatus || 'pending',
                status: vendorGroup.status || 'pending',
                shippingAddress: {
                    name: order.shippingAddress?.name || 'Customer',
                    city: order.shippingAddress?.city || '',
                    state: order.shippingAddress?.state || '',
                    address: order.shippingAddress?.address || '',
                    zipCode: order.shippingAddress?.zipCode || '',
                    country: order.shippingAddress?.country || 'India',
                },
                customerName: order.shippingAddress?.name || order.guestInfo?.name || 'Customer',
            };

            emitToVendor(String(vendorId), 'new-order', payload);
        }
    } catch (err) {
        console.error('[Socket] Failed to notify vendors of new order:', err);
    }
};

export default {
    initSocket,
    getIO,
    emitToVendor,
    notifyVendorsOfNewOrder,
};
