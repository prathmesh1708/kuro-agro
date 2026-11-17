import https from 'https';
import http from 'http';

/**
 * Sends an OTP SMS to an Indian mobile number via the configured provider
 * (SMS India Hub, then Fast2SMS, then Twilio). OTPs go to the mobile number only:
 * there is no email fallback.
 *
 * @param {Object} options
 * @param {string} options.phone - 10-digit recipient phone number
 * @param {string} options.otp - 6-digit OTP code
 * @returns {Promise<{ smsSent: boolean }>}
 */
export const sendSMS = async ({ phone, otp }) => {
    const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10);
    const defaultMessage = `Your KuroAgro verification code is ${otp}. Valid for 10 minutes.`;

    const provider = (process.env.SMS_PROVIDER || 'console').toLowerCase();
    let smsSent = false;

    // 1. Try SMS India Hub if configured (primary Indian gateway if set)
    const hubUser = process.env.SMS_INDIA_HUB_USERNAME;
    const hubPassword = process.env.SMS_INDIA_HUB_PASSWORD;
    const hubApiKey = process.env.SMS_INDIA_HUB_API_KEY;
    const hasHubAuth = Boolean((hubUser && hubPassword) || hubApiKey);
    if (provider === 'smsindiahub' || provider === 'sms_india_hub' || hasHubAuth) {
        if (hasHubAuth) {
            try {
                await sendSMSIndiaHub({ apiKey: hubApiKey, user: hubUser, password: hubPassword, phone: normalizedPhone, otp, message: defaultMessage });
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

    // Never write OTPs to production logs.
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[PHONE OTP] OTP for +91${normalizedPhone} is: ${otp}`);
    }

    return { success: smsSent, smsSent };
};

/**
 * SMS India Hub API integration (DLT Compliant SMS Gateway)
 */
export function sendSMSIndiaHub({ apiKey, user, password, phone, otp, message }) {
    return new Promise((resolve, reject) => {
        const senderId = process.env.SMS_INDIA_HUB_SENDER_ID || 'BGADPL';
        const entityId = process.env.SMS_INDIA_HUB_ENTITY_ID || '';
        const templateId = process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID || process.env.SMS_INDIA_HUB_TEMPLATE_ID || '';
        const channel = process.env.SMS_INDIA_HUB_CHANNEL || '2'; // 2 = Transactional / OTP
        const route = process.env.SMS_INDIA_HUB_ROUTE || '1'; // Default route
        const gwid = process.env.SMS_INDIA_HUB_GWID || '2';
        const baseUrl = process.env.SMS_INDIA_HUB_URL || process.env.SMS_INDIA_HUB_BASE_URL || 'http://cloud.smsindiahub.in/vendorsms/pushsms.aspx';

        // Prepare message text (support DLT template string with ${appName}, ${otp}, {#var#}, ##var##, {{otp}} placeholders)
        let text = message;
        if (process.env.SMS_INDIA_HUB_TEMPLATE_TEXT) {
            let template = process.env.SMS_INDIA_HUB_TEMPLATE_TEXT;
            const appName = process.env.FROM_NAME || 'KuroAgro';

            // First handle explicit named placeholders
            template = template
                .replace(/\$\{appName\}/gi, appName)
                .replace(/\$\{otp\}/gi, otp)
                .replace(/\{\{appName\}\}/gi, appName)
                .replace(/\{appName\}/gi, appName)
                .replace(/\{\{otp\}\}/gi, otp)
                .replace(/\{otp\}/gi, otp)
                .replace(/\{%OTP%\}/gi, otp);

            // Handle positional DLT placeholders: {#var#}, ##var##, etc.
            const varPattern = /({#var\d*#}|##var##|{{var\d*}}|{#val\d*#})/gi;
            const matches = template.match(varPattern);

            if (matches && matches.length > 1) {
                // Multi-variable template: 1st var is the app/brand name, the LAST var is the OTP,
                // and any vars in between get SMS_INDIA_HUB_POWERED_BY (e.g. "Welcome to ##var##,
                // powered by ##var##. Your OTP for registration ##var##...").
                const middle = process.env.SMS_INDIA_HUB_POWERED_BY || appName;
                const total = matches.length;
                let varIndex = 0;
                text = template.replace(varPattern, () => {
                    varIndex++;
                    if (varIndex === 1) return appName;
                    if (varIndex === total) return otp;
                    return middle;
                });
            } else if (matches && matches.length === 1) {
                text = template.replace(varPattern, otp);
            } else {
                text = template;
            }
        }

        const url = new URL(baseUrl);
        const targetNumber = phone.length === 10 ? `91${phone}` : phone;
        const isPushSms = url.pathname.includes('pushsms.aspx');

        if (isPushSms) {
            // SMS India Hub vendor pushsms.aspx API (username/password preferred, else APIKey)
            if (user && password) {
                url.searchParams.set('user', user);
                url.searchParams.set('password', password);
            } else {
                url.searchParams.set('APIKey', apiKey);
            }
            url.searchParams.set('msisdn', targetNumber);
            if (senderId) url.searchParams.set('sid', senderId);
            url.searchParams.set('msg', text);
            url.searchParams.set('fl', '0');
            url.searchParams.set('gwid', gwid);
            if (templateId) url.searchParams.set('dlttemplateid', templateId);
            if (entityId) url.searchParams.set('EntityId', entityId);
        } else {
            // SMS India Hub REST SendSMS API
            if (user && password) {
                url.searchParams.set('user', user);
                url.searchParams.set('password', password);
            } else {
                url.searchParams.set('APIKey', apiKey);
            }
            if (senderId) url.searchParams.set('senderid', senderId);
            url.searchParams.set('channel', channel);
            url.searchParams.set('DCS', '0');
            url.searchParams.set('flashsms', '0');
            url.searchParams.set('number', targetNumber);
            url.searchParams.set('text', text);
            if (route) url.searchParams.set('route', route);
            if (entityId) url.searchParams.set('EntityId', entityId);
            if (templateId) url.searchParams.set('dlttemplateid', templateId);
        }

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
                        // pushsms.aspx replies in plain text, e.g. "Failed#Invalid Login" / "Failed#mobile numbers not valid"
                        const lower = body.trim().toLowerCase();
                        if (lower.startsWith('failed') || lower.includes('error') || lower.includes('invalid') || lower.includes('not valid')) {
                            return reject(new Error(`SMS India Hub response: ${body}`));
                        }
                        resolve(body);
                    }
                } else {
                    reject(new Error(`SMS India Hub responded status ${res.statusCode}: ${body}`));
                }
            });
        });

        req.setTimeout(10000, () => {
            req.destroy(new Error('SMS India Hub request timed out after 10s'));
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
