import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../utils/api';

/**
 * Auth store for field-network roles (Sanchalak, Surveyor, Kisan).
 * Sanchalak and Surveyor log in with a password; Kisan logs in with a mobile OTP.
 * Keys must match the role's entry in AUTH_SCOPES (shared/utils/api.js),
 * which reads the tokens straight from localStorage.
 *
 * @param {Object} config
 * @param {string} config.prefix      API prefix, e.g. '/sanchalak'
 * @param {string} config.accessKey   localStorage key for the access token
 * @param {string} config.refreshKey  localStorage key for the refresh token
 * @param {string} config.persistKey  zustand persist key
 */
export const createFieldAuthStore = ({ prefix, accessKey, refreshKey, persistKey }) =>
  create(
    persist(
      (set, get) => ({
        account: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,

        withLoading: async (fn) => {
          set({ isLoading: true });
          try {
            return await fn();
          } finally {
            set({ isLoading: false });
          }
        },

        register: (payload) =>
          get().withLoading(async () => {
            const response = await api.post(`${prefix}/auth/register`, payload);
            return response?.data;
          }),

        verifyOtp: (phone, otp) =>
          get().withLoading(async () => {
            const response = await api.post(`${prefix}/auth/verify-otp`, { phone, otp });
            return response?.data;
          }),

        resendOtp: async (phone) => {
          await api.post(`${prefix}/auth/resend-otp`, { phone });
        },

        startSession: (response) => {
          const { accessToken, refreshToken, account } = response?.data || {};
          if (!accessToken || !refreshToken || !account) {
            throw new Error('Invalid login response from server.');
          }

          localStorage.setItem(accessKey, accessToken);
          localStorage.setItem(refreshKey, refreshToken);
          set({ account, token: accessToken, refreshToken, isAuthenticated: true });
          return account;
        },

        login: (identifier, password) =>
          get().withLoading(async () =>
            get().startSession(await api.post(`${prefix}/auth/login`, { identifier, password }))
          ),

        requestLoginOtp: (phone) =>
          get().withLoading(() => api.post(`${prefix}/auth/login/send-otp`, { phone })),

        loginWithOtp: (phone, otp) =>
          get().withLoading(async () =>
            get().startSession(await api.post(`${prefix}/auth/login/verify-otp`, { phone, otp }))
          ),

        fetchProfile: async () => {
          const response = await api.get(`${prefix}/auth/profile`);
          const profile = response?.data;
          if (profile) set({ account: { ...get().account, ...profile, id: profile._id || profile.id } });
          return profile;
        },

        logout: () => {
          const refreshToken = localStorage.getItem(refreshKey);
          if (refreshToken) {
            api.post(`${prefix}/auth/logout`, { refreshToken }).catch(() => {});
          }
          set({ account: null, token: null, refreshToken: null, isAuthenticated: false });
          localStorage.removeItem(accessKey);
          localStorage.removeItem(refreshKey);
        },
      }),
      {
        name: persistKey,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          account: state.account,
          token: state.token,
          refreshToken: state.refreshToken,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    )
  );
