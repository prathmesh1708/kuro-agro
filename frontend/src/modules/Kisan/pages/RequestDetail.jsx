import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import RequestSummary, { SummaryRow } from '../../../shared/components/Produce/RequestSummary';
import RequestHistory from '../../../shared/components/Produce/RequestHistory';
import PaymentPanel from '../../../shared/components/Produce/PaymentPanel';
import { cancelSaleRequest, getSaleRequest } from '../services/kisanService';

const KisanRequestDetail = () => {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  const load = useCallback(
    () =>
      getSaleRequest(id)
        .then((response) => setRequest(response?.data || null))
        .catch(() => {})
        .finally(() => setIsLoading(false)),
    [id]
  );

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async () => {
    if (!window.confirm('Cancel this offer?')) return;
    setIsCancelling(true);
    try {
      await cancelSaleRequest(id);
      toast.success('Offer cancelled.');
      load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <FieldPanelLayout role="kisan" title="Offer">
      <Link to="/kisan/requests" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
        <FiArrowLeft /> My Offers
      </Link>
      {isLoading ? (
        <p className="text-center text-sm text-gray-500 py-10">Loading…</p>
      ) : !request ? (
        <p className="text-center text-sm text-gray-500 py-10">Offer not found.</p>
      ) : (
        <div className="space-y-4">
          <RequestSummary request={request}>
            <SummaryRow label="Kendra">{request.sanchalak?.kendraName}</SummaryRow>
            {request.kisanNote && <SummaryRow label="Your note">{request.kisanNote}</SummaryRow>}
            {request.sanchalakRemark && <SummaryRow label="Sanchalak remark">{request.sanchalakRemark}</SummaryRow>}
          </RequestSummary>

          {request.status === 'purchased' && (
            <PaymentPanel
              payment={request.payment}
              amount={request.purchased.totalAmount}
              title="Payment from Kendra"
              paidText="The Kendra has paid you"
              unpaidText="The Kendra has not marked this as paid yet"
            />
          )}

          {request.status === 'pending' && (
            <button
              type="button"
              onClick={cancel}
              disabled={isCancelling}
              className="w-full py-3 rounded-xl border-2 border-red-200 text-red-600 font-semibold bg-white hover:bg-red-50 disabled:opacity-50"
            >
              {isCancelling ? 'Cancelling…' : 'Cancel Offer'}
            </button>
          )}

          <RequestHistory history={request.history} />
        </div>
      )}
    </FieldPanelLayout>
  );
};

export default KisanRequestDetail;
