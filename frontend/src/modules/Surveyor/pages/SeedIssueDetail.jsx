import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import TradeStatusBadge from '../../../shared/components/Produce/TradeStatusBadge';
import RequestHistory from '../../../shared/components/Produce/RequestHistory';
import { formatDate, formatInr, formatSeedQty, paymentMethodLabel, paymentState } from '../../../shared/components/Seed/seedFormat';
import { cancelSeedIssue, confirmSeedPayment, getSeedIssue } from '../services/surveyorService';

const Line = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 py-2">
    <span className="text-sm text-gray-600">{label}</span>
    <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
  </div>
);

const SeedIssueDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await getSeedIssue(id).catch(() => null);
    setIssue(response?.data || null);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const confirm = async (confirmed) => {
    setIsBusy(true);
    try {
      await confirmSeedPayment(id, { confirmed, remark: confirmed ? '' : 'Payment not received' });
      toast.success(confirmed ? 'Payment confirmed.' : 'Marked as not received.');
      await load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsBusy(false);
    }
  };

  const cancel = async () => {
    setIsBusy(true);
    try {
      await cancelSeedIssue(id, 'Withdrawn by surveyor');
      toast.success('Cancelled. The seed is back in your stock.');
      navigate('/surveyor/seed-issues');
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsBusy(false);
    }
  };

  if (!issue) {
    return (
      <FieldPanelLayout role="surveyor" title="Seed">
        <p className="text-center text-gray-500 py-12">Loading…</p>
      </FieldPanelLayout>
    );
  }

  const pay = paymentState(issue.payment);
  const needsConfirming = issue.status === 'received' && issue.payment?.status === 'paid' && !issue.payment?.confirmedBySurveyor;

  return (
    <FieldPanelLayout role="surveyor" title="Seed">
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
          <Line label="Farmer" value={`${issue.kisan?.name || '—'} · ${issue.kisan?.kisanCode || ''}`} />
          <Line label="Quantity" value={formatSeedQty(issue.quantity, issue.unit)} />
          <Line label="Price" value={`₹${issue.pricePerUnit} / ${issue.unit}`} />
          <Line label="Farmer pays" value={formatInr(issue.totalAmount)} />
          <Line label="Your commission" value={`${formatInr(issue.commissionAmount)} (₹${issue.commissionPerUnit}/${issue.unit})`} />
          <Line label="Sent" value={formatDate(issue.createdAt)} />
          {issue.kisanRemark && <Line label="Farmer's note" value={issue.kisanRemark} />}
        </div>
      </section>

      {issue.status === 'received' && (
        <section className="bg-white rounded-2xl p-5 shadow-sm mb-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-gray-900">Payment</h2>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${pay.className}`}>{pay.label}</span>
          </div>
          {issue.payment?.status === 'paid' ? (
            <p className="text-sm text-gray-600">
              The farmer reported paying {formatInr(issue.totalAmount)} by {paymentMethodLabel(issue.payment.method)}
              {issue.payment.reference ? ` (${issue.payment.reference})` : ''} on {formatDate(issue.payment.paidAt)}.
            </p>
          ) : (
            <p className="text-sm text-gray-600">The farmer has not reported a payment yet.</p>
          )}

          {needsConfirming && (
            <div className="flex gap-2 pt-1">
              <button type="button" disabled={isBusy} onClick={() => confirm(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm disabled:opacity-50">
                <FiCheck /> Got the money
              </button>
              <button type="button" disabled={isBusy} onClick={() => confirm(false)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm border border-red-200 disabled:opacity-50">
                <FiX /> Not yet
              </button>
            </div>
          )}
        </section>
      )}

      {issue.status === 'pending' && (
        <button type="button" disabled={isBusy} onClick={cancel} className="w-full py-3 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm border border-red-200 mb-4 disabled:opacity-50">
          Cancel this request
        </button>
      )}

      {issue.history?.length > 0 && <RequestHistory history={issue.history} />}
    </FieldPanelLayout>
  );
};

export default SeedIssueDetail;
