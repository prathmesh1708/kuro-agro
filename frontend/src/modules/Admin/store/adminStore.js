import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { adminLogin as apiLogin } from '../services/adminService';
import api from '../../../shared/utils/api';
import { registerFCMToken } from '../../../services/pushNotificationService';

export const useAdminAuthStore = create(
  persist(
    (set) => ({
      admin: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      // Admin login — calls real backend
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const response = await apiLogin(email, password);
          const { accessToken, refreshToken, admin } = response.data;

          // Store token under 'adminToken' key (used by adminService interceptor)
          localStorage.setItem('adminToken', accessToken);
          localStorage.setItem('adminRefreshToken', refreshToken);

          // Register FCM token
          registerFCMToken(true).catch((err) => console.log('Admin FCM registration failed:', err));

          set({
            admin,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          return { success: true, admin };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Admin logout
      logout: () => {
        const refreshToken = localStorage.getItem('adminRefreshToken');
        if (refreshToken) {
          api.post('/admin/auth/logout', { refreshToken }).catch(() => {});
        }

        set({ admin: null, token: null, refreshToken: null, isAuthenticated: false });
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminRefreshToken');
      },
    }),
    {
      name: 'admin-auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
