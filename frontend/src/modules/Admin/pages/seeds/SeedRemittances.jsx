import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import TradeStatusBadge from '../../../../shared/components/Produce/TradeStatusBadge';
import { formatDate, formatInr, paymentMethodLabel } from '../../../../shared/components/Seed/seedFormat';
import { decideSeedRemittance, getSeedRemittances, getSeedStockOverview } from '../../services/adminService';

const TABS = [
  { value: 'pending', label: 'Awaiting you' },
  { value: 'received', label: 'Received' },
  { value: 'not_received', label: 'Not received' },
  { value: 'all', label: 'All' },
];

const Tile = ({ label, value, hint }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
    <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

// Money surveyors have sent in from seed sales. Confirming it clears it off their balance.
const SeedRemittances = () => {
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState({ requests: [], statusCounts: {} });
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [action, setAction] = useState(null); // { row, decision }
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [list, o] = await Promise.all([
      getSeedRemittances({ limit: 50, ...(status !== 'all' && { status }) }).catch(() => null),
      getSeedStockOverview().catch(() => null),
    ]);
    setData(list?.data || { requests: [], statusCounts: {} });
    setOverview(o?.data || null);
    setIsLoading(false);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (action.decision === 'not_received' && !remark.trim()) {
      toast.error('Please give the surveyor a reason.');
      return;
    }
    setIsSubmitting(true);
    try {
      await decideSeedRemittance(action.row.id, { decision: action.decision, remark: remark.trim() });
      toast.success(action.decision === 'received' ? 'Marked as received.' : 'Marked as not received.');
      setAction(null);
      setRemark('');
      await load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSubmitting(false);
    }
  };

  const money = overview?.money || {};
  const totalAll = Object.values(data.statusCounts).reduce((sum, n) => sum + n, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">Seed Payments</h1>
        <p className="text-sm sm:text-base text-gray-600">Money surveyors have collected from farmers and sent in</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Collected by surveyors" value={formatInr(money.collected)} hint="Confirmed payments from farmers" />
        <Tile label="Their commission" value={formatInr(money.commission)} />
        <Tile label="Received by you" value={formatInr(money.remitted)} />
        <Tile label="Still due from surveyors" value={formatInr(money.dueFromSurveyors)} hint={`${overview?.pendingRemittances?.count || 0} transfer(s) awaiting you`} />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const count = tab.value === 'all' ? totalAll : data.statusCounts[tab.value] || 0;
          const active = status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border ${active ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {tab.label} {count > 0 && <span className={active ? 'text-white/80' : 'text-gray-400'}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
              <th className="py-3 px-4">Code</th>
              <th className="py-3 px-4">Surveyor</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="py-10 text-center text-gray-500">Loading…</td></tr>
            ) : data.requests.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-gray-500">Nothing here.</td></tr>
            ) : data.requests.map((r) => (
              <tr key={r.id}>
                <td className="py-3 px-4">
                  <p className="font-mono font-semibold text-gray-800">{r.remittanceCode}</p>
                  <p className="text-xs text-gray-500">{formatDate(r.paidAt)}</p>
                </td>
                <td className="py-3 px-4">
                  <Link to={`/admin/field-network/surveyors/${r.surveyor?._id || r.surveyor}`} className="font-semibold text-primary-600 hover:underline">
                    {r.surveyor?.name || '—'}
                  </Link>
                  <p className="text-xs text-gray-500 font-mono">{r.surveyor?.surveyorCode}</p>
                </td>
                <td className="py-3 px-4 text-lg font-bold text-gray-900">{formatInr(r.amount)}</td>
                <td className="py-3 px-4 text-gray-700">
                  {paymentMethodLabel(r.method)}
                  {r.reference && <p className="text-xs text-gray-500">{r.reference}</p>}
                </td>
                <td className="py-3 px-4">
                  <TradeStatusBadge status={r.status} />
                  {r.adminRemark && r.status === 'not_received' && <p className="text-xs text-red-600 mt-1 max-w-[200px]">{r.adminRemark}</p>}
                </td>
                <td className="py-3 px-4 text-right">
                  {r.status === 'pending' && (
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => { setAction({ row: r, decision: 'received' }); setRemark(''); }} className="px-3 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 text-xs font-semibold">
                        Received
                      </button>
                      <button type="button" onClick={() => { setAction({ row: r, decision: 'not_received' }); setRemark(''); }} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold">
                        Not received
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !isSubmitting && setAction(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800">
              {action.decision === 'received' ? 'Confirm this payment' : 'Mark as not received'}
            </h2>
            <p className="text-sm text-gray-600">
              {formatInr(action.row.amount)} from {action.row.surveyor?.name} by {paymentMethodLabel(action.row.method)}
              {action.row.reference ? ` (${action.row.reference})` : ''}.
            </p>
            <textarea
              rows={3}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={action.decision === 'received' ? 'Note (optional)' : 'Why was it not received?'}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAction(null)} disabled={isSubmitting} className="px-4 py-2.5 rounded-lg bg-gray-100 font-semibold text-sm text-gray-700">Cancel</button>
              <button type="button" onClick={submit} disabled={isSubmitting} className="px-5 py-2.5 gradient-green text-white rounded-lg font-semibold text-sm disabled:opacity-50">
                {isSubmitting ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default SeedRemittances;
