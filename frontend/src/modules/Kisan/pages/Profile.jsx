import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLogOut, FiPhone, FiMail, FiMapPin, FiHome, FiClipboard } from 'react-icons/fi';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import { useKisanAuthStore } from '../store/kisanStore';

const InfoRow = ({ icon: Icon, children }) => (
  <p className="flex items-start gap-3 text-sm text-gray-700">
    <Icon className="mt-0.5 shrink-0 text-gray-400" />
    <span className="min-w-0 break-words">{children}</span>
  </p>
);

const KisanProfile = () => {
  const navigate = useNavigate();
  const { account, fetchProfile, logout } = useKisanAuthStore();

  useEffect(() => {
    fetchProfile().catch(() => {});
  }, [fetchProfile]);

  const address = account?.address || {};
  const kendra = account?.sanchalak && typeof account.sanchalak === 'object' ? account.sanchalak : null;
  const surveyor = account?.surveyor && typeof account.surveyor === 'object' ? account.surveyor : null;

  const handleLogout = () => {
    logout();
    navigate('/login?role=kisan', { replace: true });
  };

  return (
    <FieldPanelLayout role="kisan" title="Profile">
      <section className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 shrink-0 rounded-full border-2 flex items-center justify-center text-xl font-bold bg-green-50 text-green-700 border-green-200">
            {(account?.name || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{account?.name}</h2>
            <p className="text-xs text-gray-500">Kisan / Farmer{account?.fatherName ? ` · S/o ${account.fatherName}` : ''}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 bg-green-50 text-green-700 border-green-200">
          <span className="text-xs font-semibold uppercase">Kisan ID</span>
          <span className="font-bold tracking-wider">{account?.kisanCode}</span>
        </div>

        <div className="mt-4 space-y-2.5">
          <InfoRow icon={FiPhone}>{account?.phone}</InfoRow>
          {account?.email && <InfoRow icon={FiMail}>{account.email}</InfoRow>}
          {(address.village || address.district) && (
            <InfoRow icon={FiMapPin}>{[address.village, address.panchayat, address.block, address.district].filter(Boolean).join(', ')}</InfoRow>
          )}
          {kendra && (
            <InfoRow icon={FiHome}>
              {kendra.kendraName} · Sanchalak {kendra.name}
              {kendra.phone ? ` · ${kendra.phone}` : ''}
            </InfoRow>
          )}
          {surveyor && <InfoRow icon={FiClipboard}>Registered by {surveyor.name} ({surveyor.surveyorCode})</InfoRow>}
        </div>
      </section>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-red-200 text-red-600 font-semibold bg-white hover:bg-red-50"
      >
        <FiLogOut /> Logout
      </button>
    </FieldPanelLayout>
  );
};

export default KisanProfile;
