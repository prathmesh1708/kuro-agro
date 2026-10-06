/**
 * ProviderTokenStore.model.js
 * ────────────────────────────
 * Stores OAuth / bearer tokens for third-party delivery providers.
 *
 * One document per provider (unique on providerName).
 * The shiprocketClient reads from here on startup and writes back on refresh.
 *
 * SECURITY:
 *   • Tokens are stored in MongoDB — ensure your Atlas cluster is private.
 *   • Never log the accessToken field.
 *   • Rotate proactively (every 23h for Shiprocket) rather than waiting for 401.
 */

import mongoose from 'mongoose';

const providerTokenStoreSchema = new mongoose.Schema(
    {
        providerName: {
            type:     String,
            required: true,
            unique:   true,
            lowercase: true,
            trim:     true,
        },
        accessToken: {
            type:   String,
            select: false,   // never returned in default queries
        },
        refreshToken: {
            type:   String,
            select: false,
        },
        expiresAt: { type: Date },
        updatedAt: { type: Date, default: () => new Date() },
    },
    {
        // No auto-timestamps so updatedAt is managed manually
        // (avoids confusion with token rotation timing)
        timestamps: false,
    }
);

const ProviderTokenStore = mongoose.model('ProviderTokenStore', providerTokenStoreSchema);
export { ProviderTokenStore };
export default ProviderTokenStore;
