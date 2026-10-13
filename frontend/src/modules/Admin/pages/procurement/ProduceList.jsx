import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import Badge from '../../../../shared/components/Badge';
import { createProduce, getProduceList, updateProduce, updateProduceStatus } from '../../services/adminService';

const EMPTY_FORM = { id: null, name: '', nameHi: '', unit: 'quintal' };

// The crops Kisans and Sanchalaks can pick in their sell forms.
const ProduceList = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await getProduceList();
      setRows(response?.data?.produce || []);
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error('Please enter a name.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = { name: form.name.trim(), nameHi: form.nameHi.trim(), unit: form.unit };
      if (form.id) {
        await updateProduce(form.id, payload);
        toast.success('Produce updated.');
      } else {
        await createProduce(payload);
        toast.success('Produce added.');
      }
      setForm(EMPTY_FORM);
      load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = async (row) => {
    try {
      await updateProduceStatus(row.id, !row.isActive);
      load();
    } catch {
      // The API client already shows the error message.
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Produce',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-semibold text-gray-800">{value}</p>
          {row.nameHi && <p className="text-xs text-gray-500">{row.nameHi}</p>}
        </div>
      ),
    },
    { key: 'unit', label: 'Priced per', sortable: true, render: (value) => <span className="capitalize">{value}</span> },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (value) => <Badge variant={value ? 'approved' : 'warning'}>{value ? 'Shown' : 'Hidden'}</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setForm({ id: row.id, name: row.name, nameHi: row.nameHi || '', unit: row.unit })}
            className="px-3 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => toggle(row)}
            className={`px-3 py-1 rounded-lg text-xs font-bold ${row.isActive ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
          >
            {row.isActive ? 'Hide' : 'Show'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Produce List</h1>
        <p className="text-sm sm:text-base text-gray-600">Crops farmers and Kendras can choose when they sell. Hidden items keep their history.</p>
      </div>

      <form onSubmit={save} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label htmlFor="produce-name" className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
          <input id="produce-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} placeholder="e.g. Wheat" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label htmlFor="produce-name-hi" className="block text-sm font-semibold text-gray-700 mb-1">Hindi name</label>
          <input id="produce-name-hi" value={form.nameHi} onChange={(e) => setForm({ ...form, nameHi: e.target.value })} maxLength={60} placeholder="e.g. गेहूं" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label htmlFor="produce-unit" className="block text-sm font-semibold text-gray-700 mb-1">Priced per</label>
          <select id="produce-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="quintal">Quintal</option>
            <option value="kg">Kg</option>
          </select>
        </div>
        <div className="flex gap-2">
          {form.id && (
            <button type="button" onClick={() => setForm(EMPTY_FORM)} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          )}
          <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 rounded-lg font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50">
            {isSaving ? 'Saving…' : form.id ? 'Save' : 'Add Produce'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        {isLoading ? <p className="text-center text-gray-500 py-8">Loading…</p> : <DataTable data={rows} columns={columns} pagination={false} />}
      </div>
    </motion.div>
  );
};

export default ProduceList;
