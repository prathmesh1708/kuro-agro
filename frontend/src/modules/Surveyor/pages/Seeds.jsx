import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPackage, FiCheck, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import { formatDate, formatInr, formatSeedQty } from '../../../shared/components/Seed/seedFormat';
import { decideSeedDispatch, getSeedDispatches, getSeedStock } from '../services/surveyorService';

// Seed the surveyor holds, and the dispatches from admin still waiting on their answer.
const SurveyorSeeds = () => {
  const [stock, setStock] = useState(null);
  const [pending, setPending] = useState([]);
  const [action, setAction] = useState(null); // { dispatch, decision }
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [stockRes, pendingRes] = await Promise.all([
      getSeedStock().catch(() => null),
      getSeedDispatches({ status: 'pending', limit: 50 }).catch(() => null),
    ]);
    setStock(stockRes?.data || { items: [], totals: {} });
    setPending(pendingRes?.data?.requests || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (action.decision === 'not_received' && !remark.trim()) {
      toast.error('Please tell admin why the seed was not received.');
      return;
    }
    setIsSubmitting(true);
    try {
      await decideSeedDispatch(action.dispatch.id, { decision: action.decision, remark: remark.trim() });
      toast.success(action.decision === 'received' ? 'Seed added to your stock.' : 'Marked as not received.');
      setAction(null);
      setRemark('');
      await load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FieldPanelLayout role="surveyor" title="Seeds">
      {pending.length > 0 && (
        <section className="mb-5 space-y-3">
          <h2 className="text-base font-bold text-gray-900">Waiting for your confirmation</h2>
          {pending.map((d) => (
            <article key={d.id} className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{d.seedName}</p>
                  <p className="text-sm text-gray-600">
                    {formatSeedQty(d.quantity, d.unit)} · ₹{d.pricePerUnit}/{d.unit}
                  </p>
                  <p className="font-mono text-xs text-gray-500 mt-1">{d.dispatchCode} · {formatDate(d.createdAt)}</p>
                  {d.adminNote && <p className="text-sm text-gray-600 mt-1">{d.adminNote}</p>}
                </div>
                <span className="text-lg font-bold text-gray-900 whitespace-nowrap">{formatInr(d.totalAmount)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Your commission: ₹{d.commissionPerUnit}/{d.unit}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => { setAction({ dispatch: d, decision: 'received' }); setRemark(''); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm"
                >
                  <FiCheck /> Received
                </button>
                <button
                  type="button"
                  onClick={() => { setAction({ dispatch: d, decision: 'not_received' }); setRemark(''); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm border border-red-200"
                >
                  <FiX /> Not Received
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-bold text-gray-900">My Seed Stock</h2>
          <Link to="/surveyor/seed-issues/new" className="text-sm font-semibold text-gold-600 hover:underline">
            Give to a farmer →
          </Link>
        </div>
        {!stock ? (
          <p className="text-sm text-gray-500 py-4">Loading…</p>
        ) : stock.items.length === 0 ? (
          <div className="text-center py-8">
            <FiPackage className="mx-auto text-gray-300 mb-2" size={32} />
            <p className="text-sm text-gray-500">No seed yet. Admin will send you some.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {stock.items.map((item) => (
              <li key={item.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{item.seedName}</p>
                  <p className="text-xs text-gray-500">
                    Received {formatSeedQty(item.receivedQty, item.unit)} · Given out {formatSeedQty(item.issuedQty, item.unit)}
                    {item.reserved > 0 && ` · ${formatSeedQty(item.reserved, item.unit)} awaiting farmers`}
                  </p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="text-lg font-bold text-gray-900">{formatSeedQty(item.available, item.unit)}</p>
                  <p className="text-[11px] text-gray-500">available</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !isSubmitting && setAction(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">
              {action.decision === 'received' ? 'Confirm you received' : 'Report not received'}
            </h3>
            <p className="text-sm text-gray-600">
              {formatSeedQty(action.dispatch.quantity, action.dispatch.unit)} of {action.dispatch.seedName} · {formatInr(action.dispatch.totalAmount)}
            </p>
            <textarea
              rows={3}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={action.decision === 'received' ? 'Any note for admin (optional)' : 'Why was it not received?'}
              className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-gold-500 focus:outline-none text-sm"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setAction(null)} disabled={isSubmitting} className="flex-1 py-2.5 rounded-xl bg-gray-100 font-semibold text-sm text-gray-700">
                Cancel
              </button>
              <button type="button" onClick={submit} disabled={isSubmitting} className="flex-1 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-white font-bold text-sm disabled:opacity-50">
                {isSubmitting ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FieldPanelLayout>
  );
};

export default SurveyorSeeds;
