import TradeStatusBadge from './TradeStatusBadge';
import { formatDateTime, formatInr, formatQty } from './produceFormat';

const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0 text-sm">
    <span className="text-gray-500 shrink-0">{label}</span>
    <span className="text-gray-900 font-medium text-right break-words min-w-0">{children}</span>
  </div>
);

/**
 * Header card of a request: produce, offered terms and — when the Sanchalak bought a different
 * quantity or price — the purchased terms.
 */
const RequestSummary = ({ request, children }) => {
  const bought = request.purchased?.quantityKg ? request.purchased : null;
  const corrected = bought && (bought.quantityKg !== request.quantityKg || bought.pricePerUnit !== request.pricePerUnit);

  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{request.produceName}</h1>
          <p className="text-xs text-gray-400 font-mono">{request.requestCode}</p>
        </div>
        <TradeStatusBadge status={request.status} />
      </div>

      <Row label={corrected ? 'Offered' : 'Quantity'}>
        {formatQty(request.quantityKg, request.unit)} @ {formatInr(request.pricePerUnit)}/{request.unit}
      </Row>
      {!corrected && <Row label="Amount">{formatInr(bought ? bought.totalAmount : request.totalAmount)}</Row>}
      {corrected && (
        <>
          <Row label="Offer amount">{formatInr(request.totalAmount)}</Row>
          <Row label="Purchased">
            {formatQty(bought.quantityKg, request.unit)} @ {formatInr(bought.pricePerUnit)}/{request.unit}
          </Row>
          <Row label="Final amount"><span className="text-green-700 font-bold">{formatInr(bought.totalAmount)}</span></Row>
        </>
      )}
      {children}
      <Row label="Submitted">{formatDateTime(request.createdAt)}</Row>
      {request.decidedAt && <Row label="Decided">{formatDateTime(request.decidedAt)}</Row>}
    </section>
  );
};

export { Row as SummaryRow };
export default RequestSummary;
