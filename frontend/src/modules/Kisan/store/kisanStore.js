import { createFieldAuthStore } from '../../../shared/store/createFieldAuthStore';

export const useKisanAuthStore = createFieldAuthStore({
  prefix: '/kisan',
  accessKey: 'kisan-token',
  refreshKey: 'kisan-refresh-token',
  persistKey: 'kisan-auth-storage',
});
