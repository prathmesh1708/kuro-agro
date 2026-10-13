import { STATUS_META } from './produceFormat';

const TradeStatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, className: 'bg-gray-50 text-gray-700 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${meta.className}`}>
      {meta.label}
    </span>
  );
};

export const PaymentBadge = ({ payment }) =>
  payment?.status === 'paid' ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold bg-green-50 text-green-700 border-green-200">Paid</span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold bg-orange-50 text-orange-700 border-orange-200">Unpaid</span>
  );

export default TradeStatusBadge;
