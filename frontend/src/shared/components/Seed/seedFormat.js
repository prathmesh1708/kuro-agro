// Formatting for the seed distribution screens (Admin → Surveyor → Kisan).
// Unlike produce, seed quantities are stored in the item's own unit (kg, kit, plant…) as entered.

export { formatInr, formatDate, formatDateTime, PAYMENT_METHODS, paymentMethodLabel, ACTOR_LABELS, HISTORY_LABELS } from '../Produce/produceFormat';

export const formatSeedQty = (quantity, unit = 'kg') =>
  `${Number(quantity || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${unit}`;

export const seedLabel = (item) => (item?.nameHi ? `${item.name} / ${item.nameHi}` : item?.name || '');

export const SEED_UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'packet', label: 'packet' },
  { value: 'kit', label: 'kit' },
  { value: 'plant', label: 'plant' },
  { value: 'litre', label: 'litre' },
  { value: 'bag', label: 'bag' },
];

/** A commission band as text: "₹25 per kg" or "₹500 – ₹1,000 per plant". */
export const bandLabel = (band, unit = 'unit') => {
  const { perUnit = 0, min = 0, max = 0 } = band || {};
  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  return max && max !== min ? `${inr(min)} – ${inr(max)} per ${unit}` : `${inr(perUnit)} per ${unit}`;
};

/** The surveyor's band on a catalog item, and on a Sanchalak rate card row (already projected). */
export const commissionLabel = (item) => bandLabel(item?.commission, item?.unit || 'unit');

/** The Sanchalak's band on a raw catalog item. */
export const sanchalakCommissionLabel = (item) => bandLabel(item?.sanchalakCommission, item?.unit || 'unit');

/** How a seed issue's payment reads to each side. */
export const paymentState = (payment) => {
  if (payment?.status !== 'paid') return { key: 'unpaid', label: 'Not paid', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (payment.confirmedBySurveyor) return { key: 'confirmed', label: 'Paid & confirmed', className: 'bg-green-50 text-green-700 border-green-200' };
  return { key: 'reported', label: 'Paid, awaiting confirmation', className: 'bg-sky-50 text-sky-700 border-sky-200' };
};
