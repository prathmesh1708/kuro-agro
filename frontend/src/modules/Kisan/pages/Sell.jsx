import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheckCircle } from 'react-icons/fi';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import ProduceOfferForm from '../../../shared/components/Produce/ProduceOfferForm';
import { formatInr, formatQty } from '../../../shared/components/Produce/produceFormat';
import { ROLE_CONFIG } from '../../../shared/components/FieldAuth/roleConfig';
import { createSaleRequest, getProduceList } from '../services/kisanService';

// Kisan offers produce to their Kendra; the Sanchalak then marks it Purchased or Not Purchased.
const KisanSell = () => {
  const [produce, setProduce] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    getProduceList()
      .then((response) => setProduce(response?.data?.produce || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (payload) => {
    const response = await createSaleRequest(payload);
    setSubmitted(response?.data);
    window.scrollTo({ top: 0 });
  };

  if (submitted) {
    return (
      <FieldPanelLayout role="kisan" title="Sell Produce">
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-4">
          <FiCheckCircle className="mx-auto text-green-600" size={56} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Offer sent to your Kendra</h1>
            <p className="text-sm text-gray-600 mt-1">
              {formatQty(submitted.quantityKg, submitted.unit)} of {submitted.produceName} for {formatInr(submitted.totalAmount)}.
              You will be notified when the Sanchalak decides.
            </p>
          </div>
          <p className="inline-block rounded-xl bg-green-50 border border-green-200 px-4 py-2 font-mono font-bold text-green-900">
            {submitted.requestCode}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Link to={`/kisan/requests/${submitted.id}`} className="py-3 rounded-xl border-2 border-gray-200 font-semibold text-gray-800">
              View offer
            </Link>
            <button type="button" onClick={() => setSubmitted(null)} className="py-3 rounded-xl bg-green-600 text-white font-semibold">
              Sell more
            </button>
          </div>
        </div>
      </FieldPanelLayout>
    );
  }

  return (
    <FieldPanelLayout role="kisan" title="Sell Produce">
      <h1 className="text-xl font-bold text-gray-900">Sell Produce / फसल बेचें</h1>
      <p className="text-sm text-gray-500 mb-4">Choose your crop, enter how much you have and your price. Your Kendra will confirm after weighing.</p>
      {isLoading ? (
        <p className="text-center text-sm text-gray-500 py-10">Loading…</p>
      ) : (
        <ProduceOfferForm
          produceOptions={produce}
          onSubmit={handleSubmit}
          submitLabel="Send to Kendra"
          theme={ROLE_CONFIG.kisan.theme}
        />
      )}
    </FieldPanelLayout>
  );
};

export default KisanSell;
