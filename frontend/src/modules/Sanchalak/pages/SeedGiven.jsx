import { useCallback, useEffect, useState } from 'react';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import TradeStatusBadge from '../../../shared/components/Produce/TradeStatusBadge';
import { formatDate, formatInr, formatSeedQty } from '../../../shared/components/Seed/seedFormat';
import { getKendraSeedIssues } from '../services/sanchalakService';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Waiting' },
  { value: 'received', label: 'Received' },
  { value: 'not_received', label: 'Not Received' },
];

const EMPTY = { requests: [], statusCounts: {}, pagination: { pages: 1 } };

// Seed and inputs the surveyors of this Kendra have given to farmers, with the commission the
// Sanchalak earns on each. Read-only: the surveyors run the distribution and collect the money.
const SeedGiven = () => {
  const [status, setStatus] = useState('all');
  const [data, setData] = useState(EMPTY);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const response = await getKendraSeedIssues({ limit: 50, ...(status !== 'all' && { status }) }).catch(() => null);
    setData(response?.data || EMPTY);
    setIsLoading(false);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const earned = data.requests
    .filter((issue) => issue.status === 'received')
    .reduce((sum, issue) => sum + (issue.sanchalakCommissionAmount || 0), 0);

  return (
    <FieldPanelLayout role="sanchalak" title="Seed Given">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Seed Given in My Kendra</h1>
        <p className="text-sm text-gray-500">What your surveyors have distributed, and what you earn on it.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors ${
              status === tab.value ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {tab.label}
            {tab.value !== 'all' && data.statusCounts[tab.value] ? ` (${data.statusCounts[tab.value]})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 bg-white rounded-2xl p-4 shadow-sm mt-3">Loading…</p>
      ) : data.requests.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-2xl p-4 shadow-sm mt-3">
          No seed has been given out in your Kendra yet.
        </p>
      ) : (
        <>
          {earned > 0 && (
            <p className="text-sm text-sky-900 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 mt-3">
              <strong>{formatInr(earned)}</strong> earned on the hand-outs shown here.
            </p>
          )}
          <ul className="space-y-2 mt-3">
            {data.requests.map((issue) => (
              <li key={issue.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{issue.seedName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatSeedQty(issue.quantity, issue.unit)} · {formatInr(issue.totalAmount)}
                    </p>
                  </div>
                  <TradeStatusBadge status={issue.status} />
                </div>

                <p className="text-xs text-gray-600 mt-2">
                  {issue.surveyor?.name || 'Surveyor'} → {issue.kisan?.name || 'Farmer'}
                </p>
                <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    <span className="font-mono">{issue.issueCode}</span> · {formatDate(issue.decidedAt || issue.createdAt)}
                  </p>
                  {issue.sanchalakCommissionAmount > 0 && (
                    <p className={`text-sm font-bold shrink-0 ${issue.status === 'received' ? 'text-green-600' : 'text-gray-400'}`}>
                      {issue.status === 'received' ? '+' : ''}
                      {formatInr(issue.sanchalakCommissionAmount)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </FieldPanelLayout>
  );
};

export default SeedGiven;
