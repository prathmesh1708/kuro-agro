import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiEdit } from 'react-icons/fi';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import FarmerDetailCard from '../../../shared/components/Farmer/FarmerDetailCard';
import { getMyFarmer } from '../services/surveyorService';

const SurveyorFarmerDetail = () => {
  const { id } = useParams();
    const [farmer, setFarmer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getMyFarmer(id)
      .then((response) => setFarmer(response?.data || null))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [id]);

  return (
    <FieldPanelLayout role="surveyor" title="Farmer">
      <Link to="/surveyor/farmers" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
        <FiArrowLeft /> My Farmers
      </Link>
      {isLoading ? (
        <p className="text-center text-sm text-gray-500 py-10">Loading…</p>
      ) : !farmer ? (
        <p className="text-center text-sm text-gray-500 py-10">Farmer not found.</p>
      ) : (
        <>
          <FarmerDetailCard farmer={farmer} />
          {farmer.status === 'rejected' && (
            <Link
              to={`/surveyor/farmers/${farmer.id}/edit`}
              className="mt-4 flex items-center justify-center gap-2 w-full bg-gold-500 hover:bg-gold-600 text-white py-3.5 rounded-xl font-semibold"
            >
              <FiEdit /> Correct & Resubmit
            </Link>
          )}
        </>
      )}
    </FieldPanelLayout>
  );
};

export default SurveyorFarmerDetail;
