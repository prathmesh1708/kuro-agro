import FieldProfile from '../../../shared/components/FieldAuth/FieldProfile';
import { useSanchalakAuthStore } from '../store/sanchalakStore';
import { getSanchalakCommission } from '../services/sanchalakService';

const SanchalakProfile = () => {
  const { account, fetchProfile, logout } = useSanchalakAuthStore();
  return (
    <FieldProfile role="sanchalak" account={account} fetchProfile={fetchProfile} fetchCommission={getSanchalakCommission} logout={logout} />
  );
};

export default SanchalakProfile;
