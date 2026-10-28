import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiClock, FiCheckCircle, FiXCircle, FiDollarSign } from 'react-icons/fi';
import { Wheat, Sprout } from 'lucide-react';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import { formatInr } from '../../../shared/components/Produce/produceFormat';
import { useKisanAuthStore } from '../store/kisanStore';
import { getKisanDashboard } from '../services/kisanService';

const KisanDashboard = () => {
  const { account, fetchProfile } = useKisanAuthStore();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchProfile().catch(() => {});
    getKisanDashboard()
      .then((response) => setStats(response?.data || null))
      .catch(() => {});
  }, [fetchProfile]);

  const counts = stats?.statusCounts || {};
  const kendra = account?.sanchalak && typeof account.sanchalak === 'object' ? account.sanchalak : null;
  const tiles = [
    { label: 'Waiting for Kendra', value: stats ? counts.pending || 0 : undefined, icon: FiClock },
    { label: 'Purchased', value: stats ? counts.purchased || 0 : undefined, icon: FiCheckCircle },
    { label: 'Not Purchased', value: stats ? counts.not_purchased || 0 : undefined, icon: FiXCircle },
    { label: 'Payment Due', value: stats ? formatInr(stats.paymentDue.amount) : undefined, icon: FiDollarSign },
  ];

  return (
    <FieldPanelLayout role="kisan" title="Home">
      <section className="bg-white rounded-2xl p-5 shadow-sm mb-5">
        <p className="text-sm text-gray-500">Namaste,</p>
        <h1 className="text-2xl font-bold text-gray-900">{account?.name || 'Kisan'}</h1>
        {kendra && <p className="text-sm text-gray-600 mt-1">{kendra.kendraName} · Sanchalak {kendra.name}</p>}
        <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-green-700">Total sold to Kendra</p>
          <p className="text-2xl font-bold text-green-900">{stats ? formatInr(stats.sold.amount) : '—'}</p>
          <p className="text-xs text-green-700">{stats ? `${stats.sold.count} purchase${stats.sold.count === 1 ? '' : 's'}` : ' '}</p>
        </div>
      </section>

      <Link
        to="/kisan/sell"
        className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-base shadow-sm mb-5"
      >
        <Wheat size={20} /> Sell Produce / फसल बेचें
      </Link>

      {stats?.seed?.pendingSeedRequests > 0 && (
        <Link to="/kisan/seeds" className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 mb-5">
          <Sprout className="text-amber-600 shrink-0" size={20} />
          <p className="text-sm font-semibold text-amber-900">
            {stats.seed.pendingSeedRequests} seed delivery{stats.seed.pendingSeedRequests === 1 ? '' : ' deliveries'} to confirm
          </p>
        </Link>
      )}

      {stats?.seed?.seedPaymentDue?.amount > 0 && (
        <Link to="/kisan/seeds" className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-gray-200 px-4 py-3 mb-5 shadow-sm">
          <div>
            <p className="text-xs text-gray-500">Seed payment due to your surveyor</p>
            <p className="text-xl font-bold text-gray-900">{formatInr(stats.seed.seedPaymentDue.amount)}</p>
          </div>
          <Sprout className="text-green-600 shrink-0" size={22} />
        </Link>
      )}

      <section className="grid grid-cols-2 gap-4">
        {tiles.map(({ label, value, icon: Icon }) => (
          <Link key={label} to="/kisan/requests" className="bg-white rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
            <Icon className="text-green-600 mb-2" size={20} />
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
          </Link>
        ))}
      </section>
    </FieldPanelLayout>
  );
};

export default KisanDashboard;
