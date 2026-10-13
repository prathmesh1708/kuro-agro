import { FiUser, FiClipboard, FiBriefcase } from 'react-icons/fi';

// Roles selectable on the shared /login and /register pages. Kisan is the existing customer account.
// Theme classes are written out in full so Tailwind can find them.
export const ROLE_CONFIG = {
  kisan: {
    label: 'Kisan',
    loginTitle: 'Welcome Back',
    loginSubtitle: 'Log in with your email or phone number and password',
    registerTitle: 'Create Account',
    registerSubtitle: 'Sign up to get started with KuroAgro',
    icon: FiUser,
    home: '/home',
    theme: {
      button: 'bg-primary-500 hover:bg-primary-600',
      focus: 'focus:border-primary-500',
      link: 'text-primary-600 hover:text-primary-700',
      badge: 'bg-primary-50 text-primary-700 border-primary-200',
    },
  },
  surveyor: {
    label: 'Surveyor',
    loginTitle: 'Surveyor Login',
    loginSubtitle: 'Use your Surveyor ID (SUR-…), email or phone',
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
    loginSubtitle: 'Use your Sanchalak ID (SAN-…), email or phone',
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

export const resolveRole = (value) => (ROLE_CONFIG[value] ? value : 'kisan');

// Query string for a role; Kisan is the default and needs none.
export const roleSearch = (role) => (role === 'kisan' ? '' : `?role=${role}`);
