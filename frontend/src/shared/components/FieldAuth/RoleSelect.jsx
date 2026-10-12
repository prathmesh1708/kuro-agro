import { FiChevronDown } from 'react-icons/fi';
import { ROLE_CONFIG, ROLE_KEYS } from './roleConfig';

const RoleSelect = ({ value, onChange, label = 'Login as' }) => {
  const { icon: Icon, theme } = ROLE_CONFIG[value];

  return (
    <div className="mb-6">
      <label htmlFor="role-select" className="block text-sm font-semibold text-gray-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <select
          id="role-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full appearance-none pl-12 pr-10 py-3 rounded-xl border-2 border-gray-200 ${theme.focus} focus:outline-none bg-white text-base font-semibold text-gray-800 transition-colors`}
        >
          {ROLE_KEYS.map((key) => (
            <option key={key} value={key}>
              {ROLE_CONFIG[key].label}
            </option>
          ))}
        </select>
        <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
};

export default RoleSelect;
