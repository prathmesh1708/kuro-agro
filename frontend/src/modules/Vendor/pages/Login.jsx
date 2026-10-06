import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FiPhone, FiLock, FiEye, FiEyeOff, FiArrowRight, FiShield, FiMail } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useVendorAuthStore } from "../store/vendorAuthStore";
import toast from 'react-hot-toast';

const VendorLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading } = useVendorAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/vendor/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const cleanIdentifier = identifier.trim();

  // Phone/Email + Password Login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!cleanIdentifier) {
      toast.error('Please enter your mobile number or email');
      return;
    }
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    try {
      await login(cleanIdentifier, password, false, rememberMe);
      toast.success('Login successful! Welcome to Seller Dashboard.');
      const from = location.state?.from?.pathname || '/vendor/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Invalid credentials.';
      toast.error(msg);
      if (msg.toLowerCase().includes('not verified')) {
        navigate('/vendor/verification', { state: { phone: cleanIdentifier.replace(/\D/g, '').slice(-10), email: cleanIdentifier } });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl"
      >
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 gradient-green rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-green">
            <FiShield className="text-white text-2xl" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-800 mb-1">Seller Portal</h1>
          <p className="text-gray-600 text-sm">
            Sign in with your mobile number / email and password
          </p>
        </div>

        {/* Form: Phone/Email + Password */}
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          {/* Phone or Email */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Mobile Number or Email
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-gray-400">
                {/^\d+$/.test(cleanIdentifier) ? <FiPhone size={18} /> : <FiMail size={18} />}
              </span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="9876543210 or vendor@example.com"
                className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400 font-medium"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Password
              </label>
              <Link
                to="/vendor/forgot-password"
                className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-12 pr-12 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400 font-medium"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="ml-2 text-xs text-gray-600 font-medium">Remember me</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !cleanIdentifier || !password}
            className="w-full mt-2 gradient-green text-white py-3.5 rounded-xl font-bold text-base hover:shadow-glow-green transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? 'Signing In...' : (
              <>
                <span>Login to Dashboard</span>
                <FiArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Register Link */}
        <div className="text-center pt-6 mt-6 border-t border-gray-100">
          <p className="text-sm text-gray-600">
            Don't have a seller account?{' '}
            <Link
              to="/vendor/register"
              className="text-primary-600 hover:text-primary-700 font-bold ml-1 hover:underline"
            >
              Register as Vendor
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default VendorLogin;

