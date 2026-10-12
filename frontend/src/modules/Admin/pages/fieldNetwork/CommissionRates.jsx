import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getFieldCommissionRates, updateFieldCommissionRates } from '../../services/adminService';

const FIELDS = [
  { key: 'surveyorPerFarmer', label: 'Surveyor commission per approved farmer', hint: 'Credited to the surveyor who registered the farmer' },
  { key: 'sanchalakPerFarmer', label: 'Sanchalak commission per approved farmer', hint: 'Credited to the Kendra the surveyor belongs to' },
];

const CommissionRates = () => {
  const [values, setValues] = useState({ surveyorPerFarmer: '', sanchalakPerFarmer: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getFieldCommissionRates()
      .then((response) => {
        const data = response?.data || {};
        setValues({ surveyorPerFarmer: String(data.surveyorPerFarmer ?? 0), sanchalakPerFarmer: String(data.sanchalakPerFarmer ?? 0) });
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(FIELDS.map(({ key }) => [key, Number(values[key])]));
    if (Object.values(payload).some((n) => !Number.isFinite(n) || n < 0)) {
      toast.error('Enter a valid amount (0 or more) for both rates.');
      return;
    }
    setIsSaving(true);
    try {
      await updateFieldCommissionRates(payload);
      toast.success('Commission rates saved.');
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Field Commission</h1>
        <p className="text-sm sm:text-base text-gray-600">Fixed amount (₹) earned for every farmer you approve</p>
      </div>

      <form onSubmit={save} className="bg-white rounded-xl p-5 sm:p-6 shadow-sm border border-gray-200 space-y-5">
        {FIELDS.map(({ key, label, hint }) => (
          <div key={key}>
            <label htmlFor={key} className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
              <input
                id={key}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={values[key]}
                disabled={isLoading}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">{hint}</p>
          </div>
        ))}
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          A new rate applies only to farmers approved <strong>after</strong> you save. Commission already earned does not change.
        </p>
        <button
          type="submit"
          disabled={isLoading || isSaving}
          className="px-5 py-2.5 gradient-green text-white rounded-lg font-semibold text-sm disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save Rates'}
        </button>
      </form>
    </motion.div>
  );
};

export default CommissionRates;
