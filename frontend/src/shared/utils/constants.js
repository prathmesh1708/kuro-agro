// API Configuration
const getApiBaseUrl = () => {
  // If running in production
  if (import.meta.env.PROD) {
    const configuredUrl = import.meta.env.VITE_API_BASE_URL;
    
    // Check if we have a valid, non-localhost, non-placeholder production URL
    if (
      configuredUrl &&
      !configuredUrl.includes('localhost') &&
      !configuredUrl.includes('127.0.0.1') &&
      !configuredUrl.includes('your-production-backend.com')
    ) {
      return configuredUrl;
    }
    
    // Otherwise, dynamically fallback to the host's /api if running on a real domain
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `${window.location.origin}/api`;
    }
  }

  // In development, or if fallback rules do not apply (e.g. testing production build locally)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  return 'http://localhost:5000/api';
};

export const API_BASE_URL = getApiBaseUrl();


// App Constants
export const APP_NAME = 'Appzeto multi vendor E-commerce';
export const APP_DESCRIPTION = 'Multi Vendor E-commerce Platform';

// Animation Durations
export const ANIMATION_DURATION = {
  FAST: 0.3,
  NORMAL: 0.5,
  SLOW: 0.8,
};

// Breakpoints (matching Tailwind)
export const BREAKPOINTS = {
  xs: 375,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

