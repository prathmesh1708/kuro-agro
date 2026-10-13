import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import RequestSummary, { SummaryRow } from '../../../shared/components/Produce/RequestSummary';
import RequestHistory from '../../../shared/components/Produce/RequestHistory';
import PaymentPanel from '../../../shared/components/Produce/PaymentPanel';
import { formatInr, toUnits } from '../../../shared/components/Produce/produceFormat';
import { decidePurchaseRequest, getPurchaseRequest, updatePurchasePayment } from '../services/sanchalakService';

const inputClass = 'w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-sky-500 focus:outline-none bg-white text-base';

// Pending offer: Purchased (quantity / price can be corrected after weighing) or Not Purchased (with a reason).
const DecisionPanel = ({ request, onDecided }) => {
  const [mode, setMode] = useState(null); // 'purchased' | 'not_purchased'
  const [quantity, setQuantity] = useState(String(toUnits(request.quantityKg, request.unit)));
  const [price, setPrice] = useState(String(request.pricePerUnit));
  const [remark, setRemark] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const total = Number(quantity) > 0 && Number(price) >= 0 ? Number(quantity) * Number(price) : 0;

  const submit = async () => {
    if (mode === 'purchased' && !(Number(quantity) > 0)) return toast.error('Please enter the quantity.');
    if (mode === 'purchased' && (price === '' || Number(price) < 0)) return toast.error('Please enter the price.');
    if (mode === 'not_purchased' && !remark.trim()) return toast.error('Please give the farmer a reason.');

    setIsSaving(true);
    try {
      const payload =
        mode === 'purchased'
          ? { decision: 'purchased', quantity: Number(quantity), pricePerUnit: Number(price), remark: remark.trim() }
          : { decision: 'not_purchased', remark: remark.trim() };
      await decidePurchaseRequest(request.id, payload);
      toast.success(mode === 'purchased' ? 'Purchased — added to your warehouse.' : 'Marked as not purchased.');
      onDecided();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSaving(false);
    }
  };

  if (!mode) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setMode('not_purchased')} className="py-3.5 rounded-xl font-semibold text-red-600 bg-red-50 hover:bg-red-100">
          Not Purchased
        </button>
        <button type="button" onClick={() => setMode('purchased')} className="py-3.5 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700">
          Purchased
        </button>
      </div>
    );
  }

  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
      <h2 className="text-base font-bold text-gray-900">{mode === 'purchased' ? 'Confirm purchase' : 'Not purchased'}</h2>

      {mode === 'purchased' && (
        <>
          <p className="text-sm text-gray-600">Change the quantity or price if the weighed amount differs from the farmer&apos;s offer.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="buy-qty" className="block text-sm font-semibold text-gray-700 mb-1.5">Quantity ({request.unit})</label>
              <input id="buy-qty" type="number" inputMode="decimal" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="buy-price" className="block text-sm font-semibold text-gray-700 mb-1.5">Price (₹/{request.unit})</label>
              <input id="buy-price" type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <span className="text-sm font-semibold text-gray-600">Amount to pay farmer</span>
            <span className="text-xl font-bold text-gray-900">{formatInr(total)}</span>
          </div>
        </>
      )}

      <div>
        <label htmlFor="decision-remark" className="block text-sm font-semibold text-gray-700 mb-1.5">
          {mode === 'purchased' ? 'Remark (optional)' : 'Reason (shown to the farmer)'}
        </label>
        <textarea id="decision-remark" rows={2} maxLength={500} value={remark} onChange={(e) => setRemark(e.target.value)} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setMode(null)} disabled={isSaving} className="py-3 rounded-xl border-2 border-gray-200 font-semibold text-gray-700">
          Back
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isSaving}
          className={`py-3 rounded-xl font-semibold text-white disabled:opacity-50 ${mode === 'purchased' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
        >
          {isSaving ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </section>
  );
};

const SanchalakPurchaseDetail = () => {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(
    () =>
      getPurchaseRequest(id)
        .then((response) => setRequest(response?.data || null))
        .catch(() => {})
        .finally(() => setIsLoading(false)),
    [id]
  );

  useEffect(() => {
    load();
  }, [load]);

  const savePayment = async (payload) => {
    await updatePurchasePayment(id, payload);
    toast.success(payload.status === 'paid' ? 'Marked as paid.' : 'Marked as unpaid.');
    load();
  };

  return (
    <FieldPanelLayout role="sanchalak" title="Purchase">
      <Link to="/sanchalak/purchases" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
        <FiArrowLeft /> Purchases
      </Link>
      {isLoading ? (
        <p className="text-center text-sm text-gray-500 py-10">Loading…</p>
      ) : !request ? (
        <p className="text-center text-sm text-gray-500 py-10">Request not found.</p>
      ) : (
        <div className="space-y-4">
          <RequestSummary request={request}>
            <SummaryRow label="Farmer">
              {request.kisan?.name} ({request.kisan?.kisanCode})
            </SummaryRow>
            <SummaryRow label="Mobile">
              <a href={`tel:${request.kisan?.phone}`} className="text-sky-700">{request.kisan?.phone}</a>
            </SummaryRow>
            {request.kisan?.address?.village && <SummaryRow label="Village">{request.kisan.address.village}</SummaryRow>}
            {request.surveyor && <SummaryRow label="Surveyor">{request.surveyor.name}</SummaryRow>}
            {request.kisanNote && <SummaryRow label="Farmer note">{request.kisanNote}</SummaryRow>}
            {request.sanchalakRemark && <SummaryRow label="Your remark">{request.sanchalakRemark}</SummaryRow>}
          </RequestSummary>

          {request.status === 'pending' && <DecisionPanel request={request} onDecided={load} />}

          {request.status === 'purchased' && (
            <PaymentPanel
              payment={request.payment}
              amount={request.purchased.totalAmount}
              title="Payment to farmer"
              paidText="You have paid the farmer"
              unpaidText="Not paid to the farmer yet"
              onSave={savePayment}
              buttonClass="bg-sky-600 hover:bg-sky-700"
            />
          )}

          <RequestHistory history={request.history} />
        </div>
      )}
    </FieldPanelLayout>
  );
};

export default SanchalakPurchaseDetail;
