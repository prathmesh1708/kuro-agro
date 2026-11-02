import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLogOut, FiPhone, FiMail, FiMapPin, FiCopy, FiTrendingUp, FiClock, FiUsers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import FieldPanelLayout from './FieldPanelLayout';
import CommissionRateCard from '../Seed/CommissionRateCard';
import { formatSeedQty } from '../Seed/seedFormat';
import { ROLE_CONFIG } from './roleConfig';

const formatInr = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const InfoRow = ({ icon: Icon, children }) => (
  <p className="flex items-start gap-3 text-sm text-gray-700">
    <Icon className="mt-0.5 shrink-0 text-gray-400" />
    <span className="min-w-0 break-words">{children}</span>
  </p>
);

const BreakdownRow = ({ icon: Icon, label, hint, value }) => (
  <div className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
    <div className="min-w-0">
      <p className="text-sm text-gray-700 flex items-center gap-1.5">
        <Icon className="shrink-0 text-gray-400" /> {label}
      </p>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
    <span className="text-base font-bold text-gray-900 whitespace-nowrap">{value}</span>
  </div>
);

const SOURCE_META = {
  farmer: { label: 'Farmer', className: 'bg-primary-50 text-primary-700' },
  seed: { label: 'Seed', className: 'bg-sky-50 text-sky-700' },
};

/** Farmer-registration and seed-distribution commission as one list, newest first. */
const mergeHistory = (commission) => {
  const farmers = (commission?.history || []).map((item) => ({
    key: `farmer-${item.id}`,
    source: 'farmer',
    title: item.farmerName,
    code: item.registrationCode,
    detail: item.location,
    amount: item.amount,
    earnedAt: item.earnedAt,
  }));
  const seed = (commission?.seed?.history || []).map((item) => ({
    key: `seed-${item.id}`,
    source: 'seed',
    title: item.seedName,
    code: item.issueCode,
    detail: [formatSeedQty(item.quantity, item.unit), item.farmerName].filter(Boolean).join(' → '),
    amount: item.amount,
    earnedAt: item.earnedAt,
  }));
  return [...farmers, ...seed].sort((a, b) => new Date(b.earnedAt || 0) - new Date(a.earnedAt || 0));
};

/**
 * Profile for Surveyor / Sanchalak: identity, login ID, commission earned, and logout.
 * @param {Function} fetchCommission  () => api promise resolving to { data: { ratePerFarmer, earned, pending, history } }
 * @param {ReactNode} children        extra sections shown after the identity card (e.g. warehouse summary)
 */
const FieldProfile = ({ role, account, fetchProfile, fetchCommission, logout, children }) => {
  const navigate = useNavigate();
  const { codeField, theme, label } = ROLE_CONFIG[role];
  const [commission, setCommission] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    fetchProfile().catch(() => {});
    fetchCommission()
      .then((response) => setCommission(response?.data || null))
      .catch(() => setLoadFailed(true));
  }, [fetchProfile, fetchCommission]);

  // Both roles earn from two sources: farmers admin approves, and seed distributed in the field.
  // The seed half only has figures to show once rates are set on the catalog.
  const hasRateCard = (commission?.rateCard?.length || 0) > 0;
  const seedHint = role === 'sanchalak' ? 'Per unit your surveyors distribute' : 'Per unit you give to farmers';
  const seedEmptyHint = role === 'sanchalak' ? 'your surveyors give out seed' : 'you give seed to a farmer';
  const totals = commission?.total || { earned: commission?.earned, pending: commission?.pending };
  const entries = useMemo(() => mergeHistory(commission), [commission]);
  const farmerCount = commission?.earned?.count || 0;
  const seedCount = commission?.seed?.earned?.count || 0;

  const code = account?.[codeField];
  const kendra = role === 'surveyor' && account?.sanchalak && typeof account.sanchalak === 'object' ? account.sanchalak : null;
  const address = account?.address || {};

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('ID copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const handleLogout = () => {
    logout();
    navigate(`/login?role=${role}`, { replace: true });
  };

  return (
    <FieldPanelLayout role={role} title="Profile">
      <section className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={`h-14 w-14 shrink-0 rounded-full border-2 flex items-center justify-center text-xl font-bold ${theme.badge}`}>
            {(account?.name || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{account?.name}</h2>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={copyCode}
          className={`mt-4 w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${theme.badge}`}
          aria-label="Copy login ID"
        >
          <span className="text-xs font-semibold uppercase">{role === 'surveyor' ? 'Surveyor ID' : 'Sanchalak Code'}</span>
          <span className="flex items-center gap-2 font-bold tracking-wider">
            {code} <FiCopy size={14} />
          </span>
        </button>

        <div className="mt-4 space-y-2.5">
          <InfoRow icon={FiPhone}>{account?.phone}</InfoRow>
          {account?.email && <InfoRow icon={FiMail}>{account.email}</InfoRow>}
          {(address.village || address.district) && (
            <InfoRow icon={FiMapPin}>
              {[address.village, address.block, address.district, address.state, address.pincode].filter(Boolean).join(', ')}
            </InfoRow>
          )}
          {role === 'sanchalak' && account?.kendraName && <InfoRow icon={FiTrendingUp}>{account.kendraName}</InfoRow>}
          {kendra && <InfoRow icon={FiTrendingUp}>{kendra.kendraName} · Sanchalak {kendra.name}</InfoRow>}
        </div>
      </section>

      {children}

      <section className="mt-5">
        <h2 className="text-base font-bold text-gray-900 mb-3">My Commission / मेरा कमीशन</h2>

        {loadFailed ? (
          <p className="text-sm text-gray-500 bg-white rounded-2xl p-4 shadow-sm">Could not load commission. Pull down to retry.</p>
        ) : (
          <>
            <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-white/70">Total Earned</p>
              <p className="text-3xl font-bold mt-1">{commission ? formatInr(totals.earned?.amount) : '—'}</p>
              <p className="text-xs text-white/70 mt-1">
                {!commission
                  ? ' '
                  : hasRateCard
                    ? `from ${farmerCount} farmer${farmerCount === 1 ? '' : 's'} and ${seedCount} seed hand-out${seedCount === 1 ? '' : 's'}`
                    : `from ${farmerCount} approved farmer${farmerCount === 1 ? '' : 's'}`}
              </p>
            </div>

            {hasRateCard ? (
              <div className="bg-white rounded-2xl p-4 shadow-sm mt-3 divide-y divide-gray-100">
                <BreakdownRow
                  icon={FiUsers}
                  label="From farmers"
                  hint={`${formatInr(commission.ratePerFarmer)} per farmer admin approves`}
                  value={formatInr(commission.earned.amount)}
                />
                <BreakdownRow
                  icon={FiTrendingUp}
                  label="From seed given out"
                  hint={seedHint}
                  value={formatInr(commission.seed.earned.amount)}
                />
                <BreakdownRow
                  icon={FiClock}
                  label="Pending"
                  hint="Awaiting farmer or admin confirmation"
                  value={formatInr(totals.pending?.amount)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs text-gray-500 flex items-center gap-1.5"><FiClock /> Pending</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{commission ? formatInr(commission.pending.amount) : '—'}</p>
                  <p className="text-[11px] text-gray-400">{commission ? `${commission.pending.count} awaiting verification` : ' '}</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs text-gray-500 flex items-center gap-1.5"><FiTrendingUp /> Per Farmer</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{commission ? formatInr(commission.ratePerFarmer) : '—'}</p>
                  <p className="text-[11px] text-gray-400">on admin approval</p>
                </div>
              </div>
            )}

            <CommissionRateCard rows={commission?.rateCard || []} />

            <h3 className="text-sm font-bold text-gray-800 mt-5 mb-2">Commission History</h3>
            {commission && entries.length === 0 ? (
              <p className="text-sm text-gray-500 bg-white rounded-2xl p-4 shadow-sm">
                {hasRateCard
                  ? `No commission yet. You earn it when admin approves a farmer, and when ${seedEmptyHint}.`
                  : 'No commission yet. You earn it when admin approves a farmer.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {entries.map((item) => (
                  <li key={item.key} className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 truncate">
                        <span className="font-mono">{item.code}</span> · {formatDate(item.earnedAt)}
                        {item.detail && ` · ${item.detail}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-green-600">+{formatInr(item.amount)}</p>
                      {hasRateCard && (
                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${SOURCE_META[item.source].className}`}>
                          {SOURCE_META[item.source].label}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!hasRateCard ? (
              <p className="text-[11px] text-gray-400 mt-3">
                Commission is credited per verified farmer. Payout status will appear here once payments are enabled.
              </p>
            ) : role === 'sanchalak' ? (
              <p className="text-[11px] text-gray-400 mt-3">
                Commission is credited on verified farmers and verified seed distribution. Payout status will appear here once
                payments are enabled.
              </p>
            ) : null}
          </>
        )}
      </section>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-red-200 text-red-600 font-semibold bg-white hover:bg-red-50"
      >
        <FiLogOut /> Logout
      </button>
    </FieldPanelLayout>
  );
};

export default FieldProfile;
