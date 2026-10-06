/**
 * IDeliveryProvider.js
 * ────────────────────
 * JSDoc-only interface contract.  Not enforced at runtime — acts as the
 * single source of truth for what every provider must implement.
 *
 * All methods must either:
 *   • Return a canonical result object (shapes documented below), OR
 *   • Throw a ProviderError with a machine-readable `code` property.
 *
 * Methods a provider does not support MUST return a safe default value,
 * NOT throw.  Use the noopDeliveryProvider.js stubs as a reference.
 */

/**
 * @typedef {Object} UnifiedShipmentResult
 * @property {string}  externalId      – AWB / tracking number from the provider
 * @property {string}  [trackingUrl]   – Public tracking URL
 * @property {string}  [label]         – Base-64 encoded PDF label
 * @property {string}  providerStatus  – Raw status string returned by provider
 */

/**
 * @typedef {Object} CancelResult
 * @property {boolean} cancelled
 * @property {string}  [reason]
 */

/**
 * @typedef {Object} TrackingInfo
 * @property {string}   providerStatus
 * @property {object}   [location]      – { lat, lng, label }
 * @property {number}   [etaMinutes]
 * @property {Date}     [etaTimestamp]
 * @property {Array}    events          – Raw timeline events from provider
 */

/**
 * @typedef {Object} ETAResult
 * @property {number} etaMinutes
 * @property {Date}   etaTimestamp
 */

/**
 * @typedef {Object} QuoteResult
 * @property {string}  providerName
 * @property {number}  price
 * @property {string}  currency
 * @property {object}  breakdown        – { base, fuel, gst, ... }
 * @property {number}  estimatedMinutes
 * @property {Date}    [validUntil]
 */

/**
 * @typedef {Object} WebhookParseResult
 * @property {string} orderId
 * @property {string} externalId
 * @property {string} providerStatus
 * @property {object} [location]
 * @property {object} meta            – Any extra provider-specific fields
 */

/**
 * @typedef {Object} ShipmentContext
 * @property {string}  orderId
 * @property {string}  orderMongoId
 * @property {object}  pickup          – { name, phone, address, lat, lng, pincode }
 * @property {object}  drop            – { name, phone, address, lat, lng, pincode }
 * @property {Array}   items           – [{ name, qty, weight, value }]
 * @property {string}  paymentMode     – "COD" | "PREPAID"
 * @property {number}  totalValue
 * @property {number}  weight
 * @property {string}  [preferredProvider]
 * @property {string}  idempotencyKey
 * @property {string}  [channelId]     – Shiprocket channel ID
 */

/**
 * @interface IDeliveryProvider
 *
 * @property {string}   name
 *
 * @method createShipment(context: ShipmentContext): Promise<UnifiedShipmentResult>
 * @method cancelShipment(context: ShipmentContext): Promise<CancelResult>
 * @method getTrackingInfo(context: ShipmentContext): Promise<TrackingInfo>
 * @method getETA(context: ShipmentContext): Promise<ETAResult>
 * @method getQuote(context: ShipmentContext): Promise<QuoteResult>
 * @method mapStatus(providerStatus: string): string|null
 * @method parseWebhookPayload(rawBody: string|Buffer, headers: object): WebhookParseResult
 * @method verifyWebhookSignature(rawBody: string|Buffer, headers: object): boolean
 * @method refreshToken(): Promise<void>
 */

export const DELIVERY_PROVIDER_INTERFACE = {
    name: String,
    createShipment: Function,
    cancelShipment: Function,
    getTrackingInfo: Function,
    getETA: Function,
    getQuote: Function,
    mapStatus: Function,
    parseWebhookPayload: Function,
    verifyWebhookSignature: Function,
    refreshToken: Function,
};

export default DELIVERY_PROVIDER_INTERFACE;
