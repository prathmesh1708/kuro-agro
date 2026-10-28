import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import { formatInr, formatSeedQty } from '../../../shared/components/Seed/seedFormat';
import { createSeedIssue, getMyKisans, getSeedStock } from '../services/surveyorService';

const inputClass = 'w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-gold-500 focus:outline-none transition-colors text-base bg-white';

// Give seed from the surveyor's stock to one of their farmers. Seed matching the crops on that
// farmer's registration is listed first, since that is what they came to the surveyor for.
const IssueSeed = () => {
  const navigate = useNavigate();
  const [kisans, setKisans] = useState([]);
  const [stock, setStock] = useState([]);
  const [kisanId, setKisanId] = useState('');
  const [seedId, setSeedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getMyKisans().catch(() => null), getSeedStock().catch(() => null)]).then(([k, s]) => {
      setKisans(k?.data?.kisans || []);
      setStock((s?.data?.items || []).filter((item) => item.available > 0));
    });
  }, []);

  const kisan = useMemo(() => kisans.find((k) => k.id === kisanId), [kisans, kisanId]);

  // Seed whose linked crop is one the farmer registered, first; everything else after.
  const options = useMemo(() => {
    if (!kisan) return stock.map((item) => ({ ...item, matchesCrop: false }));
    const cropIds = new Set((kisan.crops || []).map((c) => String(c.produce || '')).filter(Boolean));
    const cropNames = new Set((kisan.crops || []).map((c) => c.name.toLowerCase()));
    const scored = stock.map((item) => ({
      ...item,
      matchesCrop: cropIds.has(String(item.produce || '')) || cropNames.has(item.seedName.toLowerCase()),
    }));
    return [...scored.filter((i) => i.matchesCrop), ...scored.filter((i) => !i.matchesCrop)];
  }, [kisan, stock]);

  const selected = useMemo(() => stock.find((i) => i.seedItem === seedId || i.id === seedId), [stock, seedId]);
  const total = Number(quantity) > 0 && Number(price) >= 0 ? Number(quantity) * Number(price) : 0;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!kisan) return setError('Please choose a farmer.');
    if (!selected) return setError('Please choose a seed.');
    if (!(Number(quantity) > 0)) return setError('Please enter the quantity.');
    if (Number(quantity) > selected.available) {
      return setError(`Only ${formatSeedQty(selected.available, selected.unit)} of ${selected.seedName} is available.`);
    }
    if (price === '' || Number(price) < 0) return setError('Please enter the price.');

    setIsSubmitting(true);
    try {
      await createSeedIssue({
        kisan: kisan.id,
        seedItem: selected.seedItem,
        quantity: Number(quantity),
        pricePerUnit: Number(price),
        note: note.trim(),
      });
      toast.success(`Sent to ${kisan.name}.`);
      navigate('/surveyor/seed-issues');
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FieldPanelLayout role="surveyor" title="Give Seed">
      <form onSubmit={submit} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <label htmlFor="kisan" className="block text-sm font-semibold text-gray-700 mb-1.5">Farmer / किसान</label>
          <select id="kisan" value={kisanId} onChange={(e) => setKisanId(e.target.value)} className={inputClass}>
            <option value="">Choose a farmer…</option>
            {kisans.map((k) => (
              <option key={k.id} value={k.id}>{k.name} · {k.kisanCode}</option>
            ))}
          </select>
          {kisans.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Only farmers whose registration admin has approved can be given seed.
            </p>
          )}
          {kisan?.crops?.length > 0 && (
            <p className="mt-1 text-xs text-gray-500">Crops: {kisan.crops.map((c) => c.name).join(', ')}</p>
          )}
        </div>

        <div>
          <label htmlFor="seed" className="block text-sm font-semibold text-gray-700 mb-1.5">Seed / बीज</label>
          <select
            id="seed"
            value={seedId}
            onChange={(e) => {
              setSeedId(e.target.value);
              setPrice('');
            }}
            className={inputClass}
          >
            <option value="">Choose a seed…</option>
            {options.map((item) => (
              <option key={item.id} value={item.seedItem}>
                {item.matchesCrop ? '★ ' : ''}{item.seedName} — {formatSeedQty(item.available, item.unit)} available
              </option>
            ))}
          </select>
          {stock.length === 0 && <p className="mt-1 text-xs text-amber-700">You have no seed in stock yet.</p>}
          {options.some((i) => i.matchesCrop) && (
            <p className="mt-1 text-xs text-gray-500">★ matches a crop on this farmer&apos;s registration</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="quantity" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Quantity{selected ? ` (${selected.unit})` : ''}
            </label>
            <input id="quantity" type="number" inputMode="decimal" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="price" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Price per {selected?.unit || 'unit'} (₹)
            </label>
            <input id="price" type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="note" className="block text-sm font-semibold text-gray-700 mb-1.5">Note (optional)</label>
          <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Variety, packing, sowing advice…" className={inputClass} />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-gold-50 border border-gold-200 px-4 py-3">
          <span className="text-sm font-semibold text-gold-800">Farmer pays</span>
          <span className="text-xl font-bold text-gold-900">{formatInr(total)}</span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-2xl bg-gold-500 hover:bg-gold-600 text-white font-bold text-base disabled:opacity-50">
          {isSubmitting ? 'Sending…' : 'Send to Farmer'}
        </button>
        <p className="text-xs text-gray-500 text-center">
          The farmer confirms they received it, then records what they paid you.
        </p>
      </form>
    </FieldPanelLayout>
  );
};

export default IssueSeed;
