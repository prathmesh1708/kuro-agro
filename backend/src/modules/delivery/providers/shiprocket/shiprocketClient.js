/**
 * shiprocketClient.js
 * ────────────────────
 * Low-level HTTP client for the Shiprocket API v1.
 *
 * Responsibilities:
 *   • Token fetch / lazy refresh (tokens stored in ProviderTokenStore model)
 *   • In-memory token cache so we don't hit the DB on every call
 *   • 401 → delete cached token → refresh → retry once
 *   • Rate limiting: in-memory sliding window counter (500 req/min per Shiprocket docs)
 *   • Wraps all errors in ProviderError with a machine-readable code
 */

import https from 'https';
import http  from 'http';
import { URL } from 'url';

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

// ─── In-memory token cache ────────────────────────────────────────────────────
let _cachedToken     = null;
let _cachedExpiresAt = null;

// ─── In-memory rate limit counter ────────────────────────────────────────────
// Shiprocket allows 500 req/min.  We track count in a rolling 60-second window.
const RATE_LIMIT = 500;
const RATE_WINDOW_MS = 60_000;
let _rlCount     = 0;
let _rlWindowStart = Date.now();

function checkRateLimit() {
    const now = Date.now();
    if (now - _rlWindowStart > RATE_WINDOW_MS) {
        _rlCount       = 0;
        _rlWindowStart = now;
    }
    _rlCount++;
    if (_rlCount > RATE_LIMIT) {
        throw new ProviderError('RATE_LIMITED', `Shiprocket rate limit exceeded (${RATE_LIMIT} req/min)`);
    }
}

// ─── ProviderError ────────────────────────────────────────────────────────────
export class ProviderError extends Error {
    constructor(code, message, cause) {
        super(message || code);
        this.name  = 'ProviderError';
        this.code  = code;
        this.cause = cause || null;
    }
}

// ─── Minimal fetch (Node built-in https — no axios dependency needed) ─────────
function httpsRequest(method, urlStr, data, headers) {
    return new Promise((resolve, reject) => {
        const parsed    = new URL(urlStr);
        const isHttps   = parsed.protocol === 'https:';
        const transport = isHttps ? https : http;
        const body      = data ? JSON.stringify(data) : null;

        const options = {
            hostname: parsed.hostname,
            port:     parsed.port || (isHttps ? 443 : 80),
            path:     parsed.pathname + parsed.search,
            method:   method.toUpperCase(),
            headers: {
                'Content-Type':  'application/json',
                'Accept':        'application/json',
                ...headers,
                ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
            },
        };

        const req = transport.request(options, (res) => {
            let raw = '';
            res.on('data', (chunk) => (raw += chunk));
            res.on('end', () => {
                let parsed;
                try { parsed = JSON.parse(raw); } catch { parsed = raw; }
                resolve({ status: res.statusCode, data: parsed });
            });
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// ─── Token helpers ────────────────────────────────────────────────────────────

/** Lazy-loads ProviderTokenStore to avoid circular-import issues at module load time. */
async function getTokenStore() {
    const { default: ProviderTokenStore } = await import('../../../../models/ProviderTokenStore.model.js');
    return ProviderTokenStore;
}

async function fetchTokenFromDB() {
    const Store = await getTokenStore();
    return Store.findOne({ providerName: 'shiprocket' }).select('+accessToken +refreshToken +expiresAt').lean();
}

async function persistToken(accessToken, expiresAt) {
    const Store = await getTokenStore();
    await Store.findOneAndUpdate(
        { providerName: 'shiprocket' },
        { accessToken, expiresAt, updatedAt: new Date() },
        { upsert: true, new: true }
    );
    _cachedToken     = accessToken;
    _cachedExpiresAt = expiresAt;
}

async function doRefreshToken() {
    const email    = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;

    if (!email || !password) {
        throw new ProviderError(
            'MISSING_CREDENTIALS',
            'SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD must be set in .env'
        );
    }

    const res = await httpsRequest('POST', `${BASE_URL}/auth/login`, { email, password }, {});

    if (res.status !== 200 || !res.data?.token) {
        throw new ProviderError(
            'AUTH_FAILED',
            `Shiprocket auth failed: ${JSON.stringify(res.data)}`
        );
    }

    // Shiprocket tokens are valid for 24 hours; cache for 23 to be safe.
    const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000);
    await persistToken(res.data.token, expiresAt);
    return res.data.token;
}

async function getToken(forceRefresh = false) {
    if (!forceRefresh) {
        // 1. In-memory cache (fast path)
        if (_cachedToken && _cachedExpiresAt && new Date(_cachedExpiresAt) > new Date()) {
            return _cachedToken;
        }

        // 2. DB cache
        const stored = await fetchTokenFromDB();
        if (stored?.accessToken && stored.expiresAt && new Date(stored.expiresAt) > new Date()) {
            _cachedToken     = stored.accessToken;
            _cachedExpiresAt = stored.expiresAt;
            return stored.accessToken;
        }
    }

    // 3. Fetch fresh token
    return doRefreshToken();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Make an authenticated request to the Shiprocket API.
 * Automatically fetches / refreshes the token and retries once on 401.
 *
 * @param {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'} method
 * @param {string} path  – relative path, e.g. '/orders/create/adhoc'
 * @param {object} [data] – request body (for POST/PUT)
 * @returns {Promise<object>} – parsed JSON response body
 */
export async function shiprocketRequest(method, path, data) {
    checkRateLimit();

    const token = await getToken();
    let res;

    try {
        res = await httpsRequest(method, `${BASE_URL}${path}`, data, {
            Authorization: `Bearer ${token}`,
        });
    } catch (err) {
        throw new ProviderError('NETWORK_ERROR', `Shiprocket network error: ${err.message}`, err);
    }

    // 401 → force refresh, retry once
    if (res.status === 401) {
        _cachedToken     = null;
        _cachedExpiresAt = null;

        // Remove stale token from DB
        try {
            const Store = await getTokenStore();
            await Store.deleteOne({ providerName: 'shiprocket' });
        } catch { /* best-effort */ }

        const freshToken = await doRefreshToken();
        try {
            res = await httpsRequest(method, `${BASE_URL}${path}`, data, {
                Authorization: `Bearer ${freshToken}`,
            });
        } catch (err) {
            throw new ProviderError('NETWORK_ERROR', `Shiprocket network error (retry): ${err.message}`, err);
        }
    }

    if (res.status >= 400) {
        const errorMsg = res.data?.message || (res.data?.errors ? JSON.stringify(res.data.errors) : (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)));
        throw new ProviderError(
            'REQUEST_FAILED',
            errorMsg || `Shiprocket ${method} ${path} failed with status ${res.status}`
        );
    }

    return res.data;
}

/** Force a token refresh — exposed for the /refresh admin endpoint or scheduled jobs. */
export async function refreshShiprocketToken() {
    _cachedToken     = null;
    _cachedExpiresAt = null;
    return doRefreshToken();
}

export default { shiprocketRequest, refreshShiprocketToken, ProviderError };
