import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiMail, FiPhone, FiMapPin, FiCalendar, FiHome, FiUser } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Badge from '../../../../shared/components/Badge';
import { formatPrice } from '../../../../shared/utils/helpers';
import { getSanchalakById, getSurveyorById } from '../../services/adminService';
import FieldAccounts from './FieldAccounts';
import Farmers from './Farmers';

const KIND_CONFIG = {
  sanchalak: {
    label: 'Sanchalak',
    codeField: 'sanchalakCode',
    fetchOne: getSanchalakById,
    listPath: '/admin/field-network/sanchalaks',
    childTitle: 'Surveyors',
    childSubtitle: 'Surveyors registered under this Kendra. Open one to see the farmers they brought in.',
  },
  surveyor: {
    label: 'Surveyor',
    codeField: 'surveyorCode',
    fetchOne: getSurveyorById,
    listPath: '/admin/field-network/surveyors',
    childTitle: 'Farmers',
    childSubtitle: 'Farmers registered by this surveyor. Open one to view or review the registration.',
  },
};

const STATUS_BADGE = { pending: 'pending', approved: 'approved', rejected: 'rejected', suspended: 'warning' };

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const formatAddress = (address = {}) =>
  [address.village, address.gramPanchayat, address.block, address.district, address.state, address.pincode]
    .filter(Boolean)
    .join(', ') || '—';

const StatTile = ({ label, value, hint }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
    <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

const InfoRow = ({ icon: Icon, children }) => (
  <p className="flex items-start gap-2 text-sm text-gray-700">
    <Icon className="mt-0.5 flex-shrink-0 text-gray-400" />
    <span className="break-words">{children}</span>
  </p>
);

// Admin profile for a Sanchalak (with their surveyors) or a Surveyor (with the farmers they registered).
const FieldAccountProfile = ({ kind }) => {
  const config = KIND_CONFIG[kind];
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [account, setAccount] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await config.fetchOne(id);
      setAccount(response?.data || null);
      setNotFound(!response?.data);
    } catch {
      // The API client already shows the error message.
      setNotFound(true);
    }
  }, [config, id]);

  useEffect(() => {
    setAccount(null);
    setNotFound(false);
    load();
  }, [load]);

  // Go back to wherever the admin came from (e.g. the Sanchalak profile); fall back to the list on a direct link.
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate(config.listPath));

  if (notFound) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center space-y-4">
        <p className="text-gray-600">{config.label} not found.</p>
        <Link to={config.listPath} className="inline-block text-primary-600 font-semibold hover:underline">
          Back to {config.label}s
        </Link>
      </div>
    );
  }

  if (!account) return <p className="text-center text-gray-500 py-12">Loading…</p>;

  const farmers = account.farmers || {};
  const commission = account.commission || {};
  const surveyors = account.surveyors || {};
  const sanchalak = kind === 'surveyor' ? account.sanchalak : null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
      >
        <FiArrowLeft /> Back
      </button>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{config.label}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 break-words">{account.name}</h1>
            <p className="font-mono font-semibold text-gray-600 mt-1">{account[config.codeField]}</p>
          </div>
          <div className="text-right">
            <Badge variant={STATUS_BADGE[account.status] || 'info'} className="inline-block">
              {account.status}
            </Badge>
            {account.rejectionReason && account.status !== 'approved' && (
              <p className="text-xs text-gray-500 mt-2 max-w-[240px]">{account.rejectionReason}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
          {kind === 'sanchalak' && <InfoRow icon={FiHome}>{account.kendraName}</InfoRow>}
          {sanchalak && (
            <InfoRow icon={FiHome}>
              <Link
                to={`${KIND_CONFIG.sanchalak.listPath}/${sanchalak._id}`}
                className="text-primary-600 font-semibold hover:underline"
              >
                {sanchalak.kendraName}
              </Link>{' '}
              <span className="text-gray-500">
                · {sanchalak.name} ({sanchalak.sanchalakCode})
                {sanchalak.status !== 'approved' ? ` · ${sanchalak.status}` : ''}
              </span>
            </InfoRow>
          )}
          <InfoRow icon={FiPhone}>
            {account.phone || 'No phone'}
            {account.phone && !account.isPhoneVerified && <span className="text-orange-600"> (not verified)</span>}
          </InfoRow>
          <InfoRow icon={FiMail}>{account.email}</InfoRow>
          <InfoRow icon={FiMapPin}>{formatAddress(account.address)}</InfoRow>
          <InfoRow icon={FiCalendar}>
            Joined {formatDate(account.createdAt)}
            {account.approvedAt && ` · Approved ${formatDate(account.approvedAt)}`}
          </InfoRow>
          {account.lastLoginAt && <InfoRow icon={FiUser}>Last login {formatDate(account.lastLoginAt)}</InfoRow>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kind === 'sanchalak' && (
          <StatTile
            label="Surveyors"
            value={surveyors.total || 0}
            hint={`${surveyors.approved || 0} approved · ${surveyors.pending || 0} pending`}
          />
        )}
        <StatTile label="Farmers" value={farmers.total || 0} hint={`${farmers.approved || 0} approved`} />
        <StatTile
          label="Awaiting Verification"
          value={farmers.submitted || 0}
          hint={`${farmers.rejected || 0} rejected`}
        />
        <StatTile
          label="Commission Earned"
          value={formatPrice(commission.earned?.amount)}
          hint={`${formatPrice(commission.ratePerFarmer)} per approved farmer`}
        />
        {kind === 'surveyor' && (
          <StatTile
            label="Commission Pending"
            value={formatPrice(commission.pending?.amount)}
            hint={`${commission.pending?.count || 0} farmers awaiting verification`}
          />
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800">{config.childTitle}</h2>
        <p className="text-sm text-gray-600">{config.childSubtitle}</p>
      </div>

      {kind === 'sanchalak' ? (
        <FieldAccounts key={account.id} kind="surveyor" sanchalakId={account.id} embedded onStatusChanged={load} />
      ) : (
        <Farmers key={account.id} surveyorId={account.id} embedded onReviewed={load} />
      )}
    </motion.div>
  );
};

export default FieldAccountProfile;
