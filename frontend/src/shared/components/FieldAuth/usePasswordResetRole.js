import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useSanchalakAuthStore } from '../../../modules/Sanchalak/store/sanchalakStore';
import { useSurveyorAuthStore } from '../../../modules/Surveyor/store/surveyorStore';
import { ROLE_CONFIG, resolveRole, roleSearch } from './roleConfig';

/**
 * Role-aware store for the shared /forgot-password and /reset-password pages (?role=surveyor|sanchalak).
 * Every store exposes forgotPassword(phone), verifyResetOtp(phone, otp) and
 * resetPassword(phone, password, confirmPassword). Kisan logs in by OTP and has no password.
 */
export const usePasswordResetRole = () => {
  const [searchParams] = useSearchParams();
  const role = resolveRole(searchParams.get('role'));
  const customerStore = useAuthStore();
  const sanchalakStore = useSanchalakAuthStore();
  const surveyorStore = useSurveyorAuthStore();
  const store = { sanchalak: sanchalakStore, surveyor: surveyorStore }[role] || customerStore;

  return {
    role,
    roleConfig: ROLE_CONFIG[role],
    store,
    hasPassword: !ROLE_CONFIG[role].otpLogin,
    search: roleSearch(role),
    loginPath: `/login${roleSearch(role)}`,
  };
};

export default usePasswordResetRole;
