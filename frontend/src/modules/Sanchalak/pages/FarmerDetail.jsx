import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import FarmerDetailCard from '../../../shared/components/Farmer/FarmerDetailCard';
import { getKendraFarmer } from '../services/sanchalakService';

const SanchalakFarmerDetail = () => {
  const { id } = useParams();
    const [farmer, setFarmer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getKendraFarmer(id)
      .then((response) => setFarmer(response?.data || null))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [id]);

  return (
    <FieldPanelLayout role="sanchalak" title="Farmer">
      <Link to="/sanchalak/farmers" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
        <FiArrowLeft /> Farmers
      </Link>
      {isLoading ? (
        <p className="text-center text-sm text-gray-500 py-10">Loading…</p>
      ) : !farmer ? (
        <p className="text-center text-sm text-gray-500 py-10">Farmer not found.</p>
      ) : (
        <FarmerDetailCard farmer={farmer} />
      )}
    </FieldPanelLayout>
  );
};

export default SanchalakFarmerDetail;
