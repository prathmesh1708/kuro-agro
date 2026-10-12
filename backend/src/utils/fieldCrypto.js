import crypto from 'crypto';

// Encryption for sensitive farmer identifiers (Aadhaar).
// Set FIELD_ENCRYPTION_KEY before the first real registration: data encrypted with one key
// cannot be read with another. Falls back to JWT_SECRET so local setups work without extra config.

let warned = false;

const getKey = () => {
    const secret = process.env.FIELD_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!secret) throw new Error('FIELD_ENCRYPTION_KEY is not set.');
    if (!process.env.FIELD_ENCRYPTION_KEY && !warned) {
        warned = true;
        console.warn('[fieldCrypto] FIELD_ENCRYPTION_KEY is not set; falling back to JWT_SECRET. Set it before going live.');
    }
    return crypto.createHash('sha256').update(String(secret)).digest();
};

/** AES-256-GCM; returns "iv.tag.ciphertext" in base64. */
export const encryptField = (plain) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString('base64')).join('.');
};

export const decryptField = (payload) => {
    if (!payload) return '';
    const [iv, tag, ciphertext] = String(payload).split('.').map((part) => Buffer.from(part, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};

/** Keyed hash for duplicate checks; a plain hash of a 12-digit number could be brute-forced. */
export const hashField = (plain) => crypto.createHmac('sha256', getKey()).update(String(plain)).digest('hex');

export const maskAadhaar = (last4) => (last4 ? `XXXX XXXX ${last4}` : '');
