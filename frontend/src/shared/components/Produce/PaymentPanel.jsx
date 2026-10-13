import { useState } from 'react';
import { FiCheckCircle, FiClock } from 'react-icons/fi';
import { PAYMENT_METHODS, formatDate, formatInr, paymentMethodLabel } from './produceFormat';

/**
 * Payment state of an accepted request. With `onSave`, the payer can mark it paid (method + reference)
 * or undo that; without it the panel is read-only (e.g. the payee's view).
 * @param {Function} [onSave]  ({ status, method?, reference? }) => Promise
 */
const PaymentPanel = ({ payment, amount, title = 'Payment', paidText, unpaidText, onSave, buttonClass = 'bg-green-600 hover:bg-green-700' }) => {
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isPaid = payment?.status === 'paid';

  const save = async (payload) => {
    setIsSaving(true);
    try {
      await onSave(payload);
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <span className="text-lg font-bold text-gray-900">{formatInr(amount)}</span>
      </div>

      {isPaid ? (
        <div className="flex items-start gap-2 rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          <FiCheckCircle className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{paidText || 'Paid'}</p>
            <p className="text-xs mt-0.5">
              {paymentMethodLabel(payment.method)}
              {payment.reference ? ` · Ref ${payment.reference}` : ''} · {formatDate(payment.paidAt)}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800">
          <FiClock className="mt-0.5 shrink-0" />
          <p className="font-semibold">{unpaidText || 'Not paid yet'}</p>
        </div>
      )}

      {onSave && !isPaid && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pay-method" className="block text-xs font-semibold text-gray-600 mb-1">Method</label>
              <select
                id="pay-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-gray-400 bg-white text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pay-ref" className="block text-xs font-semibold text-gray-600 mb-1">Reference (optional)</label>
              <input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={120}
                placeholder="UPI / cheque no."
                className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-gray-400 bg-white text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => save({ status: 'paid', method, reference: reference.trim() })}
            className={`w-full text-white py-3 rounded-xl font-semibold disabled:opacity-50 ${buttonClass}`}
          >
            {isSaving ? 'Saving…' : 'Mark as Paid'}
          </button>
        </div>
      )}

      {onSave && isPaid && (
        <button
          type="button"
          disabled={isSaving}
          onClick={() => save({ status: 'unpaid' })}
          className="w-full py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Undo — mark as unpaid'}
        </button>
      )}
    </section>
  );
};

export default PaymentPanel;
