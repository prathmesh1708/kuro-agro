import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import FieldProfile from '../../../shared/components/FieldAuth/FieldProfile';
import { formatInr, formatQty } from '../../../shared/components/Produce/produceFormat';
import { useSanchalakAuthStore } from '../store/sanchalakStore';
import { getKendraStock, getSanchalakCommission } from '../services/sanchalakService';

// Kendra warehouse at a glance: quantity held per produce and money bought / sold.
const WarehouseSummary = () => {
  const [stock, setStock] = useState(null);

  useEffect(() => {
    getKendraStock()
      .then((response) => setStock(response?.data || null))
      .catch(() => {});
  }, []);

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-gray-900">My Warehouse / गोदाम</h2>
        <Link to="/sanchalak/warehouse" className="text-sm font-semibold text-sky-700 inline-flex items-center gap-1">
          Details <FiChevronRight />
        </Link>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        {!stock ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : stock.items.length === 0 ? (
          <p className="text-sm text-gray-500">No stock yet.</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 text-sm">
              {stock.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2">
                  <span className="text-gray-700">{item.produceName}</span>
                  <span className="font-semibold text-gray-900">{formatQty(item.quantityKg, item.unit)}</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100 text-sm">
              <p className="text-gray-500">Bought <span className="block font-bold text-gray-900">{formatInr(stock.totals.purchasedValue)}</span></p>
              <p className="text-gray-500">Sold to admin <span className="block font-bold text-gray-900">{formatInr(stock.totals.soldValue)}</span></p>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

const SanchalakProfile = () => {
  const { account, fetchProfile, logout } = useSanchalakAuthStore();
  return (
    <FieldProfile role="sanchalak" account={account} fetchProfile={fetchProfile} fetchCommission={getSanchalakCommission} logout={logout}>
      <WarehouseSummary />
    </FieldProfile>
  );
};

export default SanchalakProfile;
