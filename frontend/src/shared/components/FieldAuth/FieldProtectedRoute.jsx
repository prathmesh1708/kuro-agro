import { Navigate, useLocation } from 'react-router-dom';

const decodeJwtPayload = (token) => {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch {
    return null;
  }
};

/**
 * Route guard for field-network roles. An expired access token is allowed through when a
 * refresh token exists, because the API client refreshes it on the first 401.
 */
const FieldProtectedRoute = ({ children, useStore, role, accessKey, refreshKey, persistKey }) => {
  const { isAuthenticated, token } = useStore();
  const location = useLocation();
  // localStorage first: the API client writes refreshed tokens there, not into the store.
  const accessToken = localStorage.getItem(accessKey) || token;
  const payload = decodeJwtPayload(accessToken);
  const loginPath = `/login?role=${role}`;

  const clearSession = () => {
    localStorage.removeItem(accessKey);
    localStorage.removeItem(refreshKey);
    localStorage.removeItem(persistKey);
  };

  if (!isAuthenticated || !accessToken) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  const isExpired = typeof payload?.exp === 'number' && Date.now() >= payload.exp * 1000;
  if ((isExpired && !localStorage.getItem(refreshKey)) || (payload?.role && payload.role !== role)) {
    clearSession();
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  return children;
};

export default FieldProtectedRoute;
