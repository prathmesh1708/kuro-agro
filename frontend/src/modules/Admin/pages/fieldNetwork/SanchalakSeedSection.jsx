import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TradeStatusBadge from '../../../../shared/components/Produce/TradeStatusBadge';
import { formatDate, formatInr, formatSeedQty } from '../../../../shared/components/Seed/seedFormat';
import { getSanchalakSeedSummary, getSeedIssues } from '../../services/adminService';

const Tile = ({ label, value, hint, tone = 'text-gray-800' }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

/**
 * The seed side of a Sanchalak's admin profile: the commission their Kendra has earned on what
 * their surveyors distributed. Read-only — admin dispatches seed to surveyors, not to Kendras.
 */
const SanchalakSeedSection = ({ sanchalakId }) => {
  const [commission, setCommission] = useState(null);
  const [issues, setIssues] = useState([]);

  const load = useCallback(async () => {
    const [summary, recent] = await Promise.all([
      getSanchalakSeedSummary(sanchalakId).catch(() => null),
      getSeedIssues({ sanchalak: sanchalakId, limit: 10 }).catch(() => null),
    ]);
    setCommission(summary?.data?.commission || null);
    setIssues(recent?.data?.requests || []);
  }, [sanchalakId]);

  useEffect(() => {
    load();
  }, [load]);

  const byItem = commission?.byItem || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Seed Commission</h2>
        <p className="text-sm text-gray-600">What this Kendra earns on seed its surveyors give to farmers</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          label="Earned"
          value={formatInr(commission?.earned?.amount)}
          hint={`${commission?.earned?.count || 0} hand-out${commission?.earned?.count === 1 ? '' : 's'} confirmed by farmers`}
          tone="text-green-700"
        />
        <Tile
          label="Pending"
          value={formatInr(commission?.pending?.amount)}
          hint={`${commission?.pending?.count || 0} awaiting farmer confirmation`}
        />
        <Tile label="Products earned on" value={byItem.length} hint="See the breakdown below" />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <h3 className="font-bold text-gray-800 mb-3">By product</h3>
        {byItem.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing distributed in this Kendra yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">Quantity given</th>
                  <th className="py-2 pr-4">Hand-outs</th>
                  <th className="py-2">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byItem.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 pr-4 font-semibold text-gray-800">{row.seedName}</td>
                    <td className="py-2 pr-4">{formatSeedQty(row.quantity, row.unit)}</td>
                    <td className="py-2 pr-4">{row.issues}</td>
                    <td className="py-2 font-bold text-green-700">{formatInr(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-bold text-gray-800">Recent seed given in this Kendra</h3>
          <Link to={`/admin/field-network/seed-dispatches?sanchalak=${sanchalakId}`} className="text-sm font-semibold text-primary-600 hover:underline">
            Dispatches →
          </Link>
        </div>
        {issues.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing given out yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {issues.map((issue) => (
              <li key={issue.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800">
                    {issue.seedName} · {formatSeedQty(issue.quantity, issue.unit)}
                    <span className="font-normal text-gray-500"> → {issue.kisan?.name}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    <span className="font-mono">{issue.issueCode}</span> · {formatDate(issue.createdAt)}
                    {issue.surveyor?.name && ` · by ${issue.surveyor.name}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {issue.sanchalakCommissionAmount > 0 && (
                    <span className={`font-semibold ${issue.status === 'received' ? 'text-green-700' : 'text-gray-400'}`}>
                      {formatInr(issue.sanchalakCommissionAmount)}
                    </span>
                  )}
                  <TradeStatusBadge status={issue.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SanchalakSeedSection;
