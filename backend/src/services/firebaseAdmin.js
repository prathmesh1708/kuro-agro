import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isInitialized = false;
let messagingInstance = null;

export const initializeFirebase = () => {
    if (isInitialized) return;
    
    try {
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './src/config/firebase-service-account.json';
        const absolutePath = path.resolve(serviceAccountPath);
        
        let serviceAccount = null;
        
        if (fs.existsSync(absolutePath)) {
            serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
        } else if (process.env.FIREBASE_CONFIG || process.env.FIREBASE_SERVICE_ACCOUNT) {
            serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG || process.env.FIREBASE_SERVICE_ACCOUNT);
        }

        if (serviceAccount) {
            const app = initializeApp({
                credential: cert(serviceAccount)
            });
            messagingInstance = getMessaging(app);
            isInitialized = true;
            console.log('✅ Firebase Admin SDK initialized successfully');
        } else {
            console.warn('⚠️ Firebase Admin service account file or config not found. Push notifications will be disabled.');
        }
    } catch (error) {
        console.error('❌ Error initializing Firebase Admin:', error);
    }
};

// Auto-initialize when service is loaded
initializeFirebase();

export const sendPushNotification = async (tokens, payload) => {
    if (!isInitialized || !messagingInstance) {
        console.warn('⚠️ Cannot send push notification: Firebase Admin not initialized');
        return null;
    }
    
    try {
        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data || {},
            tokens: tokens,
        };
        
        const response = await messagingInstance.sendEachForMulticast(message);
        console.log(`Successfully sent: ${response.successCount} messages`);
        console.log(`Failed: ${response.failureCount} messages`);
        return response;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};
