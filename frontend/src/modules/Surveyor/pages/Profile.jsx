import FieldProfile from '../../../shared/components/FieldAuth/FieldProfile';
import { useSurveyorAuthStore } from '../store/surveyorStore';
import { getSurveyorCommission } from '../services/surveyorService';

const SurveyorProfile = () => {
  const { account, fetchProfile, logout } = useSurveyorAuthStore();
  return (
    <FieldProfile role="surveyor" account={account} fetchProfile={fetchProfile} fetchCommission={getSurveyorCommission} logout={logout} />
  );
};

export default SurveyorProfile;
