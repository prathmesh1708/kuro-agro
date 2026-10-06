import { messaging, getToken, onMessage } from '../firebase';
import { API_BASE_URL } from '../shared/utils/constants';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Register service worker
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('✅ Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      throw error;
    }
  } else {
    throw new Error('Service Workers are not supported');
  }
}

// Request notification permission
async function requestNotificationPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('✅ Notification permission granted');
      return true;
    } else {
      console.log('❌ Notification permission denied');
      return false;
    }
  }
  return false;
}

// Get FCM token
async function getFCMToken() {
  try {
    const registration = await registerServiceWorker();
    
    // Check if browser is Safari or similar and check pushManager availability
    if (!registration.pushManager) {
      console.warn('Push manager is not active on this registration');
      return null;
    }

    await registration.update(); // Update service worker
    
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    
    if (token) {
      console.log('✅ FCM Token obtained:', token);
      return token;
    } else {
      console.log('❌ No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting FCM token:', error);
    throw error;
  }
}

// Helper to get authorization token from localStorage based on role
function getActiveAuthToken() {
  const adminToken = localStorage.getItem('adminToken');
  const vendorToken = localStorage.getItem('vendor-token');
  const deliveryToken = localStorage.getItem('delivery-token');
  const userToken = localStorage.getItem('token');
  
  return adminToken || vendorToken || deliveryToken || userToken;
}

// Register FCM token with backend
async function registerFCMToken(forceUpdate = false) {
  try {
    const savedToken = localStorage.getItem('fcm_token_web');
    if (savedToken && !forceUpdate) {
      console.log('FCM token already registered');
      return savedToken;
    }
    
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('FCM registration skipped: Notification permission denied.');
      return null;
    }
    
    const token = await getFCMToken();
    if (!token) {
      throw new Error('Failed to get FCM token');
    }
    
    const authToken = getActiveAuthToken();
    if (!authToken) {
      console.warn('User is not authenticated. Skipping registration with backend.');
      return token;
    }
    
    const response = await fetch(`${API_BASE_URL}/fcm-tokens/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        token: token,
        platform: 'web'
      })
    });
    
    if (response.ok) {
      localStorage.setItem('fcm_token_web', token);
      console.log('✅ FCM token registered with backend');
      return token;
    } else {
      const errData = await response.json();
      throw new Error(errData.message || 'Failed to register token with backend');
    }
  } catch (error) {
    console.error('❌ Error registering FCM token:', error);
    throw error;
  }
}

// Setup foreground notification handler
function setupForegroundNotificationHandler(handler) {
  try {
    onMessage(messaging, (payload) => {
      console.log('📬 Foreground message received:', payload);
      
      if ('Notification' in window && Notification.permission === 'granted') {
        const title = payload.notification?.title || 'Notification';
        const options = {
          body: payload.notification?.body || '',
          icon: payload.notification?.icon || '/favicon.png',
          data: payload.data
        };
        new Notification(title, options);
      }
      
      if (handler) {
        handler(payload);
      }
    });
  } catch (error) {
    console.error('Error setting up foreground handler:', error);
  }
}

// Initialize push notifications
async function initializePushNotifications() {
  try {
    if ('serviceWorker' in navigator) {
      await registerServiceWorker();
      // If user is already logged in, register token
      if (getActiveAuthToken()) {
        registerFCMToken().catch(err => console.log('Silent token registration failed:', err));
      }
    }
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
}

export {
  initializePushNotifications,
  registerFCMToken,
  setupForegroundNotificationHandler,
  requestNotificationPermission
};
