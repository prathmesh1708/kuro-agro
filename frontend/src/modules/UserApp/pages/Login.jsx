import { useState } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { FiPhone, FiLock, FiEye, FiEyeOff, FiArrowLeft, FiUser, FiKey } from 'react-icons/fi';
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
import brandLogo from '../../../assets/kuro-agro-logo.png';
import RoleSelect from '../../../shared/components/FieldAuth/RoleSelect';
import { ROLE_CONFIG, resolveRole, roleSearch } from '../../../shared/components/FieldAuth/roleConfig';
import { useSanchalakAuthStore } from '../../Sanchalak/store/sanchalakStore';
import { useSurveyorAuthStore } from '../../Surveyor/store/surveyorStore';
import { useKisanAuthStore } from '../../Kisan/store/kisanStore';

const MobileLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login, isLoading: isCustomerLoading } = useAuthStore();
  const sanchalakStore = useSanchalakAuthStore();
  const surveyorStore = useSurveyorAuthStore();
  const kisanStore = useKisanAuthStore();

  const role = resolveRole(searchParams.get('role'));
  const roleConfig = ROLE_CONFIG[role];
  const fieldStore = { sanchalak: sanchalakStore, surveyor: surveyorStore, kisan: kisanStore }[role] || null;
  const isLoading = fieldStore ? fieldStore.isLoading : isCustomerLoading;

  const [phone, setPhone] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [kisanPhone, setKisanPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSentTo, setOtpSentTo] = useState('');

  const handleRoleChange = (nextRole) => {
    setSearchParams(nextRole === 'customer' ? {} : { role: nextRole }, { replace: true });
    setPassword('');
    setShowPassword(false);
    setOtp('');
    setOtpSentTo('');
  };

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

  // Email / Phone + Password Login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    const rawIdentifier = phone.trim();
    if (!rawIdentifier) {
      toast.error('Please enter your email or mobile number.');
      return;
    }
    if (!password) {
      toast.error('Please enter your password.');
      return;
    }

    try {
      await login(rawIdentifier, password);
      replayPendingAction();
      toast.success('Login successful!');
      clearPostLoginRedirect();
      navigate(from === '/login' ? '/home' : from, { replace: true });
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Login failed. Please check your credentials.';
      toast.error(msg);
      // If unverified, redirect to verification for the account's phone
      if (msg.toLowerCase().includes('not verified')) {
        const unverified = error?.response?.data?.errors?.find((item) => item.code === 'PHONE_NOT_VERIFIED');
        const verifyPhone = unverified?.phone || rawIdentifier;
        navigate('/verification', {
          state: verifyPhone.includes('@') ? { email: verifyPhone } : { phone: verifyPhone },
        });
      }
    }
  };

  // Surveyor / Sanchalak: login ID (SAN-/SUR- code), email or phone + password
  const handleFieldLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      toast.error('Please enter your login ID and password.');
      return;
    }

    try {
      await fieldStore.login(identifier.trim(), password);
      toast.success('Login successful!');
      navigate(roleConfig.home, { replace: true });
    } catch (error) {
      const unverified = error?.response?.data?.errors?.find((item) => item.code === 'PHONE_NOT_VERIFIED');
      if (unverified) {
        navigate(`/register${roleSearch(role)}`, { state: { verifyPhone: unverified.phone } });
      }
    }
  };

  // Kisan: registered mobile number → OTP → logged in
  const cleanKisanPhone = kisanPhone.replace(/\D/g, '').slice(-10);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (cleanKisanPhone.length !== 10) {
      toast.error('Please enter your 10-digit mobile number.');
      return;
    }
    try {
      await kisanStore.requestLoginOtp(cleanKisanPhone);
      setOtpSentTo(cleanKisanPhone);
      setOtp('');
      toast.success('OTP sent to your mobile number.');
    } catch {
      // The API client already shows the error message.
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      toast.error('Please enter the 6-digit OTP.');
      return;
    }
    try {
      await kisanStore.loginWithOtp(otpSentTo, otp);
      toast.success('Login successful!');
      navigate(roleConfig.home, { replace: true });
    } catch {
      // The API client already shows the error message.
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
                <img src={brandLogo} alt="KuroAgro" className="h-20 w-auto object-contain mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{roleConfig.loginTitle}</h1>
                <p className="text-sm text-gray-600">{roleConfig.loginSubtitle}</p>
              </div>

              <RoleSelect value={role} onChange={handleRoleChange} />

              {roleConfig.otpLogin ? (
                otpSentTo ? (
                  <form onSubmit={handleVerifyOtp} className="space-y-5">
                    <div>
                      <label htmlFor="kisan-otp" className="block text-sm font-semibold text-gray-700 mb-2">
                        OTP sent to {otpSentTo}
                      </label>
                      <div className="relative">
                        <FiKey className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          id="kisan-otp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          required
                          autoFocus
                          className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 ${roleConfig.theme.focus} focus:outline-none transition-colors text-base font-semibold tracking-[0.4em]`}
                          placeholder="______"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading || otp.length !== 6}
                      className={`w-full text-white py-3.5 rounded-xl font-semibold text-base transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${roleConfig.theme.button}`}
                    >
                      {isLoading ? 'Verifying...' : 'Verify & Log In'}
                    </button>
                    <div className="flex items-center justify-between text-sm">
                      <button type="button" onClick={() => setOtpSentTo('')} className="text-gray-600 font-semibold">
                        Change number
                      </button>
                      <button type="button" onClick={handleSendOtp} disabled={isLoading} className={`${roleConfig.theme.link} font-semibold disabled:opacity-50`}>
                        Resend OTP
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleSendOtp} className="space-y-5">
                    <div>
                      <label htmlFor="kisan-phone" className="block text-sm font-semibold text-gray-700 mb-2">
                        Registered Mobile Number
                      </label>
                      <div className="relative">
                        <FiPhone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          id="kisan-phone"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel"
                          value={kisanPhone}
                          onChange={(e) => setKisanPhone(e.target.value)}
                          required
                          className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 ${roleConfig.theme.focus} focus:outline-none transition-colors text-base font-medium`}
                          placeholder="10-digit mobile number"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading || cleanKisanPhone.length !== 10}
                      className={`w-full text-white py-3.5 rounded-xl font-semibold text-base transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${roleConfig.theme.button}`}
                    >
                      {isLoading ? 'Sending OTP...' : 'Send OTP'}
                    </button>
                  </form>
                )
              ) : fieldStore ? (
                <form onSubmit={handleFieldLogin} className="space-y-5">
                  <div>
                    <label htmlFor="field-identifier" className="block text-sm font-semibold text-gray-700 mb-2">
                      Login ID or Mobile Number
                    </label>
                    <div className="relative">
                      <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        id="field-identifier"
                        type="text"
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 ${roleConfig.theme.focus} focus:outline-none transition-colors text-base font-medium`}
                        placeholder={`${roleConfig.codeExample} or 10-digit mobile`}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label htmlFor="field-password" className="block text-sm font-semibold text-gray-700">
                        Password
                      </label>
                      <Link
                        to={`/forgot-password${roleSearch(role)}`}
                        className={`text-xs font-semibold ${roleConfig.theme.link}`}
                      >
                        Forgot Password?
                      </Link>
                    </div>
                    <div className="relative">
                      <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        id="field-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={`w-full pl-12 pr-12 py-3 rounded-xl border-2 border-gray-200 ${roleConfig.theme.focus} focus:outline-none transition-colors text-base font-medium`}
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !identifier.trim() || !password}
                    className={`w-full text-white py-3.5 rounded-xl font-semibold text-base transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${roleConfig.theme.button}`}
                  >
                    {isLoading ? 'Logging In...' : `Log In as ${roleConfig.label}`}
                  </button>
                </form>
              ) : (
              <form onSubmit={handlePasswordLogin} className="space-y-5">
                {/* Mobile Number or Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Mobile Number or Email
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:outline-none transition-colors text-base font-medium"
                      placeholder="10-digit mobile or email"
                    />
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
                  disabled={isLoading || !phone.trim() || !password}
                  className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3.5 rounded-xl font-semibold text-base transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Logging In...' : 'Log In'}
                </button>
              </form>
              )}

              {/* Sign Up Link */}
              <div className="mt-6 text-center">
                {roleConfig.otpLogin ? (
                  <p className="text-sm text-gray-600">
                    Not registered yet? Ask the surveyor of your Kisan Vyapar Kendra to register you.
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">
                    Don't have an account?{' '}
                    <Link
                      to={`/register${roleSearch(role)}`}
                      className={`${roleConfig.theme.link} font-semibold`}
                    >
                      {role === 'customer' ? 'Sign Up' : `Register as ${roleConfig.label}`}
                    </Link>
                  </p>
                )}
              </div>

            </div>
          </motion.div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default MobileLogin;
