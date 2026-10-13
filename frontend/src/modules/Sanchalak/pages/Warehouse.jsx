import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiTruck } from 'react-icons/fi';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import { formatDate, formatInr, formatQty } from '../../../shared/components/Produce/produceFormat';
import { getKendraStock, getStockByKisan } from '../services/sanchalakService';

const Stat = ({ label, value, hint }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
    <p className="font-bold text-gray-900">{value}</p>
    {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
  </div>
);

const StockTab = ({ stock }) => {
  if (!stock.items.length) {
    return <p className="text-sm text-gray-500 bg-white rounded-2xl p-4 shadow-sm">Your warehouse is empty. Stock is added when you mark a farmer&apos;s offer as Purchased.</p>;
  }
  return (
    <ul className="space-y-3">
      {stock.items.map((item) => (
        <li key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="font-bold text-gray-900">{item.produceName}</p>
            <p className="text-lg font-bold text-sky-700">{formatQty(item.quantityKg, item.unit)}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Available" value={formatQty(item.availableKg, item.unit)} />
            <Stat label="Sent, awaiting admin" value={formatQty(item.reservedKg, item.unit)} />
            <Stat label="Last bought" value={formatDate(item.lastPurchasedAt)} />
            <Stat label="Bought" value={formatQty(item.purchasedKg, item.unit)} hint={formatInr(item.purchasedValue)} />
            <Stat label="Sold to admin" value={formatQty(item.soldKg, item.unit)} hint={formatInr(item.soldValue)} />
          </div>
        </li>
      ))}
    </ul>
  );
};

const FarmersTab = ({ kisans }) => {
  if (!kisans) return <p className="text-center text-sm text-gray-500 py-10">Loading…</p>;
  if (!kisans.length) return <p className="text-sm text-gray-500 bg-white rounded-2xl p-4 shadow-sm">No purchases from farmers yet.</p>;
  return (
    <ul className="space-y-3">
      {kisans.map((row) => (
        <li key={row.kisan.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-gray-900 truncate">{row.kisan.name}</p>
              <p className="text-xs text-gray-500 truncate">
                {row.kisan.kisanCode} · {row.kisan.phone}
                {row.kisan.village ? ` · ${row.kisan.village}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-gray-900">{formatInr(row.amount)}</p>
              {row.unpaidAmount > 0 ? (
                <p className="text-xs font-semibold text-orange-600">{formatInr(row.unpaidAmount)} unpaid</p>
              ) : (
                <p className="text-xs font-semibold text-green-600">All paid</p>
              )}
            </div>
          </div>
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {row.produce.map((p) => (
              <li key={p.produce} className="flex items-center justify-between py-1.5">
                <span className="text-gray-700">{p.produceName} <span className="text-xs text-gray-400">({p.purchases}×)</span></span>
                <span className="text-gray-900 font-medium">{formatQty(p.quantityKg, p.unit)} · {formatInr(p.amount)}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
};

const SanchalakWarehouse = () => {
  const [tab, setTab] = useState('stock');
  const [stock, setStock] = useState(null);
  const [kisans, setKisans] = useState(null);

  useEffect(() => {
    getKendraStock()
      .then((response) => setStock(response?.data || { items: [], totals: {} }))
      .catch(() => setStock({ items: [], totals: {} }));
  }, []);

  useEffect(() => {
    if (tab !== 'farmers' || kisans) return;
    getStockByKisan()
      .then((response) => setKisans(response?.data?.kisans || []))
      .catch(() => setKisans([]));
  }, [tab, kisans]);

  const hasAvailable = stock?.items.some((item) => item.availableKg > 0);

  return (
    <FieldPanelLayout role="sanchalak" title="Warehouse">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kendra Warehouse</h1>
          <p className="text-sm text-gray-500">Stock bought from your farmers.</p>
        </div>
        {hasAvailable && (
          <Link to="/sanchalak/warehouse/sell" className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold">
            <FiTruck /> Sell to Admin
          </Link>
        )}
      </div>

      {stock && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Total bought</p>
            <p className="text-xl font-bold text-gray-900">{formatInr(stock.totals.purchasedValue)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Total sold to admin</p>
            <p className="text-xl font-bold text-gray-900">{formatInr(stock.totals.soldValue)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {[
          { value: 'stock', label: 'Stock' },
          { value: 'farmers', label: 'By Farmer' },
        ].map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${tab === t.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!stock ? <p className="text-center text-sm text-gray-500 py-10">Loading…</p> : tab === 'stock' ? <StockTab stock={stock} /> : <FarmersTab kisans={kisans} />}
    </FieldPanelLayout>
  );
};

export default SanchalakWarehouse;
