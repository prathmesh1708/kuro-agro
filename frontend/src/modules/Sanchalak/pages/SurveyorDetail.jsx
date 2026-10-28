import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiPhone, FiMail, FiMapPin } from 'react-icons/fi';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import FarmerList from '../../../shared/components/Farmer/FarmerList';
import { getKendraFarmers, getKendraSurveyor } from '../services/sanchalakService';

const STATUS_CLASS = {
  pending: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  suspended: 'bg-orange-50 text-orange-700 border-orange-200',
};

const STATS = [
  { key: 'total', label: 'Registered' },
  { key: 'submitted', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

// One surveyor of this Kendra, with the farmers they registered.
const SanchalakSurveyorDetail = () => {
  const { id } = useParams();
  const [surveyor, setSurveyor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getKendraSurveyor(id)
      .then((response) => setSurveyor(response?.data || null))
      .catch(() => setSurveyor(null))
      .finally(() => setIsLoading(false));
  }, [id]);

  // Stable reference so FarmerList does not refetch on every render.
  const fetchFarmers = useCallback((params) => getKendraFarmers({ ...params, surveyor: id }), [id]);

  const address = surveyor?.address || {};

  return (
    <FieldPanelLayout role="sanchalak" title="Surveyor">
      <Link to="/sanchalak/surveyors" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
        <FiArrowLeft /> Surveyors
      </Link>

      {isLoading ? (
        <p className="text-center text-sm text-gray-500 py-10">Loading…</p>
      ) : !surveyor ? (
        <p className="text-center text-sm text-gray-500 py-10">Surveyor not found.</p>
      ) : (
        <>
          <section className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-900 truncate">{surveyor.name}</h2>
                <p className="text-xs text-gray-500 font-mono">{surveyor.surveyorCode}</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${STATUS_CLASS[surveyor.status] || ''}`}>
                {surveyor.status}
              </span>
            </div>
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              {surveyor.phone && (
                <p className="flex items-center gap-3"><FiPhone className="text-gray-400 shrink-0" /> {surveyor.phone}</p>
              )}
              {surveyor.email && (
                <p className="flex items-center gap-3 break-all"><FiMail className="text-gray-400 shrink-0" /> {surveyor.email}</p>
              )}
              {(address.village || address.district) && (
                <p className="flex items-start gap-3">
                  <FiMapPin className="text-gray-400 shrink-0 mt-0.5" />
                  {[address.village, address.block, address.district, address.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </section>

          <section className="grid grid-cols-4 gap-2 mt-4">
            {STATS.map(({ key, label }) => (
              <div key={key} className="bg-white rounded-2xl py-3 px-1 text-center shadow-sm">
                <p className="text-xl font-bold text-gray-900">{surveyor.farmers?.[key] ?? 0}</p>
                <p className="text-[11px] text-gray-500">{label}</p>
              </div>
            ))}
          </section>

          <h3 className="text-base font-bold text-gray-900 mt-6 mb-3">Farmers registered by {surveyor.name}</h3>
          <FarmerList fetchFarmers={fetchFarmers} detailPath={(farmer) => `/sanchalak/farmers/${farmer.id}`} />
        </>
      )}
    </FieldPanelLayout>
  );
};

export default SanchalakSurveyorDetail;
