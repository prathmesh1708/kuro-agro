import { useCallback, useEffect, useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import FarmerDetailCard from '../../../../shared/components/Farmer/FarmerDetailCard';
import FarmerStatusBadge from '../../../../shared/components/Farmer/FarmerStatusBadge';
import { getAllFarmers, getFarmerById, reviewFarmer } from '../../services/adminService';

const STATUS_TABS = [
  { value: 'submitted', label: 'Pending Verification' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const ITEMS_PER_PAGE = 10;

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Kisan / Farmer module: registrations submitted by surveyors, verified here.
const Farmers = () => {
  const [rows, setRows] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [remark, setRemark] = useState('');
  const [rejectMode, setRejectMode] = useState(false);
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
      const response = await getAllFarmers({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const data = response?.data || {};
      setRows(data.registrations || []);
      setStatusCounts(data.statusCounts || {});
      setPagination(data.pagination || { total: 0, pages: 1 });
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (row) => {
    setSelected({ ...row });
    setRemark('');
    setRejectMode(false);
    setIsLoadingDetail(true);
    try {
      const response = await getFarmerById(row.id);
      setSelected(response?.data || row);
    } catch {
      setSelected(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const submitReview = async (status) => {
    if (status === 'rejected' && !remark.trim()) {
      toast.error('Please enter the reason for rejection.');
      return;
    }
    setIsSubmitting(true);
    try {
      await reviewFarmer(selected.id, status, remark.trim());
      toast.success(status === 'approved' ? 'Farmer approved.' : 'Farmer registration rejected.');
      setSelected(null);
      load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Farmer',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-semibold text-gray-800">{value}</p>
          <p className="text-xs text-gray-500">S/o {row.fatherName} · {row.mobile}</p>
          <p className="text-xs text-gray-400 font-mono">{row.registrationCode} · {row.aadhaarMasked}</p>
        </div>
      ),
    },
    {
      key: 'village',
      label: 'Location',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="text-gray-800">{value}, {row.panchayat}</p>
          <p className="text-xs text-gray-500">{row.block}, {row.district}</p>
        </div>
      ),
    },
    {
      key: 'landProposedAcres',
      label: 'Land (acre)',
      sortable: true,
      render: (value, row) => (
        <span className="text-gray-800">
          <span className="font-semibold">{value}</span> / {row.landTotalAcres}
        </span>
      ),
    },
    {
      key: 'surveyor',
      label: 'Surveyor / Kendra',
      sortable: false,
      render: (value, row) => (
        <div>
          <p className="text-gray-800">{value?.name || '—'}</p>
          <p className="text-xs text-gray-500">{row.sanchalak?.kendraName}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value, row) => (
        <div>
          <FarmerStatusBadge status={value} />
          <p className="text-xs text-gray-400 mt-1">{formatDate(row.submittedAt)}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <button
          type="button"
          onClick={() => openDetail(row)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${row.status === 'submitted' ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          {row.status === 'submitted' ? 'Review' : 'View'}
        </button>
      ),
    },
  ];

  const totalAll = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Farmers (Kisan)</h1>
        <p className="text-sm sm:text-base text-gray-600">Farmer registrations submitted by surveyors — verify and approve or reject</p>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-4">
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
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, father name, mobile, village, district, code or Aadhaar last 4..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        {isLoading && rows.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No farmer registrations found.</p>
        ) : (
          <DataTable data={rows} columns={columns} pagination={false} />
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
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setSelected(null)}
              className="fixed inset-0 bg-black/50 z-[10000]"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-xl bg-gray-50 z-[10001] flex flex-col shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Farmer registration"
            >
              <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-800">Farmer Registration</h2>
                <button type="button" onClick={() => setSelected(null)} className="p-2 text-gray-500 hover:text-gray-800" aria-label="Close">
                  <FiX size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {isLoadingDetail ? (
                  <p className="text-center text-gray-500 py-8">Loading…</p>
                ) : (
                  <FarmerDetailCard farmer={selected} />
                )}
              </div>

              {selected.status === 'submitted' && !isLoadingDetail && (
                <div className="bg-white border-t border-gray-200 p-5 space-y-3">
                  {rejectMode && (
                    <div>
                      <label htmlFor="reject-remark" className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Reason for rejection (shown to the surveyor)
                      </label>
                      <textarea
                        id="reject-remark"
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        rows={3}
                        maxLength={500}
                        autoFocus
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  )}
                  <div className="flex gap-3">
                    {rejectMode ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setRejectMode(false)}
                          disabled={isSubmitting}
                          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => submitReview('rejected')}
                          disabled={isSubmitting}
                          className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        >
                          {isSubmitting ? 'Saving…' : 'Confirm Reject'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setRejectMode(true)}
                          disabled={isSubmitting}
                          className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-red-600 bg-red-50 hover:bg-red-100"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => submitReview('approved')}
                          disabled={isSubmitting}
                          className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                          {isSubmitting ? 'Saving…' : 'Approve Farmer'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Farmers;
