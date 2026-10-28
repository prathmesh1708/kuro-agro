import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiX, FiCheckCircle, FiClock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import TradeStatusBadge from '../../../shared/components/Produce/TradeStatusBadge';
import RequestHistory from '../../../shared/components/Produce/RequestHistory';
import { PAYMENT_METHODS, formatDate, formatInr, formatSeedQty, paymentMethodLabel, paymentState } from '../../../shared/components/Seed/seedFormat';
import { decideSeedIssue, getSeedIssue, updateSeedPayment } from '../services/kisanService';

const inputClass = 'w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none transition-colors text-base bg-white';

const Line = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 py-2">
    <span className="text-sm text-gray-600">{label}</span>
    <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
  </div>
);

// The farmer confirms the seed arrived, then records what they paid the surveyor and how.
const SeedRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState(null);
  const [decision, setDecision] = useState(null); // 'received' | 'not_received'
  const [remark, setRemark] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await getSeedIssue(id).catch(() => null);
    setIssue(response?.data || null);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const submitDecision = async () => {
    if (decision === 'not_received' && !remark.trim()) {
      toast.error('Please say why you did not receive it.');
      return;
    }
    setIsBusy(true);
    try {
      await decideSeedIssue(id, { decision, remark: remark.trim() });
      toast.success(decision === 'received' ? 'Confirmed. Now record your payment.' : 'Marked as not received.');
      setDecision(null);
      setRemark('');
      await load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsBusy(false);
    }
  };

  const submitPayment = async (paid) => {
    setIsBusy(true);
    try {
      await updateSeedPayment(id, paid ? { status: 'paid', method, reference: reference.trim() } : { status: 'unpaid' });
      toast.success(paid ? 'Payment recorded. Your surveyor will confirm it.' : 'Marked as not paid.');
      await load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsBusy(false);
    }
  };

  if (!issue) {
    return (
      <FieldPanelLayout role="kisan" title="Seed">
        <p className="text-center text-gray-500 py-12">Loading…</p>
      </FieldPanelLayout>
    );
  }

  const pay = paymentState(issue.payment);
  const isPaid = issue.payment?.status === 'paid';
  const locked = issue.payment?.confirmedBySurveyor;

  return (
    <FieldPanelLayout role="kisan" title="Seed">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
        <FiArrowLeft /> Back
      </button>

      <section className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{issue.seedName}</h1>
            <p className="font-mono text-xs text-gray-500 mt-1">{issue.issueCode}</p>
          </div>
          <TradeStatusBadge status={issue.status} />
        </div>
        <div className="divide-y divide-gray-100 mt-3">
          <Line label="From surveyor" value={`${issue.surveyor?.name || '—'} · ${issue.surveyor?.surveyorCode || ''}`} />
          <Line label="Quantity" value={formatSeedQty(issue.quantity, issue.unit)} />
          <Line label="Price" value={`₹${issue.pricePerUnit} / ${issue.unit}`} />
          <Line label="You pay" value={formatInr(issue.totalAmount)} />
          <Line label="Sent" value={formatDate(issue.createdAt)} />
          {issue.surveyorNote && <Line label="Note" value={issue.surveyorNote} />}
        </div>
      </section>

      {issue.status === 'pending' && (
        <section className="bg-white rounded-2xl p-5 shadow-sm mb-4 space-y-3">
          <h2 className="text-base font-bold text-gray-900">Did you receive this seed?</h2>
          <p className="text-sm text-gray-600">क्या आपको यह बीज मिल गया?</p>
          {decision ? (
            <>
              <textarea
                rows={3}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={decision === 'received' ? 'Any note (optional)' : 'Why did you not receive it?'}
                className={inputClass}
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setDecision(null)} disabled={isBusy} className="flex-1 py-3 rounded-xl bg-gray-100 font-semibold text-sm text-gray-700">
                  Back
                </button>
                <button type="button" onClick={submitDecision} disabled={isBusy} className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm disabled:opacity-50">
                  {isBusy ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => { setDecision('received'); setRemark(''); }} className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-base">
                <FiCheck /> Received
              </button>
              <button type="button" onClick={() => { setDecision('not_received'); setRemark(''); }} className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-base border border-red-200">
                <FiX /> Not Received
              </button>
            </div>
          )}
        </section>
      )}

      {issue.status === 'received' && (
        <section className="bg-white rounded-2xl p-5 shadow-sm mb-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-gray-900">Payment</h2>
            <span className="text-lg font-bold text-gray-900">{formatInr(issue.totalAmount)}</span>
          </div>

          {isPaid ? (
            <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${pay.className}`}>
              {locked ? <FiCheckCircle className="mt-0.5 shrink-0" /> : <FiClock className="mt-0.5 shrink-0" />}
              <div>
                <p className="font-semibold">{pay.label}</p>
                <p className="text-xs mt-0.5">
                  {paymentMethodLabel(issue.payment.method)}
                  {issue.payment.reference ? ` · ${issue.payment.reference}` : ''} · {formatDate(issue.payment.paidAt)}
                </p>
                {!locked && <p className="text-xs mt-1">Your surveyor will confirm this.</p>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Have you paid your surveyor for this seed? / क्या आपने भुगतान कर दिया है?</p>
          )}

          {!isPaid && (
            <>
              <div>
                <label htmlFor="method" className="block text-sm font-semibold text-gray-700 mb-1.5">How did you pay?</label>
                <select id="method" value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="reference" className="block text-sm font-semibold text-gray-700 mb-1.5">Reference (optional)</label>
                <input id="reference" type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI ref, receipt number…" className={inputClass} />
              </div>
              <button type="button" onClick={() => submitPayment(true)} disabled={isBusy} className="w-full py-3.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-base disabled:opacity-50">
                {isBusy ? 'Saving…' : `I have paid ${formatInr(issue.totalAmount)}`}
              </button>
            </>
          )}

          {isPaid && !locked && (
            <button type="button" onClick={() => submitPayment(false)} disabled={isBusy} className="w-full py-2.5 rounded-xl bg-gray-100 font-semibold text-sm text-gray-700 disabled:opacity-50">
              Undo — I have not paid yet
            </button>
          )}
        </section>
      )}

      {issue.history?.length > 0 && <RequestHistory history={issue.history} />}
    </FieldPanelLayout>
  );
};

export default SeedRequestDetail;
