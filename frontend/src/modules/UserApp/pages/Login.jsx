import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FiPhone, FiLock, FiEye, FiEyeOff, FiArrowRight, FiShield, FiArrowLeft } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../../shared/store/authStore';
import { useCartStore } from '../../../shared/store/useStore';
import { useWishlistStore } from '../../../shared/store/wishlistStore';
import {
  clearPostLoginRedirect,
  consumePostLoginAction,
  getPostLoginRedirect,
} from '../../../shared/utils/postLoginAction';
import toast from 'react-hot-toast';
import MobileLayout from '../components/Layout/MobileLayout';
import PageTransition from '../../../shared/components/PageTransition';

const MobileLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const storedFrom = getPostLoginRedirect();
  const from = location.state?.from?.pathname || storedFrom || '/home';

  const replayPendingAction = () => {
    const action = consumePostLoginAction();
    if (!action?.type) return;

    if (action.type === 'cart:add' && action.payload) {
      useCartStore.getState().addItem(action.payload);
      return;
    }

    if (action.type === 'wishlist:add' && action.payload) {
      useWishlistStore.getState().addItem(action.payload);
    }
  };

  const cleanPhone = phone.replace(/\D/g, '').slice(-10);

  // Phone + Password Login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (cleanPhone.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!password) {
      toast.error('Please enter your password.');
      return;
    }

    try {
      await login(cleanPhone, password);
      replayPendingAction();
      toast.success('Login successful!');
      clearPostLoginRedirect();
      navigate(from === '/login' ? '/home' : from, { replace: true });
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Login failed. Please check your credentials.';
      toast.error(msg);
      // If unverified, redirect to verification
      if (msg.toLowerCase().includes('not verified')) {
        navigate('/verification', { state: { phone: cleanPhone } });
      }
    }
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={false}>
        <div className="w-full min-h-screen flex items-start justify-center px-4 pt-6 pb-8 bg-gray-50">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              {/* Back Button */}
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <FiArrowLeft className="mr-2" size={20} />
                <span className="text-sm font-medium">Back</span>
              </button>
              
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h1>
                <p className="text-sm text-gray-600">Log in with your phone number and password</p>
              </div>

              {/* Form: Phone + Password */}
              <form onSubmit={handlePasswordLogin} className="space-y-5">
                {/* Mobile Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="flex gap-2">
                    <div className="w-24 px-3 py-3 rounded-xl border-2 border-gray-200 bg-gray-50 flex items-center justify-center text-sm font-semibold text-gray-700">
                      +91
                    </div>
                    <div className="relative flex-1">
                      <FiPhone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        required
                        className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:outline-none transition-colors text-base font-medium"
                        placeholder="9876543210"
                      />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                  <div className="relative">
                    <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-12 pr-12 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:outline-none transition-colors text-base font-medium"
                      placeholder="Enter your password"
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

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || cleanPhone.length !== 10 || !password}
                  className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3.5 rounded-xl font-semibold text-base transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Logging In...' : 'Log In'}
                </button>
              </form>

              {/* Sign Up Link */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    className="text-primary-600 hover:text-primary-700 font-semibold"
                  >
                    Sign Up
                  </Link>
                </p>
              </div>

            </div>
          </motion.div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default MobileLogin;
