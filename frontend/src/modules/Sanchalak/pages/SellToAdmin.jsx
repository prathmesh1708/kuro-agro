import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import ProduceOfferForm from '../../../shared/components/Produce/ProduceOfferForm';
import { formatInr, formatQty } from '../../../shared/components/Produce/produceFormat';
import { ROLE_CONFIG } from '../../../shared/components/FieldAuth/roleConfig';
import { createSaleToAdmin, getKendraStock, getSanchalakProduce } from '../services/sanchalakService';

// Offer warehouse stock to admin. The quantity is held until admin marks it Received or Not Received.
const SanchalakSellToAdmin = () => {
  const [options, setOptions] = useState(null);
  const [submitted, setSubmitted] = useState(null);

  const loadOptions = () =>
    Promise.all([getKendraStock(), getSanchalakProduce()])
      .then(([stockRes, produceRes]) => {
        const byId = new Map((produceRes?.data?.produce || []).map((p) => [p.id, p]));
        setOptions(
          (stockRes?.data?.items || [])
            .filter((item) => item.availableKg > 0 && byId.has(item.produce))
            .map((item) => ({ ...byId.get(item.produce), availableKg: item.availableKg }))
        );
      })
      .catch(() => setOptions([]));

  useEffect(() => {
    loadOptions();
  }, []);

  const handleSubmit = async (payload) => {
    const response = await createSaleToAdmin(payload);
    setSubmitted(response?.data);
    window.scrollTo({ top: 0 });
  };

  if (submitted) {
    return (
      <FieldPanelLayout role="sanchalak" title="Sell to Admin">
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-4">
          <FiCheckCircle className="mx-auto text-sky-600" size={56} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Sent to admin</h1>
            <p className="text-sm text-gray-600 mt-1">
              {formatQty(submitted.quantityKg, submitted.unit)} of {submitted.produceName} for {formatInr(submitted.totalAmount)}.
              This stock is held until admin marks it received.
            </p>
          </div>
          <p className="inline-block rounded-xl bg-sky-50 border border-sky-200 px-4 py-2 font-mono font-bold text-sky-900">{submitted.requestCode}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Link to={`/sanchalak/sales/${submitted.id}`} className="py-3 rounded-xl border-2 border-gray-200 font-semibold text-gray-800">
              View request
            </Link>
            <button
              type="button"
              onClick={() => {
                setSubmitted(null);
                setOptions(null);
                loadOptions();
              }}
              className="py-3 rounded-xl bg-sky-600 text-white font-semibold"
            >
              Send more
            </button>
          </div>
        </div>
      </FieldPanelLayout>
    );
  }

  return (
    <FieldPanelLayout role="sanchalak" title="Sell to Admin">
      <Link to="/sanchalak/warehouse" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
        <FiArrowLeft /> Warehouse
      </Link>
      <h1 className="text-xl font-bold text-gray-900">Sell to Admin</h1>
      <p className="text-sm text-gray-500 mb-4">Choose produce from your warehouse, the quantity you are sending and your price.</p>
      {!options ? (
        <p className="text-center text-sm text-gray-500 py-10">Loading…</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-2xl p-4 shadow-sm">No stock available to sell. Buy from your farmers first.</p>
      ) : (
        <ProduceOfferForm
          produceOptions={options}
          onSubmit={handleSubmit}
          submitLabel="Send to Admin"
          theme={ROLE_CONFIG.sanchalak.theme}
          notePlaceholder="Vehicle number, bags, quality…"
        />
      )}
    </FieldPanelLayout>
  );
};

export default SanchalakSellToAdmin;
