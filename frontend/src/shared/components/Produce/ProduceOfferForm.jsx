import { useMemo, useState } from 'react';
import { formatInr, formatQty, produceLabel, toUnits } from './produceFormat';

const inputClass = (focus) =>
  `w-full px-4 py-3 rounded-xl border-2 border-gray-200 ${focus} focus:outline-none transition-colors text-base bg-white`;

/**
 * Sell form: pick a produce, enter quantity and price per unit, see the total.
 * Used by the Kisan (sell to Kendra) and the Sanchalak (sell to admin, limited to warehouse stock).
 * @param {Array}    produceOptions  [{ id, name, nameHi, unit, availableKg? }]
 * @param {Function} onSubmit        ({ produce, quantity, pricePerUnit, note }) => Promise
 * @param {Object}   theme           { focus, button } Tailwind classes for the role
 */
const ProduceOfferForm = ({ produceOptions, onSubmit, submitLabel, theme, priceHint, notePlaceholder = 'Quality, moisture, packing…' }) => {
  const [produceId, setProduceId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selected = useMemo(() => produceOptions.find((p) => p.id === produceId), [produceOptions, produceId]);
  const unit = selected?.unit || 'quintal';
  const maxUnits = selected?.availableKg !== undefined ? toUnits(selected.availableKg, unit) : undefined;
  const total = Number(quantity) > 0 && Number(price) >= 0 ? Number(quantity) * Number(price) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selected) return setError('Please choose a produce.');
    if (!(Number(quantity) > 0)) return setError('Please enter the quantity.');
    if (maxUnits !== undefined && Number(quantity) > maxUnits) return setError(`Only ${formatQty(selected.availableKg, unit)} is available.`);
    if (price === '' || Number(price) < 0) return setError('Please enter the price.');

    setIsSubmitting(true);
    try {
      await onSubmit({ produce: selected.id, quantity: Number(quantity), pricePerUnit: Number(price), note: note.trim() });
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 space-y-4">
      <div>
        <label htmlFor="produce" className="block text-sm font-semibold text-gray-700 mb-1.5">Produce / फसल</label>
        <select id="produce" value={produceId} onChange={(e) => setProduceId(e.target.value)} className={inputClass(theme.focus)}>
          <option value="">Select produce</option>
          {produceOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {produceLabel(p)}
              {p.availableKg !== undefined ? ` — ${formatQty(p.availableKg, p.unit)} available` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="quantity" className="block text-sm font-semibold text-gray-700 mb-1.5">Quantity ({unit})</label>
          <input
            id="quantity"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            max={maxUnits}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputClass(theme.focus)}
            placeholder="0"
          />
          {maxUnits !== undefined && <p className="mt-1 text-xs text-gray-500">Max {formatQty(selected.availableKg, unit)}</p>}
        </div>
        <div>
          <label htmlFor="price" className="block text-sm font-semibold text-gray-700 mb-1.5">Price (₹/{unit})</label>
          <input
            id="price"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputClass(theme.focus)}
            placeholder="0"
          />
          {priceHint && <p className="mt-1 text-xs text-gray-500">{priceHint}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="note" className="block text-sm font-semibold text-gray-700 mb-1.5">Note (optional)</label>
        <textarea
          id="note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass(theme.focus)}
          placeholder={notePlaceholder}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
        <span className="text-sm font-semibold text-gray-600">Total amount</span>
        <span className="text-xl font-bold text-gray-900">{formatInr(total)}</span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || produceOptions.length === 0}
        className={`w-full text-white py-3.5 rounded-xl font-semibold text-base transition-all disabled:opacity-50 ${theme.button}`}
      >
        {isSubmitting ? 'Sending…' : submitLabel}
      </button>
    </form>
  );
};

export default ProduceOfferForm;
