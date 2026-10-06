/**
 * deliveryStatusMapping.js
 * ─────────────────────────
 * Translates raw provider statuses to your canonical Order.status enum values:
 *   pending | processing | shipped | delivered | cancelled | returned
 *
 * Rule: if mapStatus returns null, DO NOT transition the order.
 *       Store the raw status in DeliveryShipment.timeline and log a warning.
 */

// ─── Shiprocket ───────────────────────────────────────────────────────────────
const SHIPROCKET_MAP = {
    // Pre-pickup
    'PICKUP SCHEDULED':       'processing',
    'PICKUP GENERATED':       'processing',
    'PICKUP QUEUED':          'processing',
    'MANIFESTED':             'processing',
    'OUT FOR PICKUP':         'processing',

    // In transit
    'PICKUP COMPLETE':        'shipped',
    'IN TRANSIT':             'shipped',
    'OUT FOR DELIVERY':       'shipped',
    'REACHED DESTINATION HUB':'shipped',

    // Terminal — positive
    'DELIVERED':              'delivered',

    // Terminal — negative
    'UNDELIVERED':            'cancelled',
    'RTO INITIATED':          'returned',
    'RTO IN TRANSIT':         'returned',
    'RTO OUT FOR DELIVERY':   'returned',
    'RTO DELIVERED':          'returned',
    'CANCELLED':              'cancelled',
    'SHIPMENT LOST':          'cancelled',
};

// ─── Porter ───────────────────────────────────────────────────────────────────
const PORTER_MAP = {
    'order_accepted':         'processing',
    'driver_arrived_pickup':  'processing',
    'order_picked_up':        'shipped',
    'in_transit':             'shipped',
    'driver_arrived_drop':    'shipped',
    'order_delivered':        'delivered',
    'order_cancelled':        'cancelled',
    'order_failed':           'cancelled',
};

// ─── Registry ─────────────────────────────────────────────────────────────────
const PROVIDER_MAPS = {
    shiprocket: SHIPROCKET_MAP,
    porter:     PORTER_MAP,
};

/**
 * Maps a provider's raw status to your canonical Order.status value.
 *
 * @param {string} providerName  – e.g. "shiprocket"
 * @param {string} providerStatus – raw status from provider API / webhook
 * @returns {string|null} – canonical status, or null if unmapped
 */
export function providerStatusToOrderStatus(providerName, providerStatus) {
    if (!providerName || !providerStatus) return null;
    const map = PROVIDER_MAPS[String(providerName).toLowerCase()];
    if (!map) return null;
    return map[String(providerStatus).toUpperCase()] ?? map[String(providerStatus)] ?? null;
}

export default providerStatusToOrderStatus;
