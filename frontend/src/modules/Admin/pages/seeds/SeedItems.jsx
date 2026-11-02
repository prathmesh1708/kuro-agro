import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2 } from 'react-icons/fi';
import Badge from '../../../../shared/components/Badge';
import { SEED_UNITS, commissionLabel, formatInr, sanchalakCommissionLabel } from '../../../../shared/components/Seed/seedFormat';
import { createSeedItem, getProduceList, getSeedItems, updateSeedItem, updateSeedItemStatus } from '../../services/adminService';

const EMPTY_BAND = { perUnit: '', min: '', max: '' };
const EMPTY = {
  name: '', nameHi: '', unit: 'kg', produce: '', defaultPricePerUnit: '', basis: '', basisHi: '',
  surveyor: { ...EMPTY_BAND }, sanchalak: { ...EMPTY_BAND },
};

const inputClass = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500';

const BAND_FIELDS = [['perUnit', 'Rate'], ['min', 'Minimum'], ['max', 'Maximum']];

// A commission band: the rate used, plus the agreed band for range-priced items.
const BandFields = ({ idPrefix, legend, unit, band, onChange }) => (
  <fieldset className="border border-gray-200 rounded-lg p-3">
    <legend className="text-sm font-semibold text-gray-700 px-1">{legend} (₹ per {unit})</legend>
    <div className="grid grid-cols-3 gap-3">
      {BAND_FIELDS.map(([key, label]) => (
        <div key={key}>
          <label htmlFor={`${idPrefix}-${key}`} className="block text-xs text-gray-600 mb-1">{label}</label>
          <input
            id={`${idPrefix}-${key}`}
            type="number"
            min="0"
            step="0.01"
            required={key === 'perUnit'}
            value={band[key]}
            onChange={(e) => onChange({ ...band, [key]: e.target.value })}
            className={inputClass}
          />
        </div>
      ))}
    </div>
  </fieldset>
);

/** Normalises a band from the form; an empty min or max means the rate is fixed. */
const toBand = (band, label) => {
  const perUnit = Number(band.perUnit || 0);
  const min = band.min === '' ? perUnit : Number(band.min);
  const max = band.max === '' ? perUnit : Number(band.max);
  if (min > max) return { error: `The ${label} minimum cannot be above the maximum.` };
  if (perUnit < min || perUnit > max) return { error: `The ${label} rate must sit between the minimum and maximum.` };
  return { value: { perUnit, min, max } };
};

// The seed / input catalog admin distributes through the field network, with the commission band
// the surveyor and their Kendra's Sanchalak each earn on it.
const SeedItems = () => {
  const [items, setItems] = useState([]);
  const [produce, setProduce] = useState([]);
  const [form, setForm] = useState(null); // null | { id?, ...EMPTY }
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    const [i, p] = await Promise.all([getSeedItems().catch(() => null), getProduceList().catch(() => null)]);
    setItems(i?.data?.items || []);
    setProduce(p?.data?.produce || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => setForm({ ...EMPTY });

  const openEdit = (item) => setForm({
    id: item.id,
    name: item.name,
    nameHi: item.nameHi || '',
    unit: item.unit,
    produce: item.produce || '',
    defaultPricePerUnit: String(item.defaultPricePerUnit ?? ''),
    basis: item.basis || '',
    basisHi: item.basisHi || '',
    surveyor: {
      perUnit: String(item.commission?.perUnit ?? ''),
      min: String(item.commission?.min ?? ''),
      max: String(item.commission?.max ?? ''),
    },
    sanchalak: {
      perUnit: String(item.sanchalakCommission?.perUnit ?? ''),
      min: String(item.sanchalakCommission?.min ?? ''),
      max: String(item.sanchalakCommission?.max ?? ''),
    },
  });

  const save = async (e) => {
    e.preventDefault();
    const surveyor = toBand(form.surveyor, 'surveyor commission');
    if (surveyor.error) return toast.error(surveyor.error);
    const sanchalak = toBand(form.sanchalak, 'Sanchalak commission');
    if (sanchalak.error) return toast.error(sanchalak.error);

    const payload = {
      name: form.name.trim(),
      nameHi: form.nameHi.trim(),
      unit: form.unit,
      produce: form.produce || null,
      defaultPricePerUnit: Number(form.defaultPricePerUnit || 0),
      basis: form.basis.trim(),
      basisHi: form.basisHi.trim(),
      commission: surveyor.value,
      sanchalakCommission: sanchalak.value,
    };

    setIsSaving(true);
    try {
      if (form.id) await updateSeedItem(form.id, payload);
      else await createSeedItem(payload);
      toast.success(form.id ? 'Seed item updated.' : 'Seed item added.');
      setForm(null);
      await load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = async (item) => {
    try {
      await updateSeedItemStatus(item.id, !item.isActive);
      await load();
    } catch {
      // The API client already shows the error message.
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">Seeds &amp; Inputs</h1>
          <p className="text-sm sm:text-base text-gray-600">
            What you send to surveyors, and the commission the surveyor and their Kendra each earn per unit
          </p>
        </div>
        <button type="button" onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 gradient-green text-white rounded-lg font-semibold text-sm">
          <FiPlus /> Add Item
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
              <th className="py-3 px-4">Item</th>
              <th className="py-3 px-4">Unit</th>
              <th className="py-3 px-4">Default price</th>
              <th className="py-3 px-4">Surveyor commission</th>
              <th className="py-3 px-4">Sanchalak commission</th>
              <th className="py-3 px-4">Linked crop</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-gray-500">No seed items yet.</td></tr>
            ) : items.map((item) => (
              <tr key={item.id}>
                <td className="py-3 px-4">
                  <p className="font-semibold text-gray-800">{item.name}</p>
                  {item.nameHi && <p className="text-xs text-gray-500">{item.nameHi}</p>}
                </td>
                <td className="py-3 px-4 text-gray-700">{item.unit}</td>
                <td className="py-3 px-4 text-gray-700">{item.defaultPricePerUnit ? formatInr(item.defaultPricePerUnit) : '—'}</td>
                <td className="py-3 px-4 font-semibold text-gray-800">{commissionLabel(item)}</td>
                <td className="py-3 px-4 font-semibold text-gray-800">
                  {item.sanchalakCommission?.perUnit > 0 || item.sanchalakCommission?.max > 0
                    ? sanchalakCommissionLabel(item)
                    : <span className="font-normal text-amber-600">Not set</span>}
                </td>
                <td className="py-3 px-4 text-gray-600">{produce.find((p) => String(p.id) === String(item.produce))?.name || '—'}</td>
                <td className="py-3 px-4">
                  <button type="button" onClick={() => toggle(item)}>
                    <Badge variant={item.isActive ? 'approved' : 'warning'}>{item.isActive ? 'Active' : 'Hidden'}</Badge>
                  </button>
                </td>
                <td className="py-3 px-4 text-right">
                  <button type="button" onClick={() => openEdit(item)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label={`Edit ${item.name}`}>
                    <FiEdit2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !isSaving && setForm(null)}>
          <form onSubmit={save} className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800">{form.id ? 'Edit seed item' : 'Add seed item'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1.5">Name</label>
                <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClass} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="nameHi" className="block text-sm font-semibold text-gray-700 mb-1.5">Hindi name</label>
                <input id="nameHi" value={form.nameHi} onChange={(e) => setForm({ ...form, nameHi: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="unit" className="block text-sm font-semibold text-gray-700 mb-1.5">Unit</label>
                <select id="unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputClass}>
                  {SEED_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="price" className="block text-sm font-semibold text-gray-700 mb-1.5">Default price (₹)</label>
                <input id="price" type="number" min="0" step="0.01" value={form.defaultPricePerUnit} onChange={(e) => setForm({ ...form, defaultPricePerUnit: e.target.value })} className={inputClass} />
              </div>
              <div className="col-span-2">
                <label htmlFor="produce" className="block text-sm font-semibold text-gray-700 mb-1.5">Linked crop (optional)</label>
                <select id="produce" value={form.produce} onChange={(e) => setForm({ ...form, produce: e.target.value })} className={inputClass}>
                  <option value="">Not linked</option>
                  {produce.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Surveyors see this item first for farmers who registered that crop.
                </p>
              </div>
            </div>

            <BandFields
              idPrefix="surveyor"
              legend="Surveyor commission"
              unit={form.unit}
              band={form.surveyor}
              onChange={(band) => setForm({ ...form, surveyor: band })}
            />

            <BandFields
              idPrefix="sanchalak"
              legend="Sanchalak commission"
              unit={form.unit}
              band={form.sanchalak}
              onChange={(band) => setForm({ ...form, sanchalak: band })}
            />

            <p className="text-xs text-gray-500">
              Leave min and max equal to the rate for a fixed commission. A band (e.g. ₹1–₹50) lets you pick any rate
              inside it when you dispatch. The Sanchalak of the surveyor's Kendra earns their rate on the same hand-out.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="basis" className="block text-sm font-semibold text-gray-700 mb-1.5">Basis of payment</label>
                <input id="basis" value={form.basis} onChange={(e) => setForm({ ...form, basis: e.target.value })} placeholder="Verified quantity accepted by the company" className={inputClass} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="basisHi" className="block text-sm font-semibold text-gray-700 mb-1.5">Basis in Hindi</label>
                <input id="basisHi" value={form.basisHi} onChange={(e) => setForm({ ...form, basisHi: e.target.value })} className={inputClass} />
              </div>
              <p className="col-span-2 text-xs text-gray-500">
                Shown under the rate on the Sanchalak's earning model card in their app.
              </p>
            </div>

            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Changing a rate applies only to dispatches sent <strong>after</strong> you save. Commission already promised does not change.
            </p>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setForm(null)} disabled={isSaving} className="px-4 py-2.5 rounded-lg bg-gray-100 font-semibold text-sm text-gray-700">Cancel</button>
              <button type="submit" disabled={isSaving} className="px-5 py-2.5 gradient-green text-white rounded-lg font-semibold text-sm disabled:opacity-50">
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </motion.div>
  );
};

export default SeedItems;
