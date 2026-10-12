import { createFieldAuthStore } from '../../../shared/store/createFieldAuthStore';

export const useSanchalakAuthStore = createFieldAuthStore({
  prefix: '/sanchalak',
  accessKey: 'sanchalak-token',
  refreshKey: 'sanchalak-refresh-token',
  persistKey: 'sanchalak-auth-storage',
});
