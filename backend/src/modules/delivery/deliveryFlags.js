/**
 * deliveryFlags.js
 * ─────────────────
 * Reads DELIVERY_PROVIDER from the environment and exposes helpers used by
 * deliveryManager.js and deliveryProviderRegistry.js.
 *
 * Valid values:
 *   internal   – no third-party provider (default / noop)
 *   shiprocket – Shiprocket logistics
 *   mock       – deterministic stubs for dev / CI
 */

/** Returns the active provider name, normalised to lowercase. */
export function getDeliveryProviderName() {
    return String(process.env.DELIVERY_PROVIDER || 'internal').toLowerCase().trim();
}

/**
 * Returns true when a real third-party provider is configured.
 * "internal" and "mock" are NOT considered "enabled" for the purposes of
 * gating actual outbound API calls.
 */
export function isDeliveryModuleEnabled() {
    const name = getDeliveryProviderName();
    return name !== 'internal' && name !== 'mock';
}

/** Returns the canonical env-level preferred provider (or null for auto). */
export function getPreferredProvider() {
    const name = getDeliveryProviderName();
    return name === 'internal' ? null : name;
}
