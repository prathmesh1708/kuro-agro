/**
 * deliveryProviderRegistry.js
 * ────────────────────────────
 * Map-based registry of all known delivery providers.
 * Returns the active provider based on the DELIVERY_PROVIDER env var.
 *
 * To add a new provider:
 *   1. Create providers/myProvider/myProvider.js (implements IDeliveryProvider)
 *   2. Import it here and add to REGISTRY
 *   3. Set DELIVERY_PROVIDER=myprovider in .env
 */

import { getDeliveryProviderName } from './deliveryFlags.js';
import { noopDeliveryProvider }    from './providers/noopDeliveryProvider.js';
import { mockDeliveryProvider }    from './providers/mockDeliveryProvider.js';
import { shiprocketProvider }      from './providers/shiprocket/shiprocketProvider.js';

/** Master registry — add new providers here. */
const REGISTRY = new Map([
    ['internal',   noopDeliveryProvider],
    ['noop',       noopDeliveryProvider],
    ['mock',       mockDeliveryProvider],
    ['shiprocket', shiprocketProvider],
]);

/**
 * Returns the provider registered under the given name.
 * Falls back to noopDeliveryProvider if the name is not found.
 *
 * @param {string} [name] – overrides the env-level default
 * @returns {IDeliveryProvider}
 */
export function getRegisteredProvider(name) {
    const key = String(name || getDeliveryProviderName()).toLowerCase().trim();
    return REGISTRY.get(key) || noopDeliveryProvider;
}

/**
 * Returns the active provider as determined by DELIVERY_PROVIDER env var.
 * @returns {IDeliveryProvider}
 */
export function getActiveProvider() {
    return getRegisteredProvider(getDeliveryProviderName());
}

/**
 * Returns all registered provider names.
 * @returns {string[]}
 */
export function getRegisteredProviderNames() {
    return [...REGISTRY.keys()];
}

export default { getRegisteredProvider, getActiveProvider, getRegisteredProviderNames };
