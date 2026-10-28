import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiSend } from 'react-icons/fi';
import TradeStatusBadge from '../../../../shared/components/Produce/TradeStatusBadge';
import { commissionLabel, formatDate, formatInr, formatSeedQty, paymentMethodLabel, paymentState } from '../../../../shared/components/Seed/seedFormat';
import {
  createSeedDispatch,
  getSeedDispatches,
  getSeedIssues,
  getSeedItems,
  getSurveyorSeedSummary,
} from '../../services/adminService';

const inputClass = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500';

const Tile = ({ label, value, hint, tone = 'text-gray-800' }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

/**
 * The seed side of a surveyor's admin profile: send them seed, see what they hold,
 * what they gave to farmers, and what they still owe.
 */
const SurveyorSeedSection = ({ surveyorId, canDispatch }) => {
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [issues, setIssues] = useState([]);
  const [form, setForm] = useState({ seedItem: '', quantity: '', pricePerUnit: '', commissionPerUnit: '', note: '' });
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(async () => {
    const [s, i, d, iss] = await Promise.all([
      getSurveyorSeedSummary(surveyorId).catch(() => null),
      getSeedItems().catch(() => null),
      getSeedDispatches({ surveyor: surveyorId, limit: 10 }).catch(() => null),
      getSeedIssues({ surveyor: surveyorId, limit: 10 }).catch(() => null),
    ]);
    setSummary(s?.data || null);
    setItems((i?.data?.items || []).filter((item) => item.isActive));
    setDispatches(d?.data?.requests || []);
    setIssues(iss?.data?.requests || []);
  }, [surveyorId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(() => items.find((i) => i.id === form.seedItem), [items, form.seedItem]);
  const total = Number(form.quantity) > 0 && Number(form.pricePerUnit) >= 0 ? Number(form.quantity) * Number(form.pricePerUnit) : 0;

  const send = async (e) => {
    e.preventDefault();
    if (!selected) return toast.error('Choose a seed.');
    if (!(Number(form.quantity) > 0)) return toast.error('Enter the quantity.');
    if (form.pricePerUnit === '' || Number(form.pricePerUnit) < 0) return toast.error('Enter the price.');

    setIsSending(true);
    try {
      await createSeedDispatch({
        surveyor: surveyorId,
        seedItem: selected.id,
        quantity: Number(form.quantity),
        pricePerUnit: Number(form.pricePerUnit),
        ...(form.commissionPerUnit !== '' && { commissionPerUnit: Number(form.commissionPerUnit) }),
        note: form.note.trim(),
      });
      toast.success('Sent. The surveyor will confirm when it arrives.');
      setForm({ seedItem: '', quantity: '', pricePerUnit: '', commissionPerUnit: '', note: '' });
      await load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSending(false);
    }
  };

  const account = summary?.account || {};
  const stock = summary?.stock || { items: [], totals: {} };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Seeds</h2>
        <p className="text-sm text-gray-600">What this surveyor holds, gave to farmers, and owes you</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Collected from farmers" value={formatInr(account.collected)} hint="Payments the surveyor confirmed" />
        <Tile label="Commission earned" value={formatInr(account.commissionEarned)} tone="text-green-700" />
        <Tile label="Sent to you" value={formatInr(account.remitted)} hint={account.remittancePending > 0 ? `${formatInr(account.remittancePending)} awaiting your confirmation` : undefined} />
        <Tile label="Still to transfer" value={formatInr(account.payableToAdmin)} tone={account.payableToAdmin > 0 ? 'text-red-600' : 'text-green-700'} />
      </div>

      {(account.awaitingConfirmation?.amount > 0 || account.outstandingFromFarmers?.amount > 0) && (
        <div className="space-y-2">
          {account.awaitingConfirmation?.amount > 0 && (
            <p className="text-sm text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
              {formatInr(account.awaitingConfirmation.amount)} reported by farmers but not yet confirmed by the surveyor, so it is not counted above.
            </p>
          )}
          {account.outstandingFromFarmers?.amount > 0 && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {formatInr(account.outstandingFromFarmers.amount)} still unpaid by {account.outstandingFromFarmers.count} farmer
              {account.outstandingFromFarmers.count === 1 ? '' : 's'}.
            </p>
          )}
        </div>
      )}

      {canDispatch ? (
        <form onSubmit={send} className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 space-y-4">
          <h3 className="font-bold text-gray-800">Send seed to this surveyor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <label htmlFor="seedItem" className="block text-sm font-semibold text-gray-700 mb-1.5">Seed</label>
              <select
                id="seedItem"
                value={form.seedItem}
                onChange={(e) => {
                  const item = items.find((i) => i.id === e.target.value);
                  setForm({
                    ...form,
                    seedItem: e.target.value,
                    pricePerUnit: item?.defaultPricePerUnit ? String(item.defaultPricePerUnit) : '',
                    commissionPerUnit: item?.commission?.perUnit != null ? String(item.commission.perUnit) : '',
                  });
                }}
                className={inputClass}
              >
                <option value="">Choose a seed…</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {selected && <p className="mt-1 text-xs text-gray-500">Commission band: {commissionLabel(selected)}</p>}
            </div>
            <div>
              <label htmlFor="quantity" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Quantity{selected ? ` (${selected.unit})` : ''}
              </label>
              <input id="quantity" type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-semibold text-gray-700 mb-1.5">Price per {selected?.unit || 'unit'} (₹)</label>
              <input id="price" type="number" min="0" step="0.01" value={form.pricePerUnit} onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="commission" className="block text-sm font-semibold text-gray-700 mb-1.5">Commission per {selected?.unit || 'unit'} (₹)</label>
              <input id="commission" type="number" min="0" step="0.01" value={form.commissionPerUnit} onChange={(e) => setForm({ ...form, commissionPerUnit: e.target.value })} className={inputClass} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="note" className="block text-sm font-semibold text-gray-700 mb-1.5">Note (optional)</label>
              <input id="note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Batch, transport, instructions…" className={inputClass} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Value <span className="text-lg font-bold text-gray-900">{formatInr(total)}</span>
            </p>
            <button type="submit" disabled={isSending} className="inline-flex items-center gap-2 px-5 py-2.5 gradient-green text-white rounded-lg font-semibold text-sm disabled:opacity-50">
              <FiSend /> {isSending ? 'Sending…' : 'Send Seed'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            The surveyor marks it received or not received. Only then does it enter their stock, at the commission rate above.
          </p>
        </form>
      ) : (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Seed can only be sent to an approved, active surveyor.
        </p>
      )}

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <h3 className="font-bold text-gray-800 mb-3">Seed held</h3>
        {stock.items.length === 0 ? (
          <p className="text-sm text-gray-500">No seed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4">Seed</th>
                  <th className="py-2 pr-4">Available</th>
                  <th className="py-2 pr-4">With farmers, awaiting confirmation</th>
                  <th className="py-2 pr-4">Received from you</th>
                  <th className="py-2 pr-4">Given to farmers</th>
                  <th className="py-2">Last received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stock.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-4 font-semibold text-gray-800">{item.seedName}</td>
                    <td className="py-2 pr-4 font-bold text-gray-900">{formatSeedQty(item.available, item.unit)}</td>
                    <td className="py-2 pr-4">{formatSeedQty(item.reserved, item.unit)}</td>
                    <td className="py-2 pr-4">{formatSeedQty(item.receivedQty, item.unit)} <span className="text-xs text-gray-500">{formatInr(item.receivedValue)}</span></td>
                    <td className="py-2 pr-4">{formatSeedQty(item.issuedQty, item.unit)} <span className="text-xs text-gray-500">{formatInr(item.issuedValue)}</span></td>
                    <td className="py-2">{formatDate(item.lastReceivedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-bold text-gray-800">Recent dispatches</h3>
          <Link to={`/admin/field-network/seed-dispatches?surveyor=${surveyorId}`} className="text-sm font-semibold text-primary-600 hover:underline">
            All dispatches →
          </Link>
        </div>
        {dispatches.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing sent yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {dispatches.map((d) => (
              <li key={d.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800">{d.seedName} · {formatSeedQty(d.quantity, d.unit)}</p>
                  <p className="text-xs text-gray-500 font-mono">{d.dispatchCode} · {formatDate(d.createdAt)}</p>
                  {d.surveyorRemark && d.status === 'not_received' && <p className="text-xs text-red-600">{d.surveyorRemark}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">{formatInr(d.totalAmount)}</span>
                  <TradeStatusBadge status={d.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <h3 className="font-bold text-gray-800 mb-3">Recent seed given to farmers</h3>
        {issues.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing given out yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {issues.map((issue) => {
              const pay = paymentState(issue.payment);
              return (
                <li key={issue.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">
                      {issue.seedName} · {formatSeedQty(issue.quantity, issue.unit)}
                      <span className="font-normal text-gray-500"> → {issue.kisan?.name}</span>
                    </p>
                    <p className="text-xs text-gray-500 font-mono">{issue.issueCode} · {formatDate(issue.createdAt)}</p>
                    {issue.status === 'received' && issue.payment?.status === 'paid' && (
                      <p className="text-xs text-gray-500">
                        Paid by {paymentMethodLabel(issue.payment.method)}
                        {issue.payment.reference ? ` · ${issue.payment.reference}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">{formatInr(issue.totalAmount)}</span>
                    <TradeStatusBadge status={issue.status} />
                    {issue.status === 'received' && (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${pay.className}`}>{pay.label}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SurveyorSeedSection;
