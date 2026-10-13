// Formatting shared by the Kisan, Sanchalak and Admin produce screens.
// The API stores quantities as whole kg; screens show them in the produce's unit (usually quintal).

export const UNIT_KG = { quintal: 100, kg: 1 };

export const UNIT_LABEL = { quintal: 'quintal', kg: 'kg' };

export const toUnits = (kg, unit) => (Number(kg) || 0) / (UNIT_KG[unit] || 1);

export const formatQty = (kg, unit = 'quintal') =>
  `${toUnits(kg, unit).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${UNIT_LABEL[unit] || unit}`;

export const formatInr = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

export const produceLabel = (produce) => (produce?.nameHi ? `${produce.name} / ${produce.nameHi}` : produce?.name || '');

export const STATUS_META = {
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  purchased: { label: 'Purchased', className: 'bg-green-50 text-green-700 border-green-200' },
  not_purchased: { label: 'Not Purchased', className: 'bg-red-50 text-red-700 border-red-200' },
  received: { label: 'Received', className: 'bg-green-50 text-green-700 border-green-200' },
  not_received: { label: 'Not Received', className: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-50 text-gray-600 border-gray-200' },
};

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export const paymentMethodLabel = (value) => PAYMENT_METHODS.find((m) => m.value === value)?.label || value;

export const HISTORY_LABELS = {
  submitted: 'Submitted',
  purchased: 'Purchased',
  not_purchased: 'Not purchased',
  received: 'Received',
  not_received: 'Not received',
  cancelled: 'Cancelled',
  payment_marked_paid: 'Marked paid',
  payment_marked_unpaid: 'Marked unpaid',
};

export const ACTOR_LABELS = { kisan: 'Farmer', sanchalak: 'Sanchalak', admin: 'Admin' };

/** Final quantity and amount: what was purchased if decided, else the offer. */
export const finalTerms = (request) => request?.purchased?.quantityKg
  ? request.purchased
  : { quantityKg: request?.quantityKg, pricePerUnit: request?.pricePerUnit, totalAmount: request?.totalAmount };
