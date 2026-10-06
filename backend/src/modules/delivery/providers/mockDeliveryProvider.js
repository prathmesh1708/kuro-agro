/**
 * mockDeliveryProvider.js
 * ────────────────────────
 * Deterministic stub provider for development and testing.
 * Used when DELIVERY_PROVIDER=mock.
 *
 * All methods return predictable, hardcoded responses that
 * exercise the full processing pipeline without hitting any external API.
 */

import crypto from 'crypto';

const MOCK_AWB      = 'MOCK-AWB-000001';
const MOCK_TRACKING = 'https://track.example.com/MOCK-AWB-000001';

export const mockDeliveryProvider = {
    name: 'mock',

    async createShipment(context) {
        return {
            externalId:     MOCK_AWB,
            trackingUrl:    MOCK_TRACKING,
            label:          null,
            providerStatus: 'PICKUP SCHEDULED',
        };
    },

    async cancelShipment(_context) {
        return { cancelled: true, reason: 'mock cancellation' };
    },

    async getTrackingInfo(_context) {
        return {
            providerStatus: 'OUT FOR DELIVERY',
            location:       { lat: 12.9716, lng: 77.5946, label: 'Bangalore Hub' },
            etaMinutes:     15,
            etaTimestamp:   new Date(Date.now() + 15 * 60 * 1000),
            events: [
                { status: 'PICKUP SCHEDULED',  timestamp: new Date(Date.now() - 3600000), location: 'Warehouse' },
                { status: 'OUT FOR DELIVERY',  timestamp: new Date(),                     location: 'Bangalore Hub' },
            ],
        };
    },

    async getETA(_context) {
        return {
            etaMinutes:   15,
            etaTimestamp: new Date(Date.now() + 15 * 60 * 1000),
        };
    },

    async getQuote(_context) {
        return {
            providerName:     'mock',
            price:            45.00,
            currency:         'INR',
            breakdown:        { base: 35, fuel: 5, gst: 5 },
            estimatedMinutes: 30,
            validUntil:       new Date(Date.now() + 3600 * 1000),
        };
    },

    mapStatus(providerStatus) {
        const MAP = {
            'PICKUP SCHEDULED': 'processing',
            'OUT FOR DELIVERY': 'shipped',
            'DELIVERED':        'delivered',
            'CANCELLED':        'cancelled',
        };
        return MAP[String(providerStatus).toUpperCase()] ?? null;
    },

    parseWebhookPayload(rawBody, _headers) {
        try {
            const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
            return JSON.parse(body);
        } catch {
            return {};
        }
    },

    verifyWebhookSignature(rawBody, headers) {
        // For mock: accept any request that has x-mock-signature: "valid"
        // OR skip signature checking entirely (useful in automated tests)
        const sig = String(headers['x-mock-signature'] || '').toLowerCase();
        return sig === 'valid' || sig === '';
    },

    async refreshToken() {
        // no-op
    },
};

export default mockDeliveryProvider;
