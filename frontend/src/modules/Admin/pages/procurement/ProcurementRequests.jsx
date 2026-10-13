import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiSearch, FiX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import TradeStatusBadge, { PaymentBadge } from '../../../../shared/components/Produce/TradeStatusBadge';
import RequestSummary, { SummaryRow } from '../../../../shared/components/Produce/RequestSummary';
import RequestHistory from '../../../../shared/components/Produce/RequestHistory';
import PaymentPanel from '../../../../shared/components/Produce/PaymentPanel';
import { formatDate, formatInr, formatQty } from '../../../../shared/components/Produce/produceFormat';
import {
  decideProcurementRequest,
  getProcurementRequest,
  getProcurementRequests,
  updateProcurementPayment,
} from '../../services/adminService';

const STATUS_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
  { value: 'not_received', label: 'Not Received' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];

const ITEMS_PER_PAGE = 10;

// Produce Sanchalaks are sending from their Kendra warehouses. Received moves it into Procured Stock.
// `sanchalakId` (or ?sanchalak= in the URL) limits the list to one Kendra; `embedded` drops the page header.
const ProcurementRequests = ({ sanchalakId: sanchalakProp, embedded = false, onChanged }) => {
  const [searchParams] = useSearchParams();
  const sanchalakId = sanchalakProp || searchParams.get('sanchalak') || undefined;

  const [rows, setRows] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [statusFilter, setStatusFilter] = useState(embedded ? 'all' : 'pending');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [remark, setRemark] = useState('');
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
      const response = await getProcurementRequests({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        ...(sanchalakId && { sanchalak: sanchalakId }),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const data = response?.data || {};
      setRows(data.requests || []);
      setStatusCounts(data.statusCounts || {});
      setPagination(data.pagination || { total: 0, pages: 1 });
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsLoading(false);
    }
  }, [sanchalakId, currentPage, search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshDetail = async (id) => {
    const response = await getProcurementRequest(id);
    setSelected(response?.data || null);
  };

  const openDetail = async (row) => {
    setSelected(row);
    setRemark('');
    setRejectMode(false);
    setIsLoadingDetail(true);
    try {
      await refreshDetail(row.id);
    } catch {
      setSelected(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const decide = async (decision) => {
    if (decision === 'not_received' && !remark.trim()) {
      toast.error('Please enter the reason.');
      return;
    }
    setIsSubmitting(true);
    try {
      await decideProcurementRequest(selected.id, decision, remark.trim());
      toast.success(decision === 'received' ? 'Received — added to Procured Stock.' : 'Marked as not received.');
      await refreshDetail(selected.id);
      setRejectMode(false);
      load();
      onChanged?.();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSubmitting(false);
    }
  };

  const savePayment = async (payload) => {
    await updateProcurementPayment(selected.id, payload);
    toast.success(payload.status === 'paid' ? 'Marked as paid.' : 'Marked as unpaid.');
    await refreshDetail(selected.id);
    load();
  };

  const columns = [
    {
      key: 'produceName',
      label: 'Produce',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-semibold text-gray-800">{value}</p>
          <p className="text-xs text-gray-400 font-mono">{row.requestCode}</p>
        </div>
      ),
    },
    !sanchalakId && {
      key: 'sanchalak',
      label: 'Kendra',
      sortable: false,
      render: (value) =>
        value?._id ? (
          <Link
            to={`/admin/field-network/sanchalaks/${value._id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-gray-800 hover:text-primary-600 hover:underline"
          >
            <span className="block">{value.kendraName}</span>
            <span className="block text-xs text-gray-500">{value.name} · {value.sanchalakCode}</span>
          </Link>
        ) : (
          '—'
        ),
    },
    {
      key: 'quantityKg',
      label: 'Quantity',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-semibold text-gray-800">{formatQty(value, row.unit)}</p>
          <p className="text-xs text-gray-500">{formatInr(row.pricePerUnit)}/{row.unit}</p>
        </div>
      ),
    },
    { key: 'totalAmount', label: 'Amount', sortable: true, render: (value) => <span className="font-semibold">{formatInr(value)}</span> },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value, row) => (
        <div className="space-y-1">
          <TradeStatusBadge status={value} />
          {value === 'received' && <div><PaymentBadge payment={row.payment} /></div>}
          <p className="text-xs text-gray-400">{formatDate(row.createdAt)}</p>
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
          onClick={(e) => {
            e.stopPropagation();
            openDetail(row);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${row.status === 'pending' ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          {row.status === 'pending' ? 'Review' : 'View'}
        </button>
      ),
    },
  ].filter(Boolean);

  const totalAll = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Procurement Requests</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Produce sent by Kendras. Mark Received to add it to Procured Stock, or Not Received to return it to the Kendra.
            {sanchalakId && (
              <>
                {' '}
                <Link to="/admin/field-network/procurement-requests" className="text-primary-600 font-semibold hover:underline">Show all Kendras</Link>
              </>
            )}
          </p>
        </div>
      )}

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
            placeholder="Search by produce, code, Kendra or Sanchalak…"
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        {isLoading && rows.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No procurement requests found.</p>
        ) : (
          <DataTable data={rows} columns={columns} pagination={false} onRowClick={openDetail} />
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
              aria-label="Procurement request"
            >
              <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-800">Procurement Request</h2>
                <button type="button" onClick={() => setSelected(null)} className="p-2 text-gray-500 hover:text-gray-800" aria-label="Close">
                  <FiX size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {isLoadingDetail ? (
                  <p className="text-center text-gray-500 py-8">Loading…</p>
                ) : (
                  <>
                    <RequestSummary request={selected}>
                      <SummaryRow label="Kendra">{selected.sanchalak?.kendraName}</SummaryRow>
                      <SummaryRow label="Sanchalak">
                        {selected.sanchalak?.name} ({selected.sanchalak?.sanchalakCode}) · {selected.sanchalak?.phone}
                      </SummaryRow>
                      {selected.sanchalakNote && <SummaryRow label="Note">{selected.sanchalakNote}</SummaryRow>}
                      {selected.adminRemark && <SummaryRow label="Admin remark">{selected.adminRemark}</SummaryRow>}
                    </RequestSummary>
                    {selected.status === 'received' && (
                      <PaymentPanel
                        payment={selected.payment}
                        amount={selected.totalAmount}
                        title="Payment to Sanchalak"
                        paidText="Paid to the Sanchalak"
                        unpaidText="Not paid to the Sanchalak yet"
                        onSave={savePayment}
                      />
                    )}
                    <RequestHistory history={selected.history} />
                  </>
                )}
              </div>

              {selected.status === 'pending' && !isLoadingDetail && (
                <div className="bg-white border-t border-gray-200 p-5 space-y-3">
                  {rejectMode && (
                    <div>
                      <label htmlFor="not-received-remark" className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Reason (shown to the Sanchalak)
                      </label>
                      <textarea
                        id="not-received-remark"
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
                        <button type="button" onClick={() => setRejectMode(false)} disabled={isSubmitting} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50">
                          Cancel
                        </button>
                        <button type="button" onClick={() => decide('not_received')} disabled={isSubmitting} className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                          {isSubmitting ? 'Saving…' : 'Confirm Not Received'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setRejectMode(true)} disabled={isSubmitting} className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-red-600 bg-red-50 hover:bg-red-100">
                          Not Received
                        </button>
                        <button type="button" onClick={() => decide('received')} disabled={isSubmitting} className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                          {isSubmitting ? 'Saving…' : 'Received'}
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

export default ProcurementRequests;
