import { Link } from 'react-router-dom';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import TradeRequestList from '../../../shared/components/Produce/TradeRequestList';
import { getSalesToAdmin } from '../services/sanchalakService';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
  { value: 'not_received', label: 'Not Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SanchalakSales = () => (
  <FieldPanelLayout role="sanchalak" title="To Admin">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Sales to Admin</h1>
        <p className="text-sm text-gray-500">Produce you sent from your warehouse and what admin decided.</p>
      </div>
      <Link to="/sanchalak/warehouse/sell" className="shrink-0 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold">
        Sell
      </Link>
    </div>
    <TradeRequestList
      fetchRequests={getSalesToAdmin}
      tabs={TABS}
      detailPath={(request) => `/sanchalak/sales/${request.id}`}
      paidStatus="received"
      searchPlaceholder="Search produce or code…"
      emptyText="You have not sent anything to admin yet."
    />
  </FieldPanelLayout>
);

export default SanchalakSales;
