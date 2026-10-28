import { FiUser, FiClipboard, FiBriefcase, FiSun } from 'react-icons/fi';

// Roles selectable on the shared /login and /register pages. Customer (the store account) is the default.
// Theme classes are written out in full so Tailwind can find them.
export const ROLE_CONFIG = {
  customer: {
    label: 'Customer',
    loginTitle: 'Welcome Back',
    loginSubtitle: 'Log in with your mobile number and password',
    registerTitle: 'Create Account',
    registerSubtitle: 'Sign up with your mobile number to get started with KuroAgro',
    icon: FiUser,
    home: '/home',
    theme: {
      button: 'bg-primary-500 hover:bg-primary-600',
      focus: 'focus:border-primary-500',
      link: 'text-primary-600 hover:text-primary-700',
      badge: 'bg-primary-50 text-primary-700 border-primary-200',
    },
  },
  kisan: {
    label: 'Kisan / Farmer',
    loginTitle: 'Kisan Login',
    loginSubtitle: 'Log in with your registered mobile number and OTP',
    registerTitle: 'Kisan Registration',
    registerSubtitle: 'Farmers are registered by a surveyor of your Kisan Vyapar Kendra',
    icon: FiSun,
    home: '/kisan/dashboard',
    codeField: 'kisanCode',
    otpLogin: true,
    theme: {
      button: 'bg-green-600 hover:bg-green-700',
      focus: 'focus:border-green-500',
      link: 'text-green-600 hover:text-green-700',
      badge: 'bg-green-50 text-green-700 border-green-200',
    },
  },
  surveyor: {
    label: 'Surveyor',
    loginTitle: 'Surveyor Login',
    loginSubtitle: 'Use your Surveyor ID (SUR-…) or mobile number',
    registerTitle: 'Become a Surveyor',
    registerSubtitle: 'Register under your Kisan Vyapar Kendra using its Sanchalak code',
    icon: FiClipboard,
    home: '/surveyor/dashboard',
    codeField: 'surveyorCode',
    codeExample: 'SUR-123456',
    theme: {
      button: 'bg-gold-500 hover:bg-gold-600',
      focus: 'focus:border-gold-500',
      link: 'text-gold-600 hover:text-gold-700',
      badge: 'bg-gold-50 text-gold-700 border-gold-200',
    },
  },
  sanchalak: {
    label: 'Manager / Sanchalak',
    loginTitle: 'Sanchalak Login',
    loginSubtitle: 'Use your Sanchalak ID (SAN-…) or mobile number',
    registerTitle: 'Register Your Kendra',
    registerSubtitle: 'Kisan Vyapar Kendra operator registration',
    icon: FiBriefcase,
    home: '/sanchalak/dashboard',
    codeField: 'sanchalakCode',
    codeExample: 'SAN-123456',
    theme: {
      button: 'bg-sky-600 hover:bg-sky-700',
      focus: 'focus:border-sky-500',
      link: 'text-sky-600 hover:text-sky-700',
      badge: 'bg-sky-50 text-sky-700 border-sky-200',
    },
  },
};

export const ROLE_KEYS = Object.keys(ROLE_CONFIG);

export const resolveRole = (value) => (ROLE_CONFIG[value] ? value : 'customer');

// Query string for a role; Customer is the default and needs none.
export const roleSearch = (role) => (role === 'customer' ? '' : `?role=${role}`);
