/**
 * noopDeliveryProvider.js
 * ────────────────────────
 * Safe no-op implementation of IDeliveryProvider.
 * Used when DELIVERY_PROVIDER=internal (the default).
 *
 * All methods return a safe default value — never throw.
 * This is also the base to copy when scaffolding a new provider.
 */

export const noopDeliveryProvider = {
    name: 'internal',

    async createShipment(_context) {
        return { externalId: null, trackingUrl: null, label: null, providerStatus: 'internal' };
    },

    async cancelShipment(_context) {
        return { cancelled: true, reason: 'internal — no provider configured' };
    },

    async getTrackingInfo(_context) {
        return { providerStatus: null, location: null, etaMinutes: null, etaTimestamp: null, events: [] };
    },

    async getETA(_context) {
        return { etaMinutes: null, etaTimestamp: null };
    },

    async getQuote(_context) {
        return {
            providerName: 'internal',
            price: 0,
            currency: 'INR',
            breakdown: {},
            estimatedMinutes: null,
            validUntil: null,
        };
    },

    mapStatus(_providerStatus) {
        return null;
    },

    parseWebhookPayload(rawBody, _headers) {
        try {
            return typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
        } catch {
            return {};
        }
    },

    verifyWebhookSignature(_rawBody, _headers) {
        return true; // internal provider — no sig needed
    },

    async refreshToken() {
        // no-op
    },
};

export default noopDeliveryProvider;
