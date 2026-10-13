import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiX, FiSearch } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import { formatDate, formatDateTime, formatInr, formatQty, toUnits } from '../../../../shared/components/Produce/produceFormat';
import { getAdminStock, getAllProducts, getStockLedger, moveStockToProduct } from '../../services/adminService';

const LEDGER_LABELS = {
  kisan_purchase: 'Bought from farmer',
  reserved_for_admin: 'Offered to admin (reserved)',
  reservation_released: 'Reservation released',
  sent_to_admin: 'Sent to admin',
  received_from_sanchalak: 'Received from Kendra',
  moved_to_product: 'Moved to product',
};

const LEDGER_PER_PAGE = 15;

const StatTile = ({ label, value, hint, to }) => {
  const body = (
    <>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </>
  );
  const className = 'bg-white rounded-xl p-4 shadow-sm border border-gray-200 block';
  return to ? <Link to={to} className={`${className} hover:border-primary-300`}>{body}</Link> : <div className={className}>{body}</div>;
};

// Pick a store product and say how many of its units the procured quantity becomes (e.g. 1 quintal → 100 × 1 kg packs).
const MoveToProductDialog = ({ item, onClose, onMoved }) => {
  const [searchInput, setSearchInput] = useState('');
  const [products, setProducts] = useState([]);
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [units, setUnits] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const maxUnits = toUnits(item.quantityKg, item.unit);

  useEffect(() => {
    const timer = setTimeout(() => {
      getAllProducts({ limit: 10, ...(searchInput.trim() && { search: searchInput.trim() }) })
        .then((response) => setProducts(response?.data?.products || []))
        .catch(() => setProducts([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const submit = async () => {
    if (!product) return toast.error('Please choose a product.');
    if (!(Number(quantity) > 0) || Number(quantity) > maxUnits) return toast.error(`Enter a quantity up to ${formatQty(item.quantityKg, item.unit)}.`);
    if (!(Number(units) >= 1) || !Number.isInteger(Number(units))) return toast.error('Enter how many product units to add.');

    setIsSaving(true);
    try {
      const response = await moveStockToProduct(item.produce, {
        productId: product._id,
        quantity: Number(quantity),
        productUnits: Number(units),
        note: note.trim(),
      });
      toast.success(response?.message || 'Stock moved.');
      onMoved();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] bg-black/50 flex items-end sm:items-center justify-center p-4"
      onClick={() => !isSaving && onClose()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
          <FiX size={20} />
        </button>
        <h3 className="text-lg font-bold text-gray-800 mb-1">Move {item.produceName} to a product</h3>
        <p className="text-sm text-gray-600 mb-4">{formatQty(item.quantityKg, item.unit)} in stock. The quantity leaves Procured Stock and the units are added to the product&apos;s stock.</p>

        <label htmlFor="product-search" className="block text-sm font-semibold text-gray-700 mb-1">Product</label>
        {product ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-primary-200 bg-primary-50 mb-4">
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 truncate">{product.name}</p>
              <p className="text-xs text-gray-500">In stock: {product.stockQuantity} · {product.vendorId?.storeName || 'No vendor'}</p>
            </div>
            <button type="button" onClick={() => setProduct(null)} className="text-sm font-semibold text-primary-700">Change</button>
          </div>
        ) : (
          <div className="mb-4">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="product-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products by name…"
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <ul className="mt-2 max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {products.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-500">No products found.</li>
              ) : (
                products.map((p) => (
                  <li key={p._id}>
                    <button type="button" onClick={() => setProduct(p)} className="w-full text-left px-3 py-2 hover:bg-gray-50">
                      <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-500">Stock {p.stockQuantity} {p.unit} · {p.vendorId?.storeName || '—'}</p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label htmlFor="move-qty" className="block text-sm font-semibold text-gray-700 mb-1">Quantity ({item.unit})</label>
            <input id="move-qty" type="number" min="0.01" step="0.01" max={maxUnits} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="move-units" className="block text-sm font-semibold text-gray-700 mb-1">Product units to add</label>
            <input id="move-units" type="number" min="1" step="1" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="e.g. 100 packs" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
        <label htmlFor="move-note" className="block text-sm font-semibold text-gray-700 mb-1">Note (optional)</label>
        <input id="move-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Batch, packing details…" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 mb-5" />

        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={isSaving} className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50">
            {isSaving ? 'Moving…' : 'Move Stock'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Produce received from Kendras, ready to be packed into store products.
const ProcuredStock = () => {
  const [stock, setStock] = useState(null);
  const [ledger, setLedger] = useState({ entries: [], pagination: { total: 0, pages: 1 } });
  const [ledgerPage, setLedgerPage] = useState(1);
  const [moving, setMoving] = useState(null);

  const loadStock = useCallback(() => {
    getAdminStock()
      .then((response) => setStock(response?.data || null))
      .catch(() => {});
  }, []);

  const loadLedger = useCallback(() => {
    getStockLedger({ page: ledgerPage, limit: LEDGER_PER_PAGE })
      .then((response) => setLedger(response?.data || { entries: [], pagination: { total: 0, pages: 1 } }))
      .catch(() => {});
  }, [ledgerPage]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const stockColumns = [
    { key: 'produceName', label: 'Produce', sortable: true, render: (value) => <span className="font-semibold text-gray-800">{value}</span> },
    { key: 'quantityKg', label: 'In Stock', sortable: true, render: (value, row) => <span className="font-bold text-gray-900">{formatQty(value, row.unit)}</span> },
    {
      key: 'receivedKg',
      label: 'Received (total)',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="text-gray-800">{formatQty(value, row.unit)}</p>
          <p className="text-xs text-gray-500">{formatInr(row.receivedValue)}</p>
        </div>
      ),
    },
    { key: 'movedToProductsKg', label: 'Moved to Products', sortable: true, render: (value, row) => formatQty(value, row.unit) },
    { key: 'lastReceivedAt', label: 'Last Received', sortable: true, render: (value) => formatDate(value) },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <button
          type="button"
          disabled={row.quantityKg <= 0}
          onClick={() => setMoving(row)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Move to Product
        </button>
      ),
    },
  ];

  const kendraColumns = [
    { key: 'produceName', label: 'Produce', sortable: true },
    { key: 'quantityKg', label: 'Held in Kendras', sortable: true, render: (value, row) => <span className="font-semibold">{formatQty(value, row.unit)}</span> },
    { key: 'kendras', label: 'Kendras', sortable: true },
  ];

  const ledgerColumns = [
    { key: 'createdAt', label: 'When', sortable: false, render: (value) => <span className="text-sm">{formatDateTime(value)}</span> },
    {
      key: 'reason',
      label: 'Movement',
      sortable: false,
      render: (value, row) => (
        <div>
          <p className="text-gray-800">{LEDGER_LABELS[value] || value}</p>
          <p className="text-xs text-gray-500">
            {row.ownerType === 'admin' ? 'Admin stock' : row.sanchalak?.kendraName || 'Kendra'}
            {row.productName ? ` → ${row.productName} (+${row.productUnits})` : ''}
            {row.note ? ` · ${row.note}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'produceName', label: 'Produce', sortable: false },
    {
      key: 'changeKg',
      label: 'Change',
      sortable: false,
      render: (value, row) => {
        const kg = value || row.reservedChangeKg;
        const reservedOnly = !value && row.reservedChangeKg;
        return (
          <span className={`font-semibold ${kg > 0 ? 'text-green-600' : kg < 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {kg > 0 ? '+' : ''}
            {formatQty(kg, row.unit)}
            {reservedOnly ? ' reserved' : ''}
          </span>
        );
      },
    },
    { key: 'balanceKg', label: 'Balance', sortable: false, render: (value, row) => formatQty(value, row.unit) },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Procured Stock</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Produce received from Kendras. Move it into a store product when it is packed for sale.
        </p>
      </div>

      {stock && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Produce in Stock" value={stock.items.filter((i) => i.quantityKg > 0).length} hint={`${stock.items.length} produce received so far`} />
          <StatTile label="Pending Requests" value={stock.pendingRequests} hint="Awaiting Received / Not Received" to="/admin/field-network/procurement-requests" />
          <StatTile label="Unpaid to Sanchalaks" value={formatInr(stock.unpaidToSanchalaks.amount)} hint={`${stock.unpaidToSanchalaks.count} received request(s)`} to="/admin/field-network/procurement-requests" />
          <StatTile label="Received Value" value={formatInr(stock.items.reduce((sum, i) => sum + i.receivedValue, 0))} hint="All time" />
        </div>
      )}

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Admin Stock</h2>
        {!stock ? (
          <p className="text-center text-gray-500 py-8">Loading…</p>
        ) : stock.items.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Nothing received yet. Stock appears here when you mark a procurement request as Received.</p>
        ) : (
          <DataTable data={stock.items} columns={stockColumns} pagination={false} />
        )}
      </div>

      {stock?.inKendras?.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Still in Kendra Warehouses</h2>
          <p className="text-sm text-gray-500 mb-4">Bought from farmers but not yet sent to admin.</p>
          <DataTable data={stock.inKendras.map((row) => ({ ...row, id: row.produce }))} columns={kendraColumns} pagination={false} />
        </div>
      )}

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Stock Ledger</h2>
        <p className="text-sm text-gray-500 mb-4">Every stock movement in Kendras and admin stock, newest first.</p>
        {ledger.entries.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No stock movements yet.</p>
        ) : (
          <DataTable data={ledger.entries} columns={ledgerColumns} pagination={false} sortable={false} />
        )}
        <Pagination
          currentPage={ledgerPage}
          totalPages={ledger.pagination.pages || 1}
          totalItems={ledger.pagination.total || 0}
          itemsPerPage={LEDGER_PER_PAGE}
          onPageChange={setLedgerPage}
          className="mt-6"
        />
      </div>

      <AnimatePresence>
        {moving && (
          <MoveToProductDialog
            item={moving}
            onClose={() => setMoving(null)}
            onMoved={() => {
              setMoving(null);
              loadStock();
              loadLedger();
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ProcuredStock;
