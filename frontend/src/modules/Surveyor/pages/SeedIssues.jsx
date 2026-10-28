import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiCheck, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import TradeStatusBadge from '../../../shared/components/Produce/TradeStatusBadge';
import { formatDate, formatInr, formatSeedQty, paymentState } from '../../../shared/components/Seed/seedFormat';
import { confirmSeedPayment, getSeedIssues } from '../services/surveyorService';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Waiting' },
  { value: 'received', label: 'Received' },
  { value: 'not_received', label: 'Not Received' },
];

// Seed this surveyor has given out, and the payments farmers have reported against it.
const SeedIssues = () => {
  const [status, setStatus] = useState('all');
  const [data, setData] = useState({ requests: [], statusCounts: {}, pagination: { pages: 1 } });
  const [isLoading, setIsLoading] = useState(true);
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const response = await getSeedIssues({ limit: 50, ...(status !== 'all' && { status }) }).catch(() => null);
    setData(response?.data || { requests: [], statusCounts: {}, pagination: { pages: 1 } });
    setIsLoading(false);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const confirm = async (issue, confirmed) => {
    setConfirming(issue.id);
    try {
      await confirmSeedPayment(issue.id, { confirmed, remark: confirmed ? '' : 'Payment not received' });
      toast.success(confirmed ? 'Payment confirmed.' : 'Marked as not received.');
      await load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setConfirming(null);
    }
  };

  const totalAll = Object.values(data.statusCounts).reduce((sum, n) => sum + n, 0);

  return (
    <FieldPanelLayout role="surveyor" title="Seed Given">
      <Link
        to="/surveyor/seed-issues/new"
        className="flex items-center justify-center gap-2 w-full bg-gold-500 hover:bg-gold-600 text-white py-3.5 rounded-2xl font-bold text-base shadow-sm mb-4"
      >
        <FiPlus size={20} /> Give Seed to a Farmer
      </Link>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
        {TABS.map((tab) => {
          const count = tab.value === 'all' ? totalAll : data.statusCounts[tab.value] || 0;
          const active = status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap border ${active ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {tab.label} {count > 0 && <span className={active ? 'text-white/80' : 'text-gray-400'}>{count}</span>}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="text-center text-gray-500 py-10">Loading…</p>
      ) : data.requests.length === 0 ? (
        <p className="text-center text-gray-500 py-10">Nothing here yet.</p>
      ) : (
        <ul className="space-y-3">
          {data.requests.map((issue) => {
            const pay = paymentState(issue.payment);
            const needsConfirming = issue.status === 'received' && issue.payment?.status === 'paid' && !issue.payment?.confirmedBySurveyor;
            return (
              <li key={issue.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <Link to={`/surveyor/seed-issues/${issue.id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{issue.seedName}</p>
                      <p className="text-sm text-gray-600 truncate">{issue.kisan?.name} · {issue.kisan?.kisanCode}</p>
                      <p className="font-mono text-xs text-gray-500 mt-1">{issue.issueCode} · {formatDate(issue.createdAt)}</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="font-bold text-gray-900">{formatInr(issue.totalAmount)}</p>
                      <p className="text-xs text-gray-500">{formatSeedQty(issue.quantity, issue.unit)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <TradeStatusBadge status={issue.status} />
                    {issue.status === 'received' && (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${pay.className}`}>{pay.label}</span>
                    )}
                    {issue.commissionAmount > 0 && issue.status === 'received' && (
                      <span className="text-[11px] font-semibold text-gold-700">+{formatInr(issue.commissionAmount)} commission</span>
                    )}
                  </div>
                </Link>

                {needsConfirming && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      disabled={confirming === issue.id}
                      onClick={() => confirm(issue, true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm disabled:opacity-50"
                    >
                      <FiCheck /> Got the money
                    </button>
                    <button
                      type="button"
                      disabled={confirming === issue.id}
                      onClick={() => confirm(issue, false)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm border border-red-200 disabled:opacity-50"
                    >
                      <FiX /> Not yet
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </FieldPanelLayout>
  );
};

export default SeedIssues;
