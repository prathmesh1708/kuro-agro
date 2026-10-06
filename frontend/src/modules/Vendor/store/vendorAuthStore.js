import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import api from "../../../shared/utils/api";
import { registerFCMToken } from "../../../services/pushNotificationService";
import {
  registerVendor,
  updateVendorProfile,
  forgotVendorPassword,
  verifyVendorResetOTP,
  resetVendorPassword,
} from "../services/vendorService";

export const useVendorAuthStore = create(
  persist(
    (set, get) => ({
      vendor: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      // Send login OTP action
      sendLoginOtp: async (email) => {
        set({ isLoading: true });
        try {
          const response = await api.post("/vendor/auth/send-login-otp", { email });
          set({ isLoading: false });
          return response?.data || response;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Vendor login action — supports phone number or email + password (or OTP fallback)
      login: async (identifier, passwordOrOtp, isOtpMode = false, rememberMe = false) => {
        set({ isLoading: true });
        try {
          const rawIdentifier = String(identifier || '').trim();
          const digitsOnly = rawIdentifier.replace(/\D/g, '');
          const isPhone = digitsOnly.length >= 10 && !rawIdentifier.includes('@');

          const payload = {
            ...(isPhone ? { phone: digitsOnly.slice(-10) } : { email: rawIdentifier.toLowerCase() }),
            ...(isOtpMode ? { otp: passwordOrOtp } : { password: passwordOrOtp }),
          };

          const response = await api.post("/vendor/auth/login", payload);
          const authData = response?.data || {};
          const vendor = authData.vendor;
          const accessToken = authData.accessToken;
          const refreshToken = authData.refreshToken;

          if (!vendor || !accessToken || !refreshToken) {
            throw new Error("Invalid login response from server");
          }

          set({
            vendor,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Store token for vendor API requests
          localStorage.setItem("vendor-token", accessToken);
          localStorage.setItem("vendor-refresh-token", refreshToken);

          // Register FCM token
          registerFCMToken(true).catch((err) => console.log('Vendor FCM registration failed:', err));

          return { success: true, vendor };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Vendor registration action — calls real POST /vendor/auth/register
      // Backend sends an OTP email; vendor is NOT authenticated until OTP verified.
      register: async (vendorData) => {
        set({ isLoading: true });
        try {
          const response = await registerVendor(vendorData);
          // response is already unwrapped by api.js interceptor → response.data
          const data = response?.data ?? response;

          set({ isLoading: false });

          return {
            success: true,
            message:
              data?.message ||
              "Registration successful! Please check your email for the OTP.",
          };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      forgotPassword: async (email) => {
        set({ isLoading: true });
        try {
          const response = await forgotVendorPassword(email);
          const data = response?.data ?? response;
          set({ isLoading: false });
          return { success: true, message: data?.message };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      verifyResetOtp: async (email, otp) => {
        set({ isLoading: true });
        try {
          const response = await verifyVendorResetOTP(email, otp);
          const data = response?.data ?? response;
          set({ isLoading: false });
          return { success: true, message: data?.message };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      resetPassword: async (email, password, confirmPassword) => {
        set({ isLoading: true });
        try {
          const response = await resetVendorPassword(email, password, confirmPassword);
          const data = response?.data ?? response;
          set({ isLoading: false });
          return { success: true, message: data?.message };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Vendor logout action
      logout: () => {
        const refreshToken = localStorage.getItem("vendor-refresh-token");
        if (refreshToken) {
          api.post("/vendor/auth/logout", { refreshToken }).catch(() => {});
        }

        set({
          vendor: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
        localStorage.removeItem("vendor-token");
        localStorage.removeItem("vendor-refresh-token");
      },

      // Update vendor profile — calls real PUT /vendor/auth/profile
      updateProfile: async (profileData) => {
        set({ isLoading: true });
        try {
          const response = await updateVendorProfile(profileData);
          const data = response?.data ?? response;
          // Merge returned vendor data back into state so UI stays in sync
          const updatedVendor =
            data && (data._id || data.id)
              ? data
              : (data?.vendor ?? { ...get().vendor, ...profileData });

          set({
            vendor: updatedVendor,
            isLoading: false,
          });

          return { success: true, vendor: updatedVendor };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Initialize vendor auth state from localStorage
      initialize: () => {
        const token = localStorage.getItem("vendor-token");
        if (token) {
          const storedState = JSON.parse(
            localStorage.getItem("vendor-auth-storage") || "{}"
          );
          const refreshToken = localStorage.getItem("vendor-refresh-token");
          const persistedVendor = storedState.state?.vendor || null;
          if (persistedVendor) {
            set({
              vendor: persistedVendor,
              token,
              refreshToken: refreshToken || null,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        }
      },
    }),
    {
      name: "vendor-auth-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Normalize vendor id to prevent issues when vendor profile is updated directly
const originalSetState = useVendorAuthStore.setState;
useVendorAuthStore.setState = (state, replace) => {
  const nextState = typeof state === "function" ? state(useVendorAuthStore.getState()) : state;
  if (nextState && nextState.vendor) {
    nextState.vendor = {
      ...nextState.vendor,
      id: nextState.vendor.id || nextState.vendor._id,
    };
  }
  return originalSetState(nextState, replace);
};

// Also normalize the initial state loaded from persistence
const current = useVendorAuthStore.getState();
if (current && current.vendor && !current.vendor.id && current.vendor._id) {
  current.vendor.id = current.vendor._id;
}

