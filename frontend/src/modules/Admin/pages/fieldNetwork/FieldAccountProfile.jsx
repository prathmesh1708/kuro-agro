import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiMail, FiPhone, FiMapPin, FiCalendar, FiHome, FiUser, FiCheck, FiX, FiSlash } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Badge from '../../../../shared/components/Badge';
import { formatPrice } from '../../../../shared/utils/helpers';
import { formatInr, formatQty } from '../../../../shared/components/Produce/produceFormat';
import {
  getSanchalakById,
  getSurveyorById,
  updateSanchalakStatus,
  updateSurveyorStatus,
} from '../../services/adminService';
import FieldAccounts from './FieldAccounts';
import SurveyorSeedSection from './SurveyorSeedSection';
import SanchalakSeedSection from './SanchalakSeedSection';
import Farmers from './Farmers';

const KIND_CONFIG = {
  sanchalak: {
    label: 'Sanchalak',
    codeField: 'sanchalakCode',
    fetchOne: getSanchalakById,
    updateStatus: updateSanchalakStatus,
    listPath: '/admin/field-network/sanchalaks',
    childTitle: 'Surveyors',
    childSubtitle: 'Surveyors registered under this Kendra. Open one to see the farmers they brought in.',
  },
  surveyor: {
    label: 'Surveyor',
    codeField: 'surveyorCode',
    fetchOne: getSurveyorById,
    updateStatus: updateSurveyorStatus,
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
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const submitAction = async () => {
    if (action !== 'approved' && !reason.trim()) {
      toast.error('Please enter a reason.');
      return;
    }
    setIsSubmitting(true);
    try {
      await config.updateStatus(id, action, reason.trim());
      toast.success(`${config.label} ${action}.`);
      setAction(null);
      load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className="flex flex-col sm:items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_BADGE[account.status] || 'info'} className="inline-block">
                {account.status}
              </Badge>
              {account.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => { setAction('approved'); setReason(''); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 transition-colors inline-flex items-center gap-1 shadow-sm"
                  >
                    <FiCheck size={14} /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAction('rejected'); setReason(''); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 transition-colors inline-flex items-center gap-1 shadow-sm"
                  >
                    <FiX size={14} /> Reject
                  </button>
                </>
              )}
              {account.status === 'approved' && (
                <button
                  type="button"
                  onClick={() => { setAction('suspended'); setReason(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors inline-flex items-center gap-1 shadow-sm"
                >
                  <FiSlash size={14} /> Suspend
                </button>
              )}
              {account.status === 'suspended' && (
                <button
                  type="button"
                  onClick={() => { setAction('approved'); setReason(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 transition-colors inline-flex items-center gap-1 shadow-sm"
                >
                  <FiCheck size={14} /> Reactivate
                </button>
              )}
              {account.status === 'rejected' && (
                <button
                  type="button"
                  onClick={() => { setAction('approved'); setReason(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 transition-colors inline-flex items-center gap-1 shadow-sm"
                >
                  <FiCheck size={14} /> Approve
                </button>
              )}
            </div>
            {account.rejectionReason && account.status !== 'approved' && (
              <p className="text-xs text-gray-500 max-w-[280px]">{account.rejectionReason}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
          {kind === 'sanchalak' && <InfoRow icon={FiHome}>{account.kendraName}</InfoRow>}
          {kind === 'sanchalak' && account.crops?.length > 0 && (
            <InfoRow icon={FiHome}>
              <span className="font-semibold">Crops grown by farmers:</span>{' '}
              {account.crops.map((c) => `${c.name} (${c.farmers})`).join(', ')}
            </InfoRow>
          )}
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
          {account.email && <InfoRow icon={FiMail}>{account.email}</InfoRow>}
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
          value={formatPrice(commission.total?.earned?.amount ?? commission.earned?.amount)}
          hint={
            commission.seed
              ? `${formatPrice(commission.earned?.amount)} farmers · ${formatPrice(commission.seed.earned?.amount)} seed`
              : `${formatPrice(commission.ratePerFarmer)} per approved farmer`
          }
        />
        <StatTile
          label="Commission Pending"
          value={formatPrice(commission.total?.pending?.amount ?? commission.pending?.amount)}
          hint={
            kind === 'surveyor'
              ? `${commission.pending?.count || 0} farmers awaiting verification`
              : 'Awaiting farmer or admin confirmation'
          }
        />
      </div>

      {kind === 'sanchalak' && account.stock && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Kendra Warehouse</h2>
              <p className="text-sm text-gray-600">
                Bought from farmers {formatInr(account.stock.totals.purchasedValue)} · Sold to admin {formatInr(account.stock.totals.soldValue)}
              </p>
            </div>
            <Link
              to={`/admin/field-network/procurement-requests?sanchalak=${account.id}`}
              className="text-sm font-semibold text-primary-600 hover:underline"
            >
              Procurement requests →
            </Link>
          </div>
          {account.stock.items.length === 0 ? (
            <p className="text-sm text-gray-500">No stock yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-4">Produce</th>
                    <th className="py-2 pr-4">In Stock</th>
                    <th className="py-2 pr-4">Sent, awaiting admin</th>
                    <th className="py-2 pr-4">Bought</th>
                    <th className="py-2 pr-4">Sold to admin</th>
                    <th className="py-2">Last bought</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {account.stock.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 pr-4 font-semibold text-gray-800">{item.produceName}</td>
                      <td className="py-2 pr-4 font-bold text-gray-900">{formatQty(item.quantityKg, item.unit)}</td>
                      <td className="py-2 pr-4">{formatQty(item.reservedKg, item.unit)}</td>
                      <td className="py-2 pr-4">{formatQty(item.purchasedKg, item.unit)} <span className="text-xs text-gray-500">{formatInr(item.purchasedValue)}</span></td>
                      <td className="py-2 pr-4">{formatQty(item.soldKg, item.unit)} <span className="text-xs text-gray-500">{formatInr(item.soldValue)}</span></td>
                      <td className="py-2">{formatDate(item.lastPurchasedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {kind === 'surveyor' && (
        <SurveyorSeedSection surveyorId={account.id} canDispatch={account.status === 'approved' && account.isActive} />
      )}

      {kind === 'sanchalak' && <SanchalakSeedSection sanchalakId={account.id} />}

      <div>
        <h2 className="text-xl font-bold text-gray-800">{config.childTitle}</h2>
        <p className="text-sm text-gray-600">{config.childSubtitle}</p>
      </div>

      {kind === 'sanchalak' ? (
        <FieldAccounts key={account.id} kind="surveyor" sanchalakId={account.id} embedded onStatusChanged={load} />
      ) : (
        <Farmers key={account.id} surveyorId={account.id} embedded onReviewed={load} />
      )}

      <AnimatePresence>
        {action && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl"
            >
              <h3 className="text-lg font-bold text-gray-800 mb-1 capitalize">
                {action === 'approved' && account.status === 'suspended' ? 'Reactivate' : action} {config.label}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {account.name} · <span className="font-mono">{account[config.codeField]}</span>
              </p>
              {action === 'approved' && (
                <p className="text-sm text-gray-700 mb-4">They will be able to log in and will be notified.</p>
              )}
              {action === 'approved' && !account.isPhoneVerified && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  ⚠️ Note: The applicant has not completed phone OTP verification. Approving will automatically verify their phone number and activate this account.
                </div>
              )}
              {action !== 'approved' && (
                <div className="mb-4">
                  <label htmlFor="modal-reason" className="block text-sm font-semibold text-gray-700 mb-2">
                    Reason (shown to the {config.label.toLowerCase()})
                  </label>
                  <textarea
                    id="modal-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Enter reason..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAction(null)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitAction}
                  disabled={isSubmitting}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-50 ${action === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {isSubmitting ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default FieldAccountProfile;
