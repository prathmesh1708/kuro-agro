import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiChevronRight } from 'react-icons/fi';
import TradeStatusBadge, { PaymentBadge } from './TradeStatusBadge';
import { finalTerms, formatDate, formatInr, formatQty } from './produceFormat';

/**
 * Mobile-first list of produce requests with status tabs, search and paging.
 * Used for a Kisan's offers, a Sanchalak's purchase requests and a Sanchalak's sales to admin.
 * @param {Function} fetchRequests  (params) => api promise resolving to { data: { requests, statusCounts, pagination } }
 * @param {Array}    tabs           [{ value, label }]; 'all' shows every status
 * @param {Function} detailPath     (request) => route of the detail page
 * @param {Function} [subtitle]     (request) => extra line, e.g. the farmer's name
 * @param {string}   paidStatus     status after which the payment badge is shown ('purchased' / 'received')
 */
const TradeRequestList = ({ fetchRequests, tabs, initialStatus = 'all', detailPath, subtitle, paidStatus, searchPlaceholder = 'Search…', emptyText = 'Nothing here yet.', emptyAction = null }) => {
  const [status, setStatus] = useState(initialStatus);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ requests: [], statusCounts: {}, pagination: { pages: 1 } });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchRequests({ page, limit: 20, ...(status !== 'all' && { status }), ...(search && { search }) })
      .then((response) => {
        if (!cancelled) setData(response?.data || { requests: [], statusCounts: {}, pagination: { pages: 1 } });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchRequests, page, status, search]);

  const counts = data.statusCounts || {};
  const totalAll = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((tab) => {
          const active = status === tab.value;
          const count = tab.value === 'all' ? totalAll : counts[tab.value] || 0;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="relative">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-gray-400 focus:outline-none bg-white text-sm"
        />
      </div>

      {isLoading && data.requests.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-10">Loading…</p>
      ) : data.requests.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-sm text-gray-500">{emptyText}</p>
          {emptyAction}
        </div>
      ) : (
        <ul className="space-y-3">
          {data.requests.map((request) => {
            const terms = finalTerms(request);
            return (
              <li key={request.id}>
                <Link
                  to={detailPath(request)}
                  className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-gray-300 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 truncate">{request.produceName}</p>
                      <TradeStatusBadge status={request.status} />
                    </div>
                    <p className="text-sm text-gray-700 mt-1">
                      {formatQty(terms.quantityKg, request.unit)} · {formatInr(terms.pricePerUnit)}/{request.unit} ·{' '}
                      <span className="font-semibold">{formatInr(terms.totalAmount)}</span>
                    </p>
                    {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle(request)}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400 font-mono">{request.requestCode}</span>
                      <span className="text-xs text-gray-400">· {formatDate(request.createdAt)}</span>
                      {paidStatus && request.status === paidStatus && <PaymentBadge payment={request.payment} />}
                    </div>
                  </div>
                  <FiChevronRight className="text-gray-400 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {(data.pagination?.pages || 1) > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-gray-500">Page {page} of {data.pagination.pages}</span>
          <button
            type="button"
            disabled={page >= data.pagination.pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default TradeRequestList;
