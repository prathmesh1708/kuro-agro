import https from 'https';
import http from 'http';
import { sendEmail, sendOTPEmail } from './email.service.js';

/**
 * Sends SMS via configured SMS Provider (SMS India Hub / Fast2SMS / Twilio / Console)
 * Falls back to Email delivery and console logging when SMS gateway credentials are not configured or fail.
 * 
 * @param {Object} options
 * @param {string} options.phone - 10-digit recipient phone number
 * @param {string} options.otp - 6-digit OTP code
 * @param {string} [options.email] - Optional recipient email address for fallback delivery
 */
export const sendSMS = async ({ phone, otp, email }) => {
    const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10);
    const defaultMessage = `Your Raathi verification code is ${otp}. Valid for 10 minutes.`;

    const provider = (process.env.SMS_PROVIDER || 'console').toLowerCase();
    let smsSent = false;

    // 1. Try SMS India Hub if configured (primary Indian gateway if set)
    if (provider === 'smsindiahub' || provider === 'sms_india_hub' || process.env.SMS_INDIA_HUB_API_KEY) {
        const apiKey = process.env.SMS_INDIA_HUB_API_KEY;
        if (apiKey) {
            try {
                await sendSMSIndiaHub({ apiKey, phone: normalizedPhone, otp, message: defaultMessage });
                smsSent = true;
                console.log(`[SMS] SMS India Hub sent successfully to +91${normalizedPhone}`);
            } catch (err) {
                console.error(`[SMS Error] SMS India Hub failed for ${normalizedPhone}:`, err.message);
            }
        }
    }

    // 2. Try Fast2SMS Provider if configured
    if (!smsSent && (provider === 'fast2sms' || process.env.FAST2SMS_API_KEY)) {
        const apiKey = process.env.FAST2SMS_API_KEY;
        if (apiKey) {
            try {
                await sendFast2SMS({ apiKey, phone: normalizedPhone, message: defaultMessage, otp });
                smsSent = true;
                console.log(`[SMS] Fast2SMS sent successfully to +91${normalizedPhone}`);
            } catch (err) {
                console.error(`[SMS Error] Fast2SMS failed for ${normalizedPhone}:`, err.message);
            }
        }
    }

    // 3. Try Twilio Provider if configured
    if (!smsSent && (provider === 'twilio' || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN))) {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const auth = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;
        if (sid && auth && fromNumber) {
            try {
                await sendTwilioSMS({ sid, auth, fromNumber, phone: normalizedPhone, message: defaultMessage });
                smsSent = true;
                console.log(`[SMS] Twilio SMS sent successfully to +91${normalizedPhone}`);
            } catch (err) {
                console.error(`[SMS Error] Twilio SMS failed for ${normalizedPhone}:`, err.message);
            }
        }
    }

    // Always log OTP to server console
    console.log(`[PHONE OTP] OTP for +91${normalizedPhone} is: ${otp}`);

    // 4. Dispatch Email OTP backup if user has a valid non-dummy email address
    if (email && !email.endsWith('@raathi.com')) {
        sendOTPEmail({
            to: email,
            otp,
            title: 'Login OTP Verification',
            userType: 'Customer',
        }).catch((err) => {
            console.warn(`[SMS Fallback Email] Failed to send email to ${email}: ${err.message}`);
        });
    }

    return { success: true, smsSent };
};

/**
 * SMS India Hub API integration (DLT Compliant SMS Gateway)
 */
export function sendSMSIndiaHub({ apiKey, phone, otp, message }) {
    return new Promise((resolve, reject) => {
        const senderId = process.env.SMS_INDIA_HUB_SENDER_ID || '';
        const entityId = process.env.SMS_INDIA_HUB_ENTITY_ID || '';
        const templateId = process.env.SMS_INDIA_HUB_TEMPLATE_ID || '';
        const channel = process.env.SMS_INDIA_HUB_CHANNEL || '2'; // 2 = Transactional / OTP
        const route = process.env.SMS_INDIA_HUB_ROUTE || '1'; // Default route
        const baseUrl = process.env.SMS_INDIA_HUB_BASE_URL || 'https://cloud.smsindiahub.in/api/mt/SendSMS';

        // Prepare message text (support DLT template string with {#var#}, ##var##, {{otp}} placeholders)
        let text = message;
        if (process.env.SMS_INDIA_HUB_TEMPLATE_TEXT) {
            const template = process.env.SMS_INDIA_HUB_TEMPLATE_TEXT;
            const appName = process.env.FROM_NAME || 'Raathi';

            // Find all variable placeholder patterns: {#var#}, {#var1#}, ##var##, etc.
            const varPattern = /({#var\d*#}|##var##|{{var\d*}}|{#val\d*#})/gi;
            const matches = template.match(varPattern);

            if (matches && matches.length > 1) {
                // Multi-variable template: 1st var is app/brand name, subsequent var is OTP
                let varIndex = 0;
                text = template.replace(varPattern, () => {
                    varIndex++;
                    return varIndex === 1 ? appName : otp;
                });
            } else if (matches && matches.length === 1) {
                text = template.replace(varPattern, otp);
            } else {
                text = template
                    .replace(/{#var#}/gi, otp)
                    .replace(/##var##/gi, otp)
                    .replace(/{{otp}}/gi, otp)
                    .replace(/{otp}/gi, otp)
                    .replace(/{%OTP%}/gi, otp);
            }
        }

        const url = new URL(baseUrl);
        url.searchParams.set('APIKey', apiKey);
        if (senderId) url.searchParams.set('senderid', senderId);
        url.searchParams.set('channel', channel);
        url.searchParams.set('DCS', '0');
        url.searchParams.set('flashsms', '0');
        
        // Indian 10-digit or 91-prefixed number
        const targetNumber = phone.length === 10 ? `91${phone}` : phone;
        url.searchParams.set('number', targetNumber);
        url.searchParams.set('text', text);
        if (route) url.searchParams.set('route', route);
        if (entityId) url.searchParams.set('EntityId', entityId);
        if (templateId) url.searchParams.set('dlttemplateid', templateId);

        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        const req = client.get(url.toString(), (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(body);
                        if (parsed.ErrorCode && parsed.ErrorCode !== '000' && parsed.ErrorCode !== 0) {
                            return reject(new Error(`SMS India Hub Error [${parsed.ErrorCode}]: ${parsed.ErrorMessage || body}`));
                        }
                        resolve(parsed);
                    } catch {
                        if (body.toLowerCase().includes('error') || body.toLowerCase().includes('invalid')) {
                            return reject(new Error(`SMS India Hub response: ${body}`));
                        }
                        resolve(body);
                    }
                } else {
                    reject(new Error(`SMS India Hub responded status ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.end();
    });
}

/**
 * Fast2SMS API integration (Popular Indian SMS Gateway)
 */
function sendFast2SMS({ apiKey, phone, message, otp }) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            route: 'otp',
            variables_values: otp,
            numbers: phone,
        });

        const req = https.request(
            'https://www.fast2sms.com/dev/bulkV2',
            {
                method: 'POST',
                headers: {
                    authorization: apiKey,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
            },
            (res) => {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    } else {
                        reject(new Error(`Fast2SMS responded status ${res.statusCode}: ${body}`));
                    }
                });
            }
        );

        req.on('error', (err) => reject(err));
        req.write(postData);
        req.end();
    });
}

/**
 * Twilio REST API integration
 */
function sendTwilioSMS({ sid, auth, fromNumber, phone, message }) {
    return new Promise((resolve, reject) => {
        const toNumber = phone.startsWith('+') ? phone : `+91${phone}`;
        const params = new URLSearchParams({
            To: toNumber,
            From: fromNumber,
            Body: message,
        }).toString();

        const authHeader = 'Basic ' + Buffer.from(`${sid}:${auth}`).toString('base64');

        const req = https.request(
            `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
            {
                method: 'POST',
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(params),
                },
            },
            (res) => {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    } else {
                        reject(new Error(`Twilio responded status ${res.statusCode}: ${body}`));
                    }
                });
            }
        );

        req.on('error', (err) => reject(err));
        req.write(params);
        req.end();
    });
}
