import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSearch, FiX, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import ExportButtons from '../../components/ExportButtons';
import Badge from '../../../../shared/components/Badge';
import {
  getAllSanchalaks,
  updateSanchalakStatus,
  getAllSurveyors,
  updateSurveyorStatus,
} from '../../services/adminService';

const KIND_CONFIG = {
  sanchalak: {
    title: 'Sanchalaks',
    subtitle: 'Kisan Vyapar Kendra operators — review and approve registrations',
    label: 'Sanchalak',
    codeField: 'sanchalakCode',
    fetchList: getAllSanchalaks,
    updateStatus: updateSanchalakStatus,
    listKey: 'sanchalaks',
    profilePath: '/admin/field-network/sanchalaks',
  },
  surveyor: {
    title: 'Surveyors',
    subtitle: 'Field surveyors registered under a Sanchalak — review and approve registrations',
    label: 'Surveyor',
    codeField: 'surveyorCode',
    fetchList: getAllSurveyors,
    updateStatus: updateSurveyorStatus,
    listKey: 'surveyors',
    profilePath: '/admin/field-network/surveyors',
  },
};

const STATUS_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const STATUS_BADGE = { pending: 'pending', approved: 'approved', rejected: 'rejected', suspended: 'warning' };

const ACTION_LABELS = { approved: 'Approve', rejected: 'Reject', suspended: 'Suspend' };

const ITEMS_PER_PAGE = 10;

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// `sanchalakId` scopes the surveyor list to one Sanchalak; `embedded` drops the page header (used on the profile page).
const FieldAccounts = ({ kind, sanchalakId, embedded = false, onStatusChanged }) => {
  const config = KIND_CONFIG[kind];
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [statusFilter, setStatusFilter] = useState(embedded ? 'all' : 'pending');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState(null); // { row, status }
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await config.fetchList({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        ...(sanchalakId && { sanchalak: sanchalakId }),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const data = response?.data || {};
      setRows((data[config.listKey] || []).map((row) => ({ ...row, id: row._id || row.id })));
      setStatusCounts(data.statusCounts || {});
      setPagination(data.pagination || { total: 0, pages: 1 });
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsLoading(false);
    }
  }, [config, sanchalakId, currentPage, search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openAction = (row, status) => {
    setAction({ row, status });
    setReason('');
  };

  const needsReason = action && action.status !== 'approved';

  const submitAction = async () => {
    if (needsReason && !reason.trim()) {
      toast.error('Please enter a reason.');
      return;
    }
    setIsSubmitting(true);
    try {
      await config.updateStatus(action.row.id, action.status, reason.trim());
      toast.success(`${config.label} ${action.status}.`);
      setAction(null);
      load();
      onStatusChanged?.();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionButton = (row, status, tone) => (
    <button
      key={status}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openAction(row, status);
      }}
      disabled={!row.isPhoneVerified}
      title={row.isPhoneVerified ? undefined : 'Phone number not verified yet'}
      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${tone}`}
    >
      {status === 'approved' && row.status === 'suspended' ? 'Reactivate' : ACTION_LABELS[status]}
    </button>
  );

  const GREEN = 'bg-green-50 text-green-600 hover:bg-green-100';
  const RED = 'bg-red-50 text-red-600 hover:bg-red-100';
  const ORANGE = 'bg-orange-50 text-orange-600 hover:bg-orange-100';

  const actionsFor = (row) => {
    if (row.status === 'pending') return [actionButton(row, 'approved', GREEN), actionButton(row, 'rejected', RED)];
    if (row.status === 'approved') return [actionButton(row, 'suspended', ORANGE)];
    if (row.status === 'suspended') return [actionButton(row, 'approved', GREEN)];
    return [actionButton(row, 'approved', GREEN)];
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-semibold text-gray-800 hover:text-primary-600">{value}</p>
          {row.email && <p className="text-xs text-gray-500">{row.email}</p>}
          <p className={`text-xs flex items-center gap-1 ${row.isPhoneVerified ? 'text-green-600' : 'text-orange-600'}`}>
            {row.isPhoneVerified ? <FiCheckCircle /> : <FiAlertCircle />}
            {row.phone || (kind === 'surveyor' ? 'No phone (verified)' : 'No phone')}
            <span className="text-gray-400">· {formatDate(row.createdAt)}</span>
          </p>
        </div>
      ),
    },
    {
      key: config.codeField,
      label: 'Login ID',
      sortable: true,
      render: (value) => <span className="font-mono font-semibold text-gray-800">{value}</span>,
    },
    kind === 'sanchalak'
      ? {
        key: 'kendraName',
        label: 'Kendra',
        sortable: true,
        render: (value, row) => (
          <div>
            <p className="text-gray-800">{value}</p>
            <p className="text-xs text-gray-500">
              {row.approvedSurveyorCount}/{row.surveyorCount} surveyors approved
            </p>
            {row.crops?.length > 0 && (
              <p className="text-xs text-gray-600 mt-0.5 max-w-[220px]" title={row.crops.map((c) => `${c.name}: ${c.farmers} farmer(s)`).join(', ')}>
                🌾 {row.crops.slice(0, 4).map((c) => c.name).join(', ')}
                {row.crops.length > 4 ? ` +${row.crops.length - 4}` : ''}
              </p>
            )}
          </div>
        ),
      }
      : !sanchalakId && {
        key: 'sanchalak',
        label: 'Sanchalak',
        sortable: false,
        render: (value) => (
          <div>
            {value?._id ? (
              <Link
                to={`${KIND_CONFIG.sanchalak.profilePath}/${value._id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-gray-800 hover:text-primary-600 hover:underline"
              >
                {value.kendraName}
              </Link>
            ) : (
              <p className="text-gray-800">—</p>
            )}
            <p className="text-xs text-gray-500">
              {value?.name} · {value?.sanchalakCode}
              {value?.status && value.status !== 'approved' ? ` (${value.status})` : ''}
            </p>
          </div>
        ),
      },
    kind === 'surveyor' && {
      key: 'farmerCount',
      label: 'Farmers',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-semibold text-gray-800">{value}</p>
          <p className="text-xs text-gray-500">{row.approvedFarmerCount} approved</p>
        </div>
      ),
    },
    {
      key: 'address',
      label: 'Location',
      sortable: false,
      render: (value) => (
        <div>
          <p className="text-gray-800">{value?.district || '—'}</p>
          <p className="text-xs text-gray-500">{value?.state}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value, row) => (
        <div>
          <Badge variant={STATUS_BADGE[value] || 'info'}>{value}</Badge>
          {row.rejectionReason && value !== 'approved' && (
            <p className="text-xs text-gray-500 mt-1 max-w-[180px]">{row.rejectionReason}</p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => <div className="flex items-center gap-2">{actionsFor(row)}</div>,
    },
  ].filter(Boolean);

  const totalAll = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">{config.title}</h1>
          <p className="text-sm sm:text-base text-gray-600">{config.subtitle}</p>
        </div>
      )}

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === 'all' ? totalAll : statusCounts[tab.value] || 0;
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.value);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {tab.label} <span className={active ? 'text-white/80' : 'text-gray-500'}>({count})</span>
              </button>
            );
          })}
        </div>
          <ExportButtons
            endpoint={`/admin/${config.listKey}/export`}
            filename={config.listKey}
            params={{
              ...(sanchalakId && { sanchalak: sanchalakId }),
              ...(search && { search }),
              ...(statusFilter !== 'all' && { status: statusFilter }),
            }}
          />
        </div>
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, phone, email or login ID..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        {isLoading && rows.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No {config.title.toLowerCase()} found.</p>
        ) : (
          <DataTable
            data={rows}
            columns={columns}
            pagination={false}
            onRowClick={(row) => navigate(`${config.profilePath}/${row.id}`)}
          />
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={pagination.pages || 1}
          totalItems={pagination.total || 0}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          className="mt-6"
        />
      </div>

      <AnimatePresence>
        {action && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/50 flex items-end sm:items-center justify-center p-4"
            onClick={() => !isSubmitting && setAction(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative"
              role="dialog"
              aria-modal="true"
            >
              <button
                type="button"
                onClick={() => setAction(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <FiX size={20} />
              </button>
              <h3 className="text-lg font-bold text-gray-800 mb-1">
                {action.status === 'approved' && action.row.status === 'suspended' ? 'Reactivate' : ACTION_LABELS[action.status]}{' '}
                {config.label}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {action.row.name} · <span className="font-mono">{action.row[config.codeField]}</span>
              </p>
              {action.status === 'approved' && (
                <p className="text-sm text-gray-700 mb-4">They will be able to log in and will be notified.</p>
              )}
              {needsReason && (
                <div className="mb-4">
                  <label htmlFor="status-reason" className="block text-sm font-semibold text-gray-700 mb-2">
                    Reason (shown to the {config.label.toLowerCase()})
                  </label>
                  <textarea
                    id="status-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    maxLength={500}
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
                  className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-50 ${action.status === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
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

export default FieldAccounts;
