import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import RequestSummary, { SummaryRow } from '../../../shared/components/Produce/RequestSummary';
import RequestHistory from '../../../shared/components/Produce/RequestHistory';
import PaymentPanel from '../../../shared/components/Produce/PaymentPanel';
import { cancelSaleToAdmin, getSaleToAdmin } from '../services/sanchalakService';

const SanchalakSaleDetail = () => {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  const load = useCallback(
    () =>
      getSaleToAdmin(id)
        .then((response) => setRequest(response?.data || null))
        .catch(() => {})
        .finally(() => setIsLoading(false)),
    [id]
  );

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async () => {
    if (!window.confirm('Cancel this request? The stock goes back to your warehouse.')) return;
    setIsCancelling(true);
    try {
      await cancelSaleToAdmin(id);
      toast.success('Request cancelled.');
      load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <FieldPanelLayout role="sanchalak" title="Sale">
      <Link to="/sanchalak/sales" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
        <FiArrowLeft /> Sales to Admin
      </Link>
      {isLoading ? (
        <p className="text-center text-sm text-gray-500 py-10">Loading…</p>
      ) : !request ? (
        <p className="text-center text-sm text-gray-500 py-10">Request not found.</p>
      ) : (
        <div className="space-y-4">
          <RequestSummary request={request}>
            {request.sanchalakNote && <SummaryRow label="Your note">{request.sanchalakNote}</SummaryRow>}
            {request.adminRemark && <SummaryRow label="Admin remark">{request.adminRemark}</SummaryRow>}
          </RequestSummary>

          {request.status === 'received' && (
            <PaymentPanel
              payment={request.payment}
              amount={request.totalAmount}
              title="Payment from admin"
              paidText="Admin has paid you"
              unpaidText="Admin has not marked this as paid yet"
            />
          )}

          {request.status === 'pending' && (
            <button
              type="button"
              onClick={cancel}
              disabled={isCancelling}
              className="w-full py-3 rounded-xl border-2 border-red-200 text-red-600 font-semibold bg-white hover:bg-red-50 disabled:opacity-50"
            >
              {isCancelling ? 'Cancelling…' : 'Cancel Request'}
            </button>
          )}

          <RequestHistory history={request.history} />
        </div>
      )}
    </FieldPanelLayout>
  );
};

export default SanchalakSaleDetail;
