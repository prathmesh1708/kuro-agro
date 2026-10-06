/**
 * deliveryWebhookRoutes.js
 * ─────────────────────────
 * Webhook ingestion endpoint for all third-party delivery providers.
 *
 * Route: POST /api/webhooks/delivery/:provider
 *
 * CRITICAL: This router uses express.raw() — raw body capture MUST happen
 * before express.json() parses the body.  Mount this router in app.js
 * BEFORE the global express.json() middleware.
 *
 * Security:
 *   • Signature is verified per-provider before any processing
 *   • Always returns 200 to the provider (prevents retries for our errors)
 *   • 401 only on signature mismatch (tells provider something is wrong on our side)
 *   • Processing is fully async — response sent before DB writes
 */

import { Router }   from 'express';
import { verifyWebhookSignature, parseWebhookPayload } from '../modules/delivery/deliveryManager.js';
import { processWebhook }   from '../modules/delivery/webhooks/webhookProcessor.js';
import { getRegisteredProvider, getRegisteredProviderNames } from '../modules/delivery/deliveryProviderRegistry.js';

const router = Router();

// ─── POST /api/webhooks/delivery/:provider ────────────────────────────────────
router.post(
    '/delivery/:provider',
    // Capture raw body BEFORE any JSON parser touches it (needed for HMAC)
    (req, res, next) => {
        // If body is already a Buffer (raw middleware applied globally), skip
        if (Buffer.isBuffer(req.body)) return next();
        // Otherwise collect chunks manually
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            req.rawBody = Buffer.concat(chunks);
            next();
        });
        req.on('error', next);
    },
    async (req, res) => {
        let providerName = String(req.params.provider || '').toLowerCase();

        // Shiprocket prohibits keywords like "shiprocket" in webhook URLs.
        // Map clean aliases to "shiprocket".
        if (['partner', 'events', 'carrier', 'v1', 'fulfillment'].includes(providerName)) {
            providerName = 'shiprocket';
        }

        // 1. Guard: provider must be registered
        const knownProviders = getRegisteredProviderNames().filter(
            (p) => p !== 'internal' && p !== 'noop'
        );
        if (!knownProviders.includes(providerName)) {
            // Return 200 with a body — don't leak which providers exist
            return res.status(200).json({ received: false, reason: 'unknown provider' });
        }

        // 2. Use rawBody (from inline middleware or express.raw applied upstream)
        const rawBody = req.rawBody || req.body;

        // 3. Verify signature
        const isValid = verifyWebhookSignature(providerName, rawBody, req.headers);
        if (!isValid) {
            console.warn(`[webhook] Signature invalid for provider "${providerName}" — rejecting`);
            return res.status(401).end();
        }

        // 4. Respond immediately — process asynchronously
        res.status(200).json({ received: true });

        // 5. Process in background (do not await in the request handler)
        setImmediate(async () => {
            try {
                await processWebhook(providerName, rawBody, req.headers);
            } catch (err) {
                console.error(`[webhook] Unhandled error processing ${providerName} webhook:`, err);
            }
        });
    }
);

export default router;
