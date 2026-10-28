import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiCheck, FiPhone, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import MobileLayout from '../components/Layout/MobileLayout';
import PageTransition from '../../../shared/components/PageTransition';
import { usePasswordResetRole } from '../../../shared/components/FieldAuth/usePasswordResetRole';

const OTP_LENGTH = 6;

const MobileForgotPassword = () => {
  const navigate = useNavigate();
  const { role, roleConfig, store, hasPassword, search, loginPath } = usePasswordResetRole();
  const { forgotPassword, verifyResetOtp, isLoading } = store;
  const { theme } = roleConfig;
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('request');
  const [codes, setCodes] = useState(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef([]);

  useEffect(() => {
    if (step === 'verify' && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  // Kisan logs in with a mobile OTP and has no password to reset.
  if (!hasPassword) return <Navigate to={loginPath} replace />;

  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      await forgotPassword(phone);
      toast.success('If the mobile number is registered, a reset OTP has been sent.');
      setStep('verify');
    } catch (error) {
      const message = String(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          ''
      ).toLowerCase();

      if (
        role === 'customer' &&
        (message.includes('not verified') ||
        message.includes('verification otp has been sent'))
      ) {
        navigate('/verification', {
          state: { phone },
          replace: true,
        });
      }
    }
  };

  const handleCodeChange = (index, value) => {
    if (value.length > 1 || (value && !/^\d$/.test(value))) return;
    const next = [...codes];
    next[index] = value;
    setCodes(next);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codes[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(pasted)) return;
    setCodes(pasted.split(''));
    inputRefs.current[OTP_LENGTH - 1]?.focus();
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otp = codes.join('');
    if (otp.length !== OTP_LENGTH) {
      toast.error('Please enter the full OTP.');
      return;
    }

    try {
      await verifyResetOtp(phone, otp);
      toast.success('OTP verified. Please set your new password.');
      navigate(`/reset-password${search}`, { state: { phone } });
    } catch {
      // Global API interceptor shows toast
    }
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={false}>
        <div className="w-full min-h-screen flex items-start justify-center px-4 pt-6 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {role === 'customer' ? 'Forgot Password' : `${roleConfig.label} Password Reset`}
                </h1>
                <p className="text-sm text-gray-600">
                  {step === 'request'
                    ? 'Enter your registered mobile number to receive an OTP.'
                    : `Enter the OTP sent to +91 ${phone}`}
                </p>
              </div>

              {step === 'request' ? (
                <form onSubmit={handleRequestOtp} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Mobile Number</label>
                    <div className="relative">
                      <FiPhone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <span className="absolute left-10 top-1/2 -translate-y-1/2 text-gray-500 text-base">+91</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        className={`w-full pl-20 pr-4 py-3 rounded-xl border-2 border-gray-200 ${theme.focus} focus:outline-none transition-colors text-base`}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full ${theme.button} text-white py-3.5 rounded-xl font-semibold text-base transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isLoading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div className="flex justify-center gap-2">
                    {codes.map((code, index) => (
                      <input
                        key={index}
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={code}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={index === 0 ? handlePaste : undefined}
                        className={`w-11 h-11 text-center text-lg font-bold bg-white border-2 border-gray-200 rounded-xl focus:outline-none ${theme.focus} text-gray-800`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={isLoading}
                      className={`text-sm ${theme.link} font-medium disabled:text-gray-400 inline-flex items-center gap-2`}
                    >
                      <FiRefreshCw />
                      Resend OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('request')}
                      className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                    >
                      Change Number
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || codes.some((c) => !c)}
                    className={`w-full ${theme.button} text-white py-3.5 rounded-xl font-semibold text-base transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                  >
                    {isLoading ? 'Verifying...' : <><FiCheck /> Verify OTP</>}
                  </button>
                </form>
              )}

              <div className="text-center pt-6">
                <Link to={loginPath} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
                  <FiArrowLeft />
                  Back to Login
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default MobileForgotPassword;
