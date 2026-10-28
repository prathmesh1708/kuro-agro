import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import TradeStatusBadge from '../../../shared/components/Produce/TradeStatusBadge';
import { formatDate, formatInr, formatSeedQty, paymentState } from '../../../shared/components/Seed/seedFormat';
import { getSeedIssues } from '../services/kisanService';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'To Confirm' },
  { value: 'received', label: 'Received' },
  { value: 'not_received', label: 'Not Received' },
];

// Seed the surveyor has sent this farmer, newest first.
const SeedRequests = () => {
  const [status, setStatus] = useState('all');
  const [data, setData] = useState({ requests: [], statusCounts: {} });
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const response = await getSeedIssues({ limit: 50, ...(status !== 'all' && { status }) }).catch(() => null);
    setData(response?.data || { requests: [], statusCounts: {} });
    setIsLoading(false);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const totalAll = Object.values(data.statusCounts).reduce((sum, n) => sum + n, 0);

  return (
    <FieldPanelLayout role="kisan" title="Seeds">
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
        {TABS.map((tab) => {
          const count = tab.value === 'all' ? totalAll : data.statusCounts[tab.value] || 0;
          const active = status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap border ${active ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {tab.label} {count > 0 && <span className={active ? 'text-white/80' : 'text-gray-400'}>{count}</span>}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="text-center text-gray-500 py-10">Loading…</p>
      ) : data.requests.length === 0 ? (
        <div className="text-center py-12">
          <Sprout className="mx-auto text-gray-300 mb-2" size={36} />
          <p className="text-sm text-gray-500">No seed sent to you yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.requests.map((issue) => {
            const pay = paymentState(issue.payment);
            return (
              <li key={issue.id}>
                <Link to={`/kisan/seeds/${issue.id}`} className="block bg-white rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{issue.seedName}</p>
                      <p className="text-sm text-gray-600">{formatSeedQty(issue.quantity, issue.unit)} · ₹{issue.pricePerUnit}/{issue.unit}</p>
                      <p className="font-mono text-xs text-gray-500 mt-1">{issue.issueCode} · {formatDate(issue.createdAt)}</p>
                    </div>
                    <span className="text-lg font-bold text-gray-900 whitespace-nowrap">{formatInr(issue.totalAmount)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <TradeStatusBadge status={issue.status} />
                    {issue.status === 'received' && (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${pay.className}`}>{pay.label}</span>
                    )}
                    {issue.status === 'pending' && (
                      <span className="text-[11px] font-semibold text-green-700">Tap to confirm →</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </FieldPanelLayout>
  );
};

export default SeedRequests;
