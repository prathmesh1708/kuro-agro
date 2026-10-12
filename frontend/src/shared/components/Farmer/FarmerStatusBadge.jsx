import { REGISTRATION_STATUS_META } from '../../constants/farmerRegistration';

const FarmerStatusBadge = ({ status }) => {
  const meta = REGISTRATION_STATUS_META[status] || { label: status, className: 'bg-gray-50 text-gray-700 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${meta.className}`}>
      {meta.label}
    </span>
  );
};

export default FarmerStatusBadge;
