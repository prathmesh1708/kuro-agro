/**
 * deliveryManager.js
 * ───────────────────
 * PUBLIC FACADE — the only file any other module should import for
 * delivery operations.  Callers never touch providers or the registry directly.
 *
 * Usage:
 *   import { createShipment, getQuote } from '../../modules/delivery/deliveryManager.js';
 */

import { getActiveProvider, getRegisteredProvider } from './deliveryProviderRegistry.js';
import { isDeliveryModuleEnabled, getDeliveryProviderName } from './deliveryFlags.js';
import { providerStatusToOrderStatus } from './deliveryStatusMapping.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves the provider to use for a given context.
 * If context.preferredProvider is set, use that; otherwise use the env default.
 */
function resolveProvider(context) {
    const name = context?.preferredProvider || null;
    return name ? getRegisteredProvider(name) : getActiveProvider();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true when a real third-party provider is active.
 * Use this to gate outbound API calls.
 */
export function isDeliveryEnabled() {
    return isDeliveryModuleEnabled();
}

/**
 * Returns the name of the currently active provider (e.g. "shiprocket").
 */
export function getActiveProviderName() {
    return getDeliveryProviderName();
}

/**
 * Create a shipment with the active (or preferred) provider.
 *
 * @param {ShipmentContext} context
 * @returns {Promise<UnifiedShipmentResult|null>} — null if delivery module is disabled
 */
export async function createShipment(context) {
    const provider = resolveProvider(context);
    return provider.createShipment(context);
}

/**
 * Assign courier, generate AWB and schedule pickup for an already created shipment.
 *
 * @param {object} context
 * @returns {Promise<UnifiedShipmentResult|null>}
 */
export async function assignAwbAndPickup(context) {
    const provider = resolveProvider(context);
    if (typeof provider.assignAwbAndPickup === 'function') {
        return provider.assignAwbAndPickup(context);
    }
    return provider.createShipment(context);
}

/**
 * Cancel a shipment with the provider.
 *
 * @param {ShipmentContext} context – must include externalShipmentId or shiprocketOrderId
 * @returns {Promise<CancelResult|null>}
 */
export async function cancelShipment(context) {
    const provider = resolveProvider(context);
    return provider.cancelShipment(context);
}

/**
 * Fetch live tracking information from the provider.
 *
 * @param {ShipmentContext} context – must include externalShipmentId (AWB)
 * @returns {Promise<TrackingInfo|null>}
 */
export async function getTrackingInfo(context) {
    const provider = resolveProvider(context);
    return provider.getTrackingInfo(context);
}

/**
 * Get ETA estimate from the provider.
 *
 * @param {ShipmentContext} context
 * @returns {Promise<ETAResult|null>}
 */
export async function getETA(context) {
    const provider = resolveProvider(context);
    return provider.getETA(context);
}

/**
 * Get a delivery quote.
 * NOTE: Quote does NOT require the module to be "enabled" — always works.
 *
 * @param {ShipmentContext} context
 * @returns {Promise<QuoteResult>}
 */
export async function getQuote(context) {
    const provider = resolveProvider(context);
    return provider.getQuote(context);
}

/**
 * Translate a provider's raw status to your canonical Order.status value.
 *
 * @param {string} providerName
 * @param {string} rawStatus
 * @returns {string|null} – null if the status is unknown / unmapped
 */
export function normalizeProviderStatus(providerName, rawStatus) {
    return providerStatusToOrderStatus(providerName, rawStatus);
}

/**
 * Verify a webhook signature using the correct provider's verifier.
 *
 * @param {string}        providerName
 * @param {string|Buffer} rawBody
 * @param {object}        headers
 * @returns {boolean}
 */
export function verifyWebhookSignature(providerName, rawBody, headers) {
    const provider = getRegisteredProvider(providerName);
    return provider.verifyWebhookSignature(rawBody, headers);
}

/**
 * Parse a raw webhook payload using the correct provider's parser.
 *
 * @param {string}        providerName
 * @param {string|Buffer} rawBody
 * @param {object}        headers
 * @returns {WebhookParseResult}
 */
export function parseWebhookPayload(providerName, rawBody, headers) {
    const provider = getRegisteredProvider(providerName);
    return provider.parseWebhookPayload(rawBody, headers);
}

/**
 * Register a pickup warehouse location with the delivery provider.
 *
 * @param {object} locationData
 * @param {string} [preferredProvider]
 * @returns {Promise<object>}
 */
export async function addPickupLocation(locationData, preferredProvider) {
    const provider = resolveProvider({ preferredProvider });
    if (typeof provider.addPickupLocation === 'function') {
        return provider.addPickupLocation(locationData);
    }
    return { success: true, pickupLocationName: locationData.name || 'Primary' };
}

/**
 * Get all registered pickup locations from provider.
 */
export async function getPickupLocations(preferredProvider) {
    const provider = resolveProvider({ preferredProvider });
    if (typeof provider.getPickupLocations === 'function') {
        return provider.getPickupLocations();
    }
    return [];
}

/**
 * Force a token refresh for the active provider.
 * Call this from an admin action or a scheduled cron.
 */
export async function refreshProviderToken(providerName) {
    const provider = getRegisteredProvider(providerName || getDeliveryProviderName());
    return provider.refreshToken();
}

export default {
    isDeliveryEnabled,
    getActiveProviderName,
    createShipment,
    cancelShipment,
    getTrackingInfo,
    getETA,
    getQuote,
    addPickupLocation,
    getPickupLocations,
    normalizeProviderStatus,
    verifyWebhookSignature,
    parseWebhookPayload,
    refreshProviderToken,
};
