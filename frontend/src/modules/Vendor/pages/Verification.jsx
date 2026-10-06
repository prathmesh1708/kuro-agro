import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiPhone, FiShield } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { verifyVendorOTP, resendVendorOTP } from '../services/vendorService';
import toast from 'react-hot-toast';

const VendorVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const OTP_LENGTH = 6;
  const [codes, setCodes] = useState(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef([]);

  const phone = location.state?.phone || '';
  const email = location.state?.email || '';
  const identifier = phone || email;
  const [resendCooldown, setResendCooldown] = useState(0);

  // Focus first input on mount
  useEffect(() => {
    if (!identifier) {
      navigate('/vendor/register', { replace: true });
      return;
    }
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [identifier, navigate]);

  const handleChange = (index, value) => {
    // Only allow single digit
    if (value.length > 1) return;

    const newCodes = [...codes];
    newCodes[index] = value;
    setCodes(newCodes);

    // Auto-focus next input
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !codes[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (pastedData.length === OTP_LENGTH && /^\d+$/.test(pastedData)) {
      const newCodes = pastedData.split('');
      setCodes(newCodes);
      inputRefs.current[OTP_LENGTH - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const verificationCode = codes.join('');

    if (verificationCode.length !== OTP_LENGTH) {
      toast.error('Please enter the complete 6-digit verification code');
      return;
    }

    setIsLoading(true);
    try {
      await verifyVendorOTP(identifier, verificationCode);
      toast.success('Phone verified! Your seller account is pending admin approval.');
      navigate('/vendor/login');
    } catch {
      // Error toast is shown by api.js interceptor
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !identifier) return;
    try {
      await resendVendorOTP(identifier);
      toast.success(phone ? `OTP resent to +91 ${phone} via SMS` : 'OTP resent to email');
      // Start 30 second cooldown
      setResendCooldown(30);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      // api.js shows toast
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl p-8 w-full max-w-md shadow-2xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 gradient-green rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-green">
            <FiShield className="text-white text-2xl" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Verify Mobile Number</h1>
          <p className="text-gray-600">
            {phone ? (
              <>We've sent a 6-digit SMS verification code to <br /><span className="font-semibold text-gray-800">+91 {phone}</span></>
            ) : (
              <>We've sent a verification code to <br /><span className="font-semibold text-gray-800">{email}</span></>
            )}
          </p>
        </div>

        {/* Verification Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Code Inputs */}
          <div className="flex justify-center gap-3">
            {codes.map((code, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={code}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className="w-16 h-16 text-center text-2xl font-bold bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800"
              />
            ))}
          </div>

          {/* Resend Code */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : "Didn't receive the SMS code? Resend"}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || codes.some(code => !code)}
            className="w-full gradient-green text-white py-3 rounded-xl font-semibold hover:shadow-glow-green transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              'Verifying...'
            ) : (
              <>
                <FiCheck />
                Verify Phone Number
              </>
            )}
          </button>

          {/* Back to Login */}
          <div className="text-center pt-4">
            <Link
              to="/vendor/login"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              <FiArrowLeft />
              Back to Login
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default VendorVerification;

