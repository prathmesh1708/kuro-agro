import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLogOut, FiPhone, FiMail, FiMapPin, FiCopy, FiTrendingUp, FiClock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import FieldPanelLayout from './FieldPanelLayout';
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

/**
 * Profile for Surveyor / Sanchalak: identity, login ID, commission earned, and logout.
 * @param {Function} fetchCommission  () => api promise resolving to { data: { ratePerFarmer, earned, pending, history } }
 */
const FieldProfile = ({ role, account, fetchProfile, fetchCommission, logout }) => {
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
          <InfoRow icon={FiMail}>{account?.email}</InfoRow>
          {(address.village || address.district) && (
            <InfoRow icon={FiMapPin}>
              {[address.village, address.block, address.district, address.state, address.pincode].filter(Boolean).join(', ')}
            </InfoRow>
          )}
          {role === 'sanchalak' && account?.kendraName && <InfoRow icon={FiTrendingUp}>{account.kendraName}</InfoRow>}
          {kendra && <InfoRow icon={FiTrendingUp}>{kendra.kendraName} · Sanchalak {kendra.name}</InfoRow>}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="text-base font-bold text-gray-900 mb-3">My Commission / मेरा कमीशन</h2>

        {loadFailed ? (
          <p className="text-sm text-gray-500 bg-white rounded-2xl p-4 shadow-sm">Could not load commission. Pull down to retry.</p>
        ) : (
          <>
            <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-white/70">Total Earned</p>
              <p className="text-3xl font-bold mt-1">{commission ? formatInr(commission.earned.amount) : '—'}</p>
              <p className="text-xs text-white/70 mt-1">
                {commission ? `from ${commission.earned.count} approved farmer${commission.earned.count === 1 ? '' : 's'}` : ' '}
              </p>
            </div>

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

            <h3 className="text-sm font-bold text-gray-800 mt-5 mb-2">Commission History</h3>
            {commission && commission.history.length === 0 ? (
              <p className="text-sm text-gray-500 bg-white rounded-2xl p-4 shadow-sm">
                No commission yet. You earn it when admin approves a farmer.
              </p>
            ) : (
              <ul className="space-y-2">
                {(commission?.history || []).map((item) => (
                  <li key={item.id} className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{item.farmerName}</p>
                      <p className="text-xs text-gray-500 truncate">
                        <span className="font-mono">{item.registrationCode}</span> · {formatDate(item.earnedAt)}
                      </p>
                    </div>
                    <p className="font-bold text-green-600 shrink-0">+{formatInr(item.amount)}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-gray-400 mt-3">Commission is credited per verified farmer. Payout status will appear here once payments are enabled.</p>
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
