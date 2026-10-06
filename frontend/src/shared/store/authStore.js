import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../utils/api';
import { registerFCMToken } from '../../services/pushNotificationService';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      pendingEmail: null,
      pendingPhone: null,

      // Login action (supports phone number or email + password)
      login: async (identifier, password, rememberMe = false) => {
        set({ isLoading: true });
        try {
          const rawIdentifier = String(identifier || '').trim();
          const digitsOnly = rawIdentifier.replace(/\D/g, '');
          const isPhone = digitsOnly.length >= 10 && !rawIdentifier.includes('@');

          const payload = isPhone
            ? { phone: digitsOnly.slice(-10), password }
            : { email: rawIdentifier.toLowerCase(), password };

          const response = await api.post('/user/auth/login', payload);
          const resData = response?.data ?? response;
          const accessToken = resData?.accessToken;
          const refreshToken = resData?.refreshToken;
          const user = resData?.user;

          if (!accessToken || !refreshToken || !user) {
            throw new Error('Invalid login response from server.');
          }

          set({
            user,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            pendingEmail: null,
            pendingPhone: null,
            isLoading: false,
          });

          localStorage.setItem('token', accessToken);
          localStorage.setItem('refresh-token', refreshToken);

          // Register FCM token
          registerFCMToken(true).catch((err) => console.log('FCM registration failed:', err));

          return { success: true, user };
        } catch (error) {
          const backendMessage = String(
            error?.response?.data?.message ||
            error?.response?.data?.error ||
            error?.message ||
            ''
          ).toLowerCase();
          if (
            backendMessage.includes('not verified') ||
            backendMessage.includes('verify your')
          ) {
            const digits = String(identifier || '').replace(/\D/g, '');
            if (digits.length >= 10) {
              set({ pendingPhone: digits.slice(-10), isLoading: false });
            } else {
              set({ pendingEmail: String(identifier || '').trim().toLowerCase(), isLoading: false });
            }
            throw error;
          }
          set({ isLoading: false });
          throw error;
        }
      },

      // Register action (stores pendingPhone and dispatches SMS OTP)
      register: async (name, email, password, phone) => {
        set({ isLoading: true });
        try {
          const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10);
          const normalizedEmail = String(email || '').trim().toLowerCase();
          const payload = {
            name,
            email: normalizedEmail,
            password,
            phone: normalizedPhone,
          };

          await api.post('/user/auth/register', payload);

          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            pendingEmail: normalizedEmail,
            pendingPhone: normalizedPhone,
            isLoading: false,
          });

          localStorage.removeItem('token');
          localStorage.removeItem('refresh-token');

          return { success: true, email: normalizedEmail, phone: normalizedPhone };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Send OTP to phone
      sendOtpPhone: async (phone) => {
        set({ isLoading: true });
        try {
          const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10);
          const response = await api.post('/user/auth/send-otp-phone', { phone: normalizedPhone });
          const payload = response?.data ?? response;
          set({ isLoading: false, pendingPhone: normalizedPhone });
          return { success: true, phone: normalizedPhone, debugOtp: payload?.debugOtp };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Send OTP to email
      sendOtpEmail: async (email) => {
        set({ isLoading: true });
        try {
          const normalizedEmail = String(email || '').trim().toLowerCase();
          const response = await api.post('/user/auth/send-otp-email', { email: normalizedEmail });
          const payload = response?.data ?? response;
          set({ isLoading: false, pendingEmail: normalizedEmail });
          return { success: true, email: normalizedEmail, debugOtp: payload?.debugOtp };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Verify OTP email and complete login
      verifyOtpEmail: async (email, otp) => {
        set({ isLoading: true });
        try {
          const normalizedEmail = String(email || '').trim().toLowerCase();
          const response = await api.post('/user/auth/verify-otp', { email: normalizedEmail, otp });
          const payload = response?.data ?? response;
          const accessToken = payload?.accessToken;
          const refreshToken = payload?.refreshToken;
          const user = payload?.user;

          if (!accessToken || !refreshToken || !user) {
            throw new Error('Invalid OTP verification response from server.');
          }

          set({
            user,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            pendingEmail: null,
            pendingPhone: null,
            isLoading: false,
          });

          localStorage.setItem('token', accessToken);
          localStorage.setItem('refresh-token', refreshToken);

          registerFCMToken(true).catch((err) => console.log('FCM registration failed:', err));

          return { success: true, user };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Verify OTP phone and complete login
      verifyOtpPhone: async (phone, otp) => {
        set({ isLoading: true });
        try {
          const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10);
          const response = await api.post('/user/auth/verify-otp-phone', { phone: normalizedPhone, otp });
          const payload = response?.data ?? response;
          const accessToken = payload?.accessToken;
          const refreshToken = payload?.refreshToken;
          const user = payload?.user;

          if (!accessToken || !refreshToken || !user) {
            throw new Error('Invalid OTP verification response from server.');
          }

          set({
            user,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            pendingEmail: null,
            pendingPhone: null,
            isLoading: false,
          });

          localStorage.setItem('token', accessToken);
          localStorage.setItem('refresh-token', refreshToken);

          // Register FCM token
          registerFCMToken(true).catch((err) => console.log('FCM registration failed:', err));

          return { success: true, user };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Verify OTP and complete login (supports phone or email)
      verifyOTP: async (identifier, otp) => {
        set({ isLoading: true });
        try {
          const rawIdentifier = String(identifier || '').trim();
          const digitsOnly = rawIdentifier.replace(/\D/g, '');
          const isPhone = digitsOnly.length >= 10 && !rawIdentifier.includes('@');

          const payload = isPhone
            ? { phone: digitsOnly.slice(-10), otp }
            : { email: rawIdentifier.toLowerCase(), otp };

          const response = await api.post('/user/auth/verify-otp', payload);
          const resData = response?.data ?? response;
          const accessToken = resData?.accessToken;
          const refreshToken = resData?.refreshToken;
          const user = resData?.user;

          if (!accessToken || !refreshToken || !user) {
            throw new Error('Invalid OTP verification response from server.');
          }

          set({
            user,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            pendingEmail: null,
            pendingPhone: null,
            isLoading: false,
          });

          localStorage.setItem('token', accessToken);
          localStorage.setItem('refresh-token', refreshToken);

          // Register FCM token
          registerFCMToken(true).catch((err) => console.log('FCM registration failed:', err));

          return { success: true, user };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Resend OTP (supports phone or email)
      resendOTP: async (identifier) => {
        set({ isLoading: true });
        try {
          const rawIdentifier = String(identifier || '').trim();
          const digitsOnly = rawIdentifier.replace(/\D/g, '');
          const isPhone = digitsOnly.length >= 10 && !rawIdentifier.includes('@');

          const payload = isPhone
            ? { phone: digitsOnly.slice(-10) }
            : { email: rawIdentifier.toLowerCase() };

          await api.post('/user/auth/resend-otp', payload);
          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      forgotPassword: async (email) => {
        set({ isLoading: true });
        try {
          const normalizedEmail = String(email || '').trim().toLowerCase();
          await api.post('/user/auth/forgot-password', { email: normalizedEmail });
          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      verifyResetOtp: async (email, otp) => {
        set({ isLoading: true });
        try {
          const normalizedEmail = String(email || '').trim().toLowerCase();
          await api.post('/user/auth/verify-reset-otp', { email: normalizedEmail, otp });
          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      resetPassword: async (email, password, confirmPassword) => {
        set({ isLoading: true });
        try {
          const normalizedEmail = String(email || '').trim().toLowerCase();
          await api.post('/user/auth/reset-password', { email: normalizedEmail, password, confirmPassword });
          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Logout action
      logout: () => {
        const refreshToken = localStorage.getItem('refresh-token');
        if (refreshToken) {
          api.post('/user/auth/logout', { refreshToken }).catch(() => {});
        }

        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          pendingEmail: null,
        });
        localStorage.removeItem('token');
        localStorage.removeItem('refresh-token');
        localStorage.removeItem('cart-storage');
        localStorage.removeItem('wishlist-storage');
        localStorage.removeItem('address-storage');
      },

      // Update user profile
      updateProfile: async (profileData) => {
        set({ isLoading: true });
        try {
          const response = await api.put('/user/auth/profile', {
            name: profileData?.name,
            phone: profileData?.phone,
          });
          const payload = response?.data ?? response;
          const currentUser = get().user || {};
          const updatedUser = {
            ...currentUser,
            ...payload,
            email: currentUser.email || payload.email,
          };

          set({
            user: updatedUser,
            isLoading: false,
          });
          
          return { success: true, user: updatedUser };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Change password
      changePassword: async (currentPassword, newPassword) => {
        set({ isLoading: true });
        try {
          await api.post('/user/auth/change-password', {
            currentPassword,
            newPassword,
          });
          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Upload profile avatar
      uploadProfileAvatar: async (file) => {
        if (!file) {
          throw new Error('Avatar file is required.');
        }

        set({ isLoading: true });
        try {
          const formData = new FormData();
          formData.append('avatar', file);

          const response = await api.post('/user/auth/profile/avatar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const payload = response?.data ?? response;
          const currentUser = get().user || {};
          const nextUser = {
            ...currentUser,
            ...(payload?.user || {}),
            avatar: payload?.avatar || payload?.user?.avatar || currentUser.avatar,
            email: currentUser.email || payload?.user?.email,
          };

          set({
            user: nextUser,
            isLoading: false,
          });

          return { success: true, user: nextUser };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Initialize auth state from localStorage
      initialize: () => {
        const token = localStorage.getItem('token');
        if (token) {
          const storedState = JSON.parse(localStorage.getItem('auth-storage') || '{}');
          const refreshToken = localStorage.getItem('refresh-token');
          const user = storedState.state?.user;
          const role = String(user?.role || 'customer').toLowerCase();
          if (user && role === 'customer') {
            set({
              user,
              token,
              refreshToken: refreshToken || null,
              isAuthenticated: true,
            });
          } else if (user && role !== 'customer') {
            localStorage.removeItem('token');
            localStorage.removeItem('refresh-token');
            localStorage.removeItem('auth-storage');
            set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
          }
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

