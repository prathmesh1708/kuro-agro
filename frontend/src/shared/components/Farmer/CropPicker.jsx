import { useState } from 'react';
import { FiPlus, FiX } from 'react-icons/fi';

const OTHER = '__other__';

/**
 * Pick the crops a farmer grows: choose from the produce list, or pick "Other" and type a name.
 * value / onChange: [{ produce?, name }] — `produce` is set for crops from the list.
 * @param {Array} options  [{ id, name, nameHi }]
 */
const CropPicker = ({ value = [], onChange, options = [], hasError = false }) => {
  const [selected, setSelected] = useState('');
  const [otherName, setOtherName] = useState('');

  const chosen = new Set(value.map((c) => c.name.toLowerCase()));
  const available = options.filter((o) => !chosen.has(o.name.toLowerCase()));

  const add = (crop) => {
    if (!crop.name || chosen.has(crop.name.toLowerCase())) return;
    onChange([...value, crop]);
  };

  const handleSelect = (e) => {
    const next = e.target.value;
    if (next === OTHER) {
      setSelected(OTHER);
      return;
    }
    const option = options.find((o) => o.id === next);
    if (option) add({ produce: option.id, name: option.name });
    setSelected('');
  };

  const addOther = () => {
    const name = otherName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) return;
    // A typed name that is already on the list is linked to it.
    const option = options.find((o) => o.name.toLowerCase() === name.toLowerCase());
    add(option ? { produce: option.id, name: option.name } : { name });
    setOtherName('');
    setSelected('');
  };

  const border = hasError ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-gold-500';

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((crop) => (
            <li key={crop.name} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-gold-50 border border-gold-200 text-sm font-semibold text-gold-900">
              {crop.name}
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => c.name !== crop.name))}
                className="p-0.5 rounded-full hover:bg-gold-100"
                aria-label={`Remove ${crop.name}`}
              >
                <FiX size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <select value={selected} onChange={handleSelect} className={`w-full px-4 py-3 rounded-xl border-2 ${border} focus:outline-none transition-colors text-base bg-white`}>
        <option value="">{value.length ? 'Add another crop / और फसल जोड़ें' : 'Select crop / फसल चुनें'}</option>
        {available.map((o) => (
          <option key={o.id} value={o.id}>{o.nameHi ? `${o.name} / ${o.nameHi}` : o.name}</option>
        ))}
        <option value={OTHER}>Other — type name / अन्य</option>
      </select>

      {selected === OTHER && (
        <div className="flex gap-2">
          <input
            type="text"
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOther();
              }
            }}
            maxLength={60}
            autoFocus
            placeholder="Crop name, e.g. Sugarcane"
            className={`flex-1 min-w-0 px-4 py-3 rounded-xl border-2 ${border} focus:outline-none text-base bg-white`}
          />
          <button
            type="button"
            onClick={addOther}
            disabled={otherName.trim().length < 2}
            className="shrink-0 inline-flex items-center gap-1 px-4 rounded-xl bg-gold-500 hover:bg-gold-600 text-white font-semibold disabled:opacity-50"
          >
            <FiPlus /> Add
          </button>
        </div>
      )}
    </div>
  );
};

export const cropNames = (crops = []) => crops.map((c) => c.name).join(', ');

export default CropPicker;
