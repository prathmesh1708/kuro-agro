import { Link } from 'react-router-dom';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import TradeRequestList from '../../../shared/components/Produce/TradeRequestList';
import { getSaleRequests } from '../services/kisanService';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'not_purchased', label: 'Not Purchased' },
  { value: 'cancelled', label: 'Cancelled' },
];

const KisanRequests = () => (
  <FieldPanelLayout role="kisan" title="My Offers">
    <h1 className="text-xl font-bold text-gray-900">My Offers</h1>
    <p className="text-sm text-gray-500 mb-4">Produce you offered to your Kendra and what the Sanchalak decided.</p>
    <TradeRequestList
      fetchRequests={getSaleRequests}
      tabs={TABS}
      detailPath={(request) => `/kisan/requests/${request.id}`}
      paidStatus="purchased"
      searchPlaceholder="Search produce or offer code…"
      emptyText="You have not offered any produce yet."
      emptyAction={
        <Link to="/kisan/sell" className="inline-block px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold">
          Sell Produce
        </Link>
      }
    />
  </FieldPanelLayout>
);

export default KisanRequests;
