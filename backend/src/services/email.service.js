import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

let _transporter = null;

export const getTransporter = () => {
    if (_transporter) return _transporter;

    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const isSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : '';

    _transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: smtpPort,
        secure: isSecure,
        auth: {
            user: user,
            pass: pass,
        },
        tls: {
            rejectUnauthorized: false,
        },
        connectionTimeout: 10000, // 10s connection timeout
        greetingTimeout: 10000,   // 10s greeting timeout
        socketTimeout: 15000,     // 15s socket activity timeout
        pool: true,               // use pooled connections for efficiency in production
        maxConnections: 5,
        maxMessages: 100,
    });

    if (user) {
        _transporter.verify((error) => {
            if (error) {
                console.warn(`[SMTP Warning] Failed to connect to mail server (${process.env.SMTP_HOST || 'smtp.gmail.com'}:${smtpPort}):`, error.message);
            } else {
                console.log(`✅ [SMTP] Mail server connected successfully (${user})`);
            }
        });
    } else {
        console.warn(`⚠️ [SMTP Warning] SMTP_USER is not set in environment variables! Emails will not be sent.`);
    }

    return _transporter;
};

// Initial run
getTransporter();


/**
 * Send an email
 * @param {Object} options - { to, subject, html, text }
 */
export const sendEmail = async ({ to, subject, html, text }) => {
    const senderEmail = process.env.SMTP_USER || process.env.FROM_EMAIL;
    const mailOptions = {
        from: `"${process.env.FROM_NAME || 'Rathi'}" <${senderEmail}>`,
        replyTo: senderEmail,
        to,
        subject,
        html,
        text,
    };

    const info = await getTransporter().sendMail(mailOptions);
    return info;
};


/**
 * Send branded HTML OTP email
 */
export const sendOTPEmail = async ({ to, otp, title = 'Verification Code', userType = 'Account' }) => {
    const appName = process.env.FROM_NAME || 'Rathi';
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; color: #1e293b;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
            <!-- Header -->
            <tr>
                <td style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 28px 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">${appName}</h1>
                    <p style="color: #e0e7ff; margin: 6px 0 0 0; font-size: 14px;">${title}</p>
                </td>
            </tr>
            <!-- Content -->
            <tr>
                <td style="padding: 32px 28px;">
                    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-top: 0;">Hello,</p>
                    <p style="font-size: 15px; line-height: 1.6; color: #334155;">Use the following One-Time Password (OTP) to complete your ${userType} verification:</p>
                    
                    <!-- OTP Box -->
                    <div style="text-align: center; margin: 28px 0;">
                        <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; color: #4f46e5; letter-spacing: 8px; background-color: #eef2ff; padding: 14px 28px; border-radius: 10px; display: inline-block; border: 1px dashed #6366f1;">
                            ${otp}
                        </span>
                    </div>

                    <p style="font-size: 14px; color: #64748b; text-align: center; margin-bottom: 24px;">
                        ⏰ This code is valid for <strong>10 minutes</strong>. Do not share it with anyone.
                    </p>

                    <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

                    <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
                        If you did not request this verification code, please ignore this email or contact support if you have concerns.
                    </p>
                </td>
            </tr>
            <!-- Footer -->
            <tr>
                <td style="background-color: #f8fafc; padding: 16px 28px; text-align: center; border-top: 1px solid #f1f5f9;">
                    <p style="font-size: 12px; color: #94a3b8; margin: 0;">&copy; ${new Date().getFullYear()} ${appName} Parivaar. All rights reserved.</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    return sendEmail({
        to,
        subject: `[${appName}] ${title} - ${otp}`,
        text: `Your ${userType} verification code is ${otp}. It expires in 10 minutes.`,
        html: htmlContent,
    });
};

export const sendOrderConfirmationEmail = async (order, userEmail) => {
    const to = userEmail || order?.shippingAddress?.email || order?.guestInfo?.email;
    if (!to) return;
    const { getOrderStatusEmailContent } = await import('./emailTemplates/orderStatusTemplates.js');
    const { subject, html, text } = getOrderStatusEmailContent(order, 'processing');
    await sendEmail({ to, subject, html, text });
};

