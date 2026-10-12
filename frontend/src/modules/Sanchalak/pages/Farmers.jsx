import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import FarmerList from '../../../shared/components/Farmer/FarmerList';
import { getKendraFarmers } from '../services/sanchalakService';

const SanchalakFarmers = () => {
  
  return (
    <FieldPanelLayout role="sanchalak" title="Farmers">
      <h1 className="text-xl font-bold text-gray-900">Farmers</h1>
      <p className="text-sm text-gray-500 mb-4">Registered by your surveyors. Admin verifies each registration.</p>
      <FarmerList fetchFarmers={getKendraFarmers} detailPath={(farmer) => `/sanchalak/farmers/${farmer.id}`} showSurveyor />
    </FieldPanelLayout>
  );
};

export default SanchalakFarmers;
