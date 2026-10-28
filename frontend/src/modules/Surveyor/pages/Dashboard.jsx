import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiClock, FiCheckCircle, FiXCircle, FiUsers } from 'react-icons/fi';
import { Sprout, Wallet } from 'lucide-react';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import { useSurveyorAuthStore } from '../store/surveyorStore';
import { formatInr } from '../../../shared/components/Seed/seedFormat';
import { getSurveyorDashboard } from '../services/surveyorService';

const TILES = [
  { key: 'total', label: 'Farmers Registered', icon: FiUsers, status: 'all' },
  { key: 'submitted', label: 'Pending Verification', icon: FiClock, status: 'submitted' },
  { key: 'approved', label: 'Approved', icon: FiCheckCircle, status: 'approved' },
  { key: 'rejected', label: 'Rejected', icon: FiXCircle, status: 'rejected' },
];

const SurveyorDashboard = () => {
  const { account, fetchProfile } = useSurveyorAuthStore();
  const [counts, setCounts] = useState(null);
  const [seed, setSeed] = useState(null);
  const sanchalak = account?.sanchalak && typeof account.sanchalak === 'object' ? account.sanchalak : null;

  useEffect(() => {
    fetchProfile().catch(() => {});
    getSurveyorDashboard()
      .then((response) => {
        setCounts(response?.data?.farmers || null);
        setSeed(response?.data?.seed || null);
      })
      .catch(() => {});
  }, [fetchProfile]);

  return (
    <FieldPanelLayout role="surveyor" title="Home">
      <section className="bg-white rounded-2xl p-5 shadow-sm mb-5">
        <p className="text-sm text-gray-500">Namaste,</p>
        <h1 className="text-2xl font-bold text-gray-900">{account?.name || 'Surveyor'}</h1>
        <div className="mt-3 flex w-full sm:w-auto sm:inline-flex items-center justify-between sm:justify-start gap-2 rounded-xl bg-gold-50 border border-gold-200 px-3 py-2">
          <span className="text-xs font-semibold uppercase text-gold-700">Surveyor ID</span>
          <span className="font-bold tracking-wider text-gold-900">{account?.surveyorCode}</span>
        </div>
        {sanchalak && (
          <p className="text-sm text-gray-600 mt-3">
            Kendra: <span className="font-semibold text-gray-900">{sanchalak.kendraName}</span> · Sanchalak {sanchalak.name}
          </p>
        )}
      </section>

      <Link
        to="/surveyor/farmers/new"
        className="flex items-center justify-center gap-2 w-full bg-gold-500 hover:bg-gold-600 text-white py-4 rounded-2xl font-bold text-base shadow-sm mb-5"
      >
        <FiPlus size={20} /> Register New Farmer / नया किसान जोड़ें
      </Link>

      {seed && (seed.pendingDispatches > 0 || seed.awaitingConfirmation > 0) && (
        <section className="space-y-2 mb-5">
          {seed.pendingDispatches > 0 && (
            <Link to="/surveyor/seeds" className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
              <Sprout className="text-amber-600 shrink-0" size={20} />
              <p className="text-sm font-semibold text-amber-900">
                {seed.pendingDispatches} seed dispatch{seed.pendingDispatches === 1 ? '' : 'es'} waiting for you to confirm
              </p>
            </Link>
          )}
          {seed.awaitingConfirmation > 0 && (
            <Link to="/surveyor/seed-issues" className="flex items-center gap-3 rounded-2xl bg-sky-50 border border-sky-200 px-4 py-3">
              <Wallet className="text-sky-600 shrink-0" size={20} />
              <p className="text-sm font-semibold text-sky-900">
                {seed.awaitingConfirmation} farmer payment{seed.awaitingConfirmation === 1 ? '' : 's'} to confirm
              </p>
            </Link>
          )}
        </section>
      )}

      <section className="grid grid-cols-2 gap-4 mb-5">
        <Link to="/surveyor/seeds" className="bg-white rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
          <Sprout className="text-gold-600 mb-2" size={20} />
          <p className="text-xs text-gray-500">Seed in stock</p>
          <p className="text-2xl font-bold text-gray-900">{seed ? seed.stock.length : '—'}</p>
          <p className="text-[11px] text-gray-500">{seed ? `${seed.pendingIssues} with farmers` : ' '}</p>
        </Link>
        <Link to="/surveyor/seed-account" className="bg-white rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
          <Wallet className="text-gold-600 mb-2" size={20} />
          <p className="text-xs text-gray-500">To transfer to admin</p>
          <p className="text-2xl font-bold text-gray-900">{seed ? formatInr(seed.account.payableToAdmin) : '—'}</p>
          <p className="text-[11px] text-green-700">{seed ? `${formatInr(seed.account.commissionEarned)} commission earned` : ' '}</p>
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-4">
        {TILES.map(({ key, label, icon: Icon }) => (
          <Link key={key} to="/surveyor/farmers" className="bg-white rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
            <Icon className="text-gold-600 mb-2" size={20} />
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{counts ? counts[key] : '—'}</p>
          </Link>
        ))}
      </section>
    </FieldPanelLayout>
  );
};

export default SurveyorDashboard;
