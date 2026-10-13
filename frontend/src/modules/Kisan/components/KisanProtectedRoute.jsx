import FieldProtectedRoute from '../../../shared/components/FieldAuth/FieldProtectedRoute';
import { useKisanAuthStore } from '../store/kisanStore';

const KisanProtectedRoute = ({ children }) => (
  <FieldProtectedRoute
    useStore={useKisanAuthStore}
    role="kisan"
    accessKey="kisan-token"
    refreshKey="kisan-refresh-token"
    persistKey="kisan-auth-storage"
  >
    {children}
  </FieldProtectedRoute>
);

export default KisanProtectedRoute;
