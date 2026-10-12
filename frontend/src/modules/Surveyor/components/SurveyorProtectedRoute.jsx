import FieldProtectedRoute from '../../../shared/components/FieldAuth/FieldProtectedRoute';
import { useSurveyorAuthStore } from '../store/surveyorStore';

const SurveyorProtectedRoute = ({ children }) => (
  <FieldProtectedRoute
    useStore={useSurveyorAuthStore}
    role="surveyor"
    accessKey="surveyor-token"
    refreshKey="surveyor-refresh-token"
    persistKey="surveyor-auth-storage"
  >
    {children}
  </FieldProtectedRoute>
);

export default SurveyorProtectedRoute;
