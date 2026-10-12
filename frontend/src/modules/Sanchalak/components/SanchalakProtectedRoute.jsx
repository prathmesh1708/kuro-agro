import FieldProtectedRoute from '../../../shared/components/FieldAuth/FieldProtectedRoute';
import { useSanchalakAuthStore } from '../store/sanchalakStore';

const SanchalakProtectedRoute = ({ children }) => (
  <FieldProtectedRoute
    useStore={useSanchalakAuthStore}
    role="sanchalak"
    accessKey="sanchalak-token"
    refreshKey="sanchalak-refresh-token"
    persistKey="sanchalak-auth-storage"
  >
    {children}
  </FieldProtectedRoute>
);

export default SanchalakProtectedRoute;
