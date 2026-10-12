import { createFieldAuthStore } from '../../../shared/store/createFieldAuthStore';

export const useSurveyorAuthStore = createFieldAuthStore({
  prefix: '/surveyor',
  accessKey: 'surveyor-token',
  refreshKey: 'surveyor-refresh-token',
  persistKey: 'surveyor-auth-storage',
});
