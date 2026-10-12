import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiClock, FiCheckCircle, FiUserCheck, FiShoppingBag } from 'react-icons/fi';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import { useSanchalakAuthStore } from '../store/sanchalakStore';
import { getSanchalakDashboard } from '../services/sanchalakService';

const SanchalakDashboard = () => {
  const { account, fetchProfile } = useSanchalakAuthStore();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchProfile().catch(() => {});
    getSanchalakDashboard()
      .then((response) => setStats(response?.data || null))
      .catch(() => {});
  }, [fetchProfile]);

  const tiles = [
    { label: 'Farmers Registered', value: stats?.farmers?.total, icon: FiUsers, to: '/sanchalak/farmers' },
    { label: 'Pending Verification', value: stats?.farmers?.submitted, icon: FiClock, to: '/sanchalak/farmers' },
    { label: 'Approved Farmers', value: stats?.farmers?.approved, icon: FiCheckCircle, to: '/sanchalak/farmers' },
    { label: 'Active Surveyors', value: stats?.surveyors?.approved ?? (stats ? 0 : undefined), icon: FiUserCheck, to: '/sanchalak/surveyors' },
  ];

  return (
    <FieldPanelLayout role="sanchalak" title="Home">
      <section className="bg-white rounded-2xl p-5 shadow-sm mb-5">
        <p className="text-sm text-gray-500">Namaste,</p>
        <h1 className="text-2xl font-bold text-gray-900">{account?.name || 'Sanchalak'}</h1>
        <p className="text-sm text-gray-600 mt-1">{account?.kendraName}</p>
        <div className="mt-4 flex w-full sm:w-auto sm:inline-flex items-center justify-between sm:justify-start gap-2 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2">
          <span className="text-xs font-semibold uppercase text-sky-700">Sanchalak Code</span>
          <span className="font-bold tracking-wider text-sky-900">{account?.sanchalakCode}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">Share this code with your surveyors so they can register under your Kendra.</p>
      </section>

      <section className="grid grid-cols-2 gap-4">
        {tiles.map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
            <Icon className="text-sky-600 mb-2" size={20} />
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
          </Link>
        ))}
      </section>

      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        <FiShoppingBag className="shrink-0" size={20} />
        Crop purchase entries and totals arrive in the next update.
      </div>
    </FieldPanelLayout>
  );
};

export default SanchalakDashboard;
