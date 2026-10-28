import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import TradeStatusBadge from '../../../shared/components/Produce/TradeStatusBadge';
import { PAYMENT_METHODS, formatDate, formatInr, paymentMethodLabel } from '../../../shared/components/Seed/seedFormat';
import { createSeedRemittance, getSeedAccount, getSeedRemittances } from '../services/surveyorService';

const inputClass = 'w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-gold-500 focus:outline-none transition-colors text-base bg-white';

const Row = ({ label, value, hint, strong, tone = 'text-gray-900' }) => (
  <div className="flex items-start justify-between gap-3 py-2.5">
    <div className="min-w-0">
      <p className={`text-sm ${strong ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{label}</p>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
    <span className={`${strong ? 'text-xl font-bold' : 'text-base font-semibold'} ${tone} whitespace-nowrap`}>{value}</span>
  </div>
);

// What the surveyor has collected from farmers, what they keep as commission, and what is
// still owed to admin. Sending money opens a remittance that admin confirms.
const SeedAccount = () => {
  const [account, setAccount] = useState(null);
  const [remittances, setRemittances] = useState([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([
      getSeedAccount().catch(() => null),
      getSeedRemittances({ limit: 20 }).catch(() => null),
    ]);
    setAccount(a?.data || null);
    setRemittances(r?.data?.requests || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const payable = account?.payableToAdmin || 0;

  const submit = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!(value > 0)) return toast.error('Enter the amount you are sending.');
    if (value > payable) return toast.error(`You can send at most ${formatInr(payable)} right now.`);

    setIsSubmitting(true);
    try {
      await createSeedRemittance({ amount: value, method, reference: reference.trim() });
      toast.success('Sent to admin for confirmation.');
      setAmount('');
      setReference('');
      await load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FieldPanelLayout role="surveyor" title="Seed Account">
      <section className="bg-white rounded-2xl p-5 shadow-sm mb-5">
        <h2 className="text-base font-bold text-gray-900 mb-1">Money from seed</h2>
        <div className="divide-y divide-gray-100">
          <Row label="Collected from farmers" hint="Payments you have confirmed" value={formatInr(account?.collected)} />
          <Row label="Your commission" hint="Earned on seed farmers confirmed receiving" value={`− ${formatInr(account?.commissionEarned)}`} tone="text-green-700" />
          <Row label="Already sent to admin" value={`− ${formatInr(account?.remitted)}`} />
          {account?.remittancePending > 0 && (
            <Row label="Sent, awaiting admin" value={`− ${formatInr(account.remittancePending)}`} tone="text-sky-700" />
          )}
          <Row label="To transfer to admin" value={formatInr(payable)} strong tone={payable > 0 ? 'text-red-600' : 'text-green-700'} />
        </div>

        {(account?.awaitingConfirmation?.amount > 0 || account?.outstandingFromFarmers?.amount > 0) && (
          <div className="mt-4 space-y-2">
            {account.awaitingConfirmation.amount > 0 && (
              <p className="text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
                {formatInr(account.awaitingConfirmation.amount)} reported by farmers but not confirmed by you yet. Confirm it on the
                {' '}<strong>Seed Given</strong> page so it counts here.
              </p>
            )}
            {account.outstandingFromFarmers.amount > 0 && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {formatInr(account.outstandingFromFarmers.amount)} still unpaid by {account.outstandingFromFarmers.count} farmer
                {account.outstandingFromFarmers.count === 1 ? '' : 's'}.
              </p>
            )}
          </div>
        )}
      </section>

      <form onSubmit={submit} className="bg-white rounded-2xl p-5 shadow-sm space-y-4 mb-5">
        <h2 className="text-base font-bold text-gray-900">Send money to admin</h2>
        {payable <= 0 ? (
          <p className="text-sm text-gray-500">Nothing to send right now.</p>
        ) : (
          <>
            <div>
              <label htmlFor="amount" className="block text-sm font-semibold text-gray-700 mb-1.5">Amount (₹)</label>
              <input id="amount" type="number" inputMode="decimal" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(payable)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="method" className="block text-sm font-semibold text-gray-700 mb-1.5">How did you send it?</label>
              <select id="method" value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="reference" className="block text-sm font-semibold text-gray-700 mb-1.5">Reference (optional)</label>
              <input id="reference" type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR, cheque number…" className={inputClass} />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full py-3.5 rounded-2xl bg-gold-500 hover:bg-gold-600 text-white font-bold text-base disabled:opacity-50">
              {isSubmitting ? 'Sending…' : 'Send to Admin'}
            </button>
            <p className="text-xs text-gray-500 text-center">Admin confirms receipt before it comes off your balance.</p>
          </>
        )}
      </form>

      <section className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 mb-2">Transfers</h2>
        {remittances.length === 0 ? (
          <p className="text-sm text-gray-500">No transfers yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {remittances.map((r) => (
              <li key={r.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{formatInr(r.amount)}</p>
                  <p className="text-xs text-gray-500">
                    {paymentMethodLabel(r.method)} · {formatDate(r.paidAt)}
                    {r.reference && ` · ${r.reference}`}
                  </p>
                  {r.adminRemark && r.status === 'not_received' && <p className="text-xs text-red-600 mt-0.5">{r.adminRemark}</p>}
                </div>
                <TradeStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </FieldPanelLayout>
  );
};

export default SeedAccount;
