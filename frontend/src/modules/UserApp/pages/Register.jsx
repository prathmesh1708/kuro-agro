import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiPhone } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../../shared/store/authStore';
import { isValidEmail, isValidPhone } from '../../../shared/utils/helpers';
import toast from 'react-hot-toast';
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from '../../../shared/components/PageTransition';

const MobileRegister = () => {
  const navigate = useNavigate();
  const { register: registerUser, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  const password = watch('password');

  const onSubmit = async (data) => {
    try {
      const fullName = `${data.firstName} ${data.lastName}`.trim();
      const normalizedPhone = String(data.phone || '').replace(/\D/g, '').slice(-10);
      if (normalizedPhone.length !== 10) {
        toast.error('Please enter a valid 10-digit mobile number.');
        return;
      }

      await registerUser(fullName, data.email, data.password, normalizedPhone);
      toast.success('Registration successful! OTP sent to your phone.');
      // Navigate to verification page with phone and email state
      navigate('/verification', { state: { phone: normalizedPhone, email: data.email } });
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || 'Registration failed. Please try again.');
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
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Account</h1>
                <p className="text-sm text-gray-600">Sign up to get started with Raathi</p>
              </div>

              {/* Register Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    First Name
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      {...register('firstName', {
                        required: 'First name is required',
                        minLength: {
                          value: 2,
                          message: 'First name must be at least 2 characters',
                        },
                      })}
                      className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 ${errors.firstName
                          ? 'border-red-300 focus:border-red-500'
                          : 'border-gray-200 focus:border-primary-500'
                        } focus:outline-none transition-colors text-base`}
                      placeholder="Raj"
                    />
                  </div>
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Last Name
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      {...register('lastName', {
                        required: 'Last name is required',
                        minLength: {
                          value: 2,
                          message: 'Last name must be at least 2 characters',
                        },
                      })}
                      className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 ${errors.lastName
                          ? 'border-red-300 focus:border-red-500'
                          : 'border-gray-200 focus:border-primary-500'
                        } focus:outline-none transition-colors text-base`}
                      placeholder="Sarkar"
                    />
                  </div>
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      {...register('email', {
                        required: 'Email is required',
                        validate: (value) =>
                          isValidEmail(value) || 'Please enter a valid email',
                      })}
                      className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 ${errors.email
                          ? 'border-red-300 focus:border-red-500'
                          : 'border-gray-200 focus:border-primary-500'
                        } focus:outline-none transition-colors text-base`}
                      placeholder="sarkarraj0766@gmail.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number (for SMS OTP)
                  </label>
                  <div className="flex gap-2">
                    <select
                      defaultValue="+91"
                      {...register('countryCode', { required: true })}
                      className="w-24 px-3 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:outline-none text-sm font-medium"
                    >
                      <option value="+91">+91</option>
                      <option value="+1">+1</option>
                      <option value="+44">+44</option>
                      <option value="+880">+880</option>
                    </select>
                    <div className="relative flex-1">
                      <FiPhone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        {...register('phone', {
                          required: 'Phone number is required',
                          validate: (value) =>
                            isValidPhone(value) || 'Please enter a valid 10-digit phone number',
                        })}
                        className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 ${errors.phone
                            ? 'border-red-300 focus:border-red-500'
                            : 'border-gray-200 focus:border-primary-500'
                          } focus:outline-none transition-colors text-base`}
                        placeholder="9876543210"
                      />
                    </div>
                  </div>
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Set Password
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('password', {
                        required: 'Password is required',
                        minLength: {
                          value: 6,
                          message: 'Password must be at least 6 characters',
                        },
                      })}
                      className={`w-full pl-12 pr-12 py-3 rounded-xl border-2 ${errors.password
                          ? 'border-red-300 focus:border-red-500'
                          : 'border-gray-200 focus:border-primary-500'
                        } focus:outline-none transition-colors text-base`}
                      placeholder="Create a password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3.5 rounded-xl font-semibold text-base transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating Account...' : 'Sign Up'}
                </button>
              </form>

              {/* Sign In Link */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="text-primary-600 hover:text-primary-700 font-semibold"
                  >
                    Sign In
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

export default MobileRegister;
