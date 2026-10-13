import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import TradeRequestList from '../../../shared/components/Produce/TradeRequestList';
import { getPurchaseRequests } from '../services/sanchalakService';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'not_purchased', label: 'Not Purchased' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];

const SanchalakPurchases = () => (
  <FieldPanelLayout role="sanchalak" title="Purchases">
    <h1 className="text-xl font-bold text-gray-900">Purchase Requests</h1>
    <p className="text-sm text-gray-500 mb-4">Produce offered by your farmers. Open one to mark it Purchased or Not Purchased.</p>
    <TradeRequestList
      fetchRequests={getPurchaseRequests}
      tabs={TABS}
      initialStatus="pending"
      detailPath={(request) => `/sanchalak/purchases/${request.id}`}
      subtitle={(request) => `${request.kisan?.name || 'Farmer'} · ${request.kisan?.phone || ''}${request.kisan?.address?.village ? ` · ${request.kisan.address.village}` : ''}`}
      paidStatus="purchased"
      searchPlaceholder="Search farmer, mobile, produce or code…"
      emptyText="No purchase requests here."
    />
  </FieldPanelLayout>
);

export default SanchalakPurchases;
