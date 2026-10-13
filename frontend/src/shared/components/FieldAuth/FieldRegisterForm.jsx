import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiPhone, FiHome, FiHash, FiCheckCircle, FiMapPin } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { INDIAN_STATES } from '../../constants/indianStates';
import { useSanchalakAuthStore } from '../../../modules/Sanchalak/store/sanchalakStore';
import { useSurveyorAuthStore } from '../../../modules/Surveyor/store/surveyorStore';
import { ROLE_CONFIG } from './roleConfig';

const RESEND_COOLDOWN_SECONDS = 30;

const Field = ({ label, error, icon: Icon, children, optional }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      {label}
      {optional && <span className="ml-1 font-normal text-gray-400">(optional)</span>}
    </label>
    <div className="relative">
      {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />}
      {children}
    </div>
    {error && <p className="mt-1 text-sm text-red-600">{error.message}</p>}
  </div>
);

/**
 * Registration for Sanchalak and Surveyor: details → phone OTP → submitted for admin approval.
 * Pass `initialPhone` to resume at the OTP step (e.g. after a login attempt with an unverified phone).
 */
const FieldRegisterForm = ({ role, initialPhone = '' }) => {
  const config = ROLE_CONFIG[role];
  const { theme } = config;
  const sanchalakStore = useSanchalakAuthStore();
  const surveyorStore = useSurveyorAuthStore();
  const store = role === 'sanchalak' ? sanchalakStore : surveyorStore;

  const [step, setStep] = useState(initialPhone ? 'otp' : 'details');
  const [phone, setPhone] = useState(initialPhone);
  const [loginCode, setLoginCode] = useState('');
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(initialPhone ? 0 : RESEND_COOLDOWN_SECONDS);
  const [showPassword, setShowPassword] = useState(false);
  const [kendra, setKendra] = useState(null);
  const [isCheckingCode, setIsCheckingCode] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({ defaultValues: { state: 'Madhya Pradesh' } });

  useEffect(() => {
    if (step !== 'otp' || cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, cooldown]);

  const inputClass = (hasError) =>
    `w-full pl-12 pr-4 py-3 rounded-xl border-2 ${hasError ? 'border-red-300 focus:border-red-500' : `border-gray-200 ${theme.focus}`} focus:outline-none transition-colors text-base`;
  const plainInputClass = (hasError) => inputClass(hasError).replace('pl-12', 'pl-4');

  const checkSanchalakCode = async () => {
    const code = String(getValues('sanchalakCode') || '').trim().toUpperCase();
    setKendra(null);
    if (!/^SAN-\d{6}$/.test(code)) return;
    setIsCheckingCode(true);
    try {
      const response = await api.get(`/surveyor/auth/sanchalak/${code}`);
      setKendra(response?.data || null);
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsCheckingCode(false);
    }
  };

  const onSubmitDetails = async (data) => {
    const payload = {
      name: data.name.trim(),
      email: data.email.trim(),
      ...(data.phone && { phone: data.phone.replace(/\D/g, '').slice(-10) }),
      password: data.password,
      address: {
        village: data.village.trim(),
        gramPanchayat: (data.gramPanchayat || '').trim(),
        block: data.block.trim(),
        district: data.district.trim(),
        state: data.state,
        pincode: data.pincode.trim(),
      },
      ...(role === 'sanchalak' && { kendraName: data.kendraName.trim() }),
      ...(role === 'surveyor' && { sanchalakCode: data.sanchalakCode.trim().toUpperCase() }),
    };

    try {
      const result = await store.register(payload);
      setLoginCode(result?.[config.codeField] || '');
      setStep('done');
      toast.success('Registration submitted! Awaiting admin approval.');
    } catch {
      // The API client already shows the error message.
    }
  };

  const onVerifyOtp = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      toast.error('Enter the 6-digit OTP.');
      return;
    }
    try {
      const result = await store.verifyOtp(phone, otp);
      if (result?.[config.codeField]) setLoginCode(result[config.codeField]);
      setStep('done');
    } catch {
      // The API client already shows the error message.
    }
  };

  const onResend = async () => {
    try {
      await store.resendOtp(phone);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success('OTP resent.');
    } catch {
      // The API client already shows the error message.
    }
  };

  if (step === 'done') {
    return (
      <div className="text-center space-y-5">
        <FiCheckCircle className="mx-auto text-primary-500" size={56} />
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Registration submitted</h2>
          <p className="text-sm text-gray-600">
            Admin will review your details; you can log in once your account is approved.
          </p>
        </div>
        {loginCode && (
          <div className={`rounded-xl border-2 px-4 py-3 ${theme.badge}`}>
            <p className="text-xs font-semibold uppercase tracking-wide">Your Login ID</p>
            <p className="text-2xl font-bold tracking-wider">{loginCode}</p>
            <p className="text-xs mt-1">
              Save this ID. You can also log in with your email.
            </p>
          </div>
        )}
        <Link
          to={`/login?role=${role}`}
          className={`block w-full text-white py-3.5 rounded-xl font-semibold text-base transition-all ${theme.button}`}
        >
          Go to Login
        </Link>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <form onSubmit={onVerifyOtp} className="space-y-5">
        <p className="text-sm text-gray-600 text-center">
          Enter the 6-digit OTP sent to <span className="font-semibold text-gray-900">+91 {phone}</span>
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className={`w-full px-4 py-3 rounded-xl border-2 border-gray-200 ${theme.focus} focus:outline-none text-center text-2xl font-bold tracking-[0.5em]`}
          placeholder="••••••"
          aria-label="OTP"
        />
        <button
          type="submit"
          disabled={store.isLoading || otp.length !== 6}
          className={`w-full text-white py-3.5 rounded-xl font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme.button}`}
        >
          {store.isLoading ? 'Verifying...' : 'Verify OTP'}
        </button>
        <div className="text-center">
          <button
            type="button"
            onClick={onResend}
            disabled={cooldown > 0}
            className={`text-sm font-semibold disabled:text-gray-400 ${theme.link}`}
          >
            {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmitDetails)} className="space-y-5" noValidate>
      {role === 'surveyor' && (
        <div>
          <Field label="Sanchalak Code" icon={FiHash} error={errors.sanchalakCode}>
            <input
              type="text"
              {...register('sanchalakCode', {
                required: 'Sanchalak code is required',
                pattern: { value: /^SAN-\d{6}$/i, message: 'Code looks like SAN-123456' },
                onBlur: checkSanchalakCode,
              })}
              className={`${inputClass(errors.sanchalakCode)} uppercase`}
              placeholder="SAN-123456"
            />
          </Field>
          {isCheckingCode && <p className="mt-1 text-xs text-gray-500">Checking code…</p>}
          {kendra && (
            <p className={`mt-2 rounded-lg border px-3 py-2 text-sm ${theme.badge}`}>
              <span className="font-semibold">{kendra.kendraName}</span> · Sanchalak {kendra.name}
              {kendra.district ? ` · ${kendra.district}` : ''}
            </p>
          )}
        </div>
      )}

      {role === 'sanchalak' && (
        <Field label="Kendra Name" icon={FiHome} error={errors.kendraName}>
          <input
            type="text"
            {...register('kendraName', { required: 'Kendra name is required', minLength: { value: 2, message: 'Too short' } })}
            className={inputClass(errors.kendraName)}
            placeholder="Rampur Kisan Vyapar Kendra"
          />
        </Field>
      )}

      <Field label="Full Name" icon={FiUser} error={errors.name}>
        <input
          type="text"
          {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Name must be at least 2 characters' } })}
          className={inputClass(errors.name)}
          placeholder="Ramesh Patel"
        />
      </Field>

      <Field label="Email" icon={FiMail} error={errors.email}>
        <input
          type="email"
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Please enter a valid email' },
          })}
          className={inputClass(errors.email)}
          placeholder="you@example.com"
        />
      </Field>

      <Field label="Set Password" icon={FiLock} error={errors.password}>
        <input
          type={showPassword ? 'text' : 'password'}
          {...register('password', {
            required: 'Password is required',
            minLength: { value: 6, message: 'Password must be at least 6 characters' },
          })}
          className={`${inputClass(errors.password)} pr-12`}
          placeholder="Create a password"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
        </button>
      </Field>

      <div className="pt-2">
        <p className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
          <FiMapPin /> Address
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Village" error={errors.village}>
            <input type="text" {...register('village', { required: 'Village is required' })} className={plainInputClass(errors.village)} />
          </Field>
          <Field label="Gram Panchayat" optional error={errors.gramPanchayat}>
            <input type="text" {...register('gramPanchayat')} className={plainInputClass(errors.gramPanchayat)} />
          </Field>
          <Field label="Block" error={errors.block}>
            <input type="text" {...register('block', { required: 'Block is required' })} className={plainInputClass(errors.block)} />
          </Field>
          <Field label="District" error={errors.district}>
            <input type="text" {...register('district', { required: 'District is required' })} className={plainInputClass(errors.district)} />
          </Field>
          <Field label="State" error={errors.state}>
            <select {...register('state', { required: 'State is required' })} className={`${plainInputClass(errors.state)} bg-white`}>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </Field>
          <Field label="Pincode" error={errors.pincode}>
            <input
              type="text"
              inputMode="numeric"
              {...register('pincode', {
                required: 'Pincode is required',
                pattern: { value: /^\d{6}$/, message: 'Enter a 6-digit pincode' },
              })}
              className={plainInputClass(errors.pincode)}
            />
          </Field>
        </div>
      </div>

      <button
        type="submit"
        disabled={store.isLoading}
        className={`w-full text-white py-3.5 rounded-xl font-semibold text-base transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${theme.button}`}
      >
        {store.isLoading ? 'Submitting...' : 'Register & Send OTP'}
      </button>

      <p className="text-sm text-gray-600 text-center">
        Already registered?{' '}
        <Link to={`/login?role=${role}`} className={`font-semibold ${theme.link}`}>
          Log In
        </Link>
      </p>
    </form>
  );
};

export default FieldRegisterForm;
