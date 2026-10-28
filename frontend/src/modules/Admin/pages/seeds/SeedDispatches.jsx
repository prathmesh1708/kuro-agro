import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';
import TradeStatusBadge from '../../../../shared/components/Produce/TradeStatusBadge';
import { formatDate, formatInr, formatSeedQty } from '../../../../shared/components/Seed/seedFormat';
import { cancelSeedDispatch, getSeedDispatches } from '../../services/adminService';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Awaiting surveyor' },
  { value: 'received', label: 'Received' },
  { value: 'not_received', label: 'Not received' },
  { value: 'cancelled', label: 'Cancelled' },
];

// Seed admin has sent to surveyors, and how each surveyor responded.
const SeedDispatches = () => {
  const [params] = useSearchParams();
  const surveyorFilter = params.get('surveyor') || '';
  const [status, setStatus] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ requests: [], statusCounts: {}, pagination: { pages: 1 } });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setIsLoading(true);
    const response = await getSeedDispatches({
      page,
      limit: 20,
      ...(status !== 'all' && { status }),
      ...(search && { search }),
      ...(surveyorFilter && { surveyor: surveyorFilter }),
    }).catch(() => null);
    setData(response?.data || { requests: [], statusCounts: {}, pagination: { pages: 1 } });
    setIsLoading(false);
  }, [page, status, search, surveyorFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (dispatch) => {
    try {
      await cancelSeedDispatch(dispatch.id, 'Withdrawn by admin');
      toast.success('Dispatch cancelled.');
      await load();
    } catch {
      // The API client already shows the error message.
    }
  };

  const totalAll = Object.values(data.statusCounts).reduce((sum, n) => sum + n, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">Seed Dispatches</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Seed sent to surveyors. Send a new one from a surveyor&apos;s profile.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const count = tab.value === 'all' ? totalAll : data.statusCounts[tab.value] || 0;
          const active = status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => { setStatus(tab.value); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border ${active ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {tab.label} {count > 0 && <span className={active ? 'text-white/80' : 'text-gray-400'}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by code, seed or surveyor…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
              <th className="py-3 px-4">Code</th>
              <th className="py-3 px-4">Surveyor</th>
              <th className="py-3 px-4">Seed</th>
              <th className="py-3 px-4">Quantity</th>
              <th className="py-3 px-4">Value</th>
              <th className="py-3 px-4">Commission</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="py-10 text-center text-gray-500">Loading…</td></tr>
            ) : data.requests.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-gray-500">No dispatches yet.</td></tr>
            ) : data.requests.map((d) => (
              <tr key={d.id}>
                <td className="py-3 px-4">
                  <p className="font-mono font-semibold text-gray-800">{d.dispatchCode}</p>
                  <p className="text-xs text-gray-500">{formatDate(d.createdAt)}</p>
                </td>
                <td className="py-3 px-4">
                  <Link to={`/admin/field-network/surveyors/${d.surveyor?._id || d.surveyor}`} className="font-semibold text-primary-600 hover:underline">
                    {d.surveyor?.name || '—'}
                  </Link>
                  <p className="text-xs text-gray-500 font-mono">{d.surveyor?.surveyorCode}</p>
                </td>
                <td className="py-3 px-4 font-semibold text-gray-800">{d.seedName}</td>
                <td className="py-3 px-4 text-gray-700">{formatSeedQty(d.quantity, d.unit)}</td>
                <td className="py-3 px-4 font-semibold text-gray-900">{formatInr(d.totalAmount)}</td>
                <td className="py-3 px-4 text-gray-700">₹{d.commissionPerUnit}/{d.unit}</td>
                <td className="py-3 px-4">
                  <TradeStatusBadge status={d.status} />
                  {d.surveyorRemark && d.status === 'not_received' && (
                    <p className="text-xs text-red-600 mt-1 max-w-[200px]">{d.surveyorRemark}</p>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  {d.status === 'pending' && (
                    <button type="button" onClick={() => cancel(d)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold">
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-semibold disabled:opacity-40">Previous</button>
          <span className="text-sm text-gray-600">Page {page} of {data.pagination.pages}</span>
          <button type="button" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-semibold disabled:opacity-40">Next</button>
        </div>
      )}
    </motion.div>
  );
};

export default SeedDispatches;
