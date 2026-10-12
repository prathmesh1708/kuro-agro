import { Link } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import FarmerList from '../../../shared/components/Farmer/FarmerList';
import { getMyFarmers } from '../services/surveyorService';

const SurveyorFarmers = () => {
  
  return (
    <FieldPanelLayout role="surveyor" title="My Farmers">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-gray-900">My Farmers</h1>
        <Link
          to="/surveyor/farmers/new"
          className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm"
        >
          <FiPlus /> Register Farmer
        </Link>
      </div>
      <FarmerList fetchFarmers={getMyFarmers} detailPath={(farmer) => `/surveyor/farmers/${farmer.id}`} />
    </FieldPanelLayout>
  );
};

export default SurveyorFarmers;
