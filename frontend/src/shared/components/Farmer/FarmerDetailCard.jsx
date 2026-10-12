import { FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import {
  FARMING_METHOD_OPTIONS,
  IRRIGATION_OPTIONS,
  LAND_TYPE_OPTIONS,
  optionLabel,
} from '../../constants/farmerRegistration';
import FarmerStatusBadge from './FarmerStatusBadge';

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const Row = ({ label, value, mono }) => (
  <div className="flex justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
    <dt className="text-sm text-gray-500">{label}</dt>
    <dd className={`text-sm font-semibold text-gray-900 text-right break-words ${mono ? 'font-mono' : ''}`}>{value || '—'}</dd>
  </div>
);

const Section = ({ title, children }) => (
  <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
    <h3 className="text-sm font-bold text-gray-800 mb-1">{title}</h3>
    <dl>{children}</dl>
  </section>
);

/**
 * Read-only view of a farmer registration. `farmer.aadhaar` is only present for admins;
 * everyone else sees the masked number.
 */
const FarmerDetailCard = ({ farmer }) => (
  <div className="space-y-4">
    <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900">{farmer.name}</h2>
          <p className="text-xs text-gray-500 font-mono">{farmer.registrationCode}</p>
        </div>
        <FarmerStatusBadge status={farmer.status} />
      </div>
      {farmer.status === 'rejected' && farmer.adminRemark && (
        <p className="mt-3 flex gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span><span className="font-semibold">Admin remark:</span> {farmer.adminRemark}</span>
        </p>
      )}
      {farmer.status === 'approved' && (
        <p className="mt-3 flex gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          <FiCheckCircle className="mt-0.5 shrink-0" />
          <span>Verified by admin{farmer.adminRemark ? ` — ${farmer.adminRemark}` : ''}</span>
        </p>
      )}
    </section>

    <Section title="Basic Details / मूल जानकारी">
      <Row label="Aadhaar / आधार" value={farmer.aadhaar || farmer.aadhaarMasked} mono />
      <Row label="Name / नाम" value={farmer.name} />
      <Row label="Father Name / पिता का नाम" value={farmer.fatherName} />
      <Row label="Village / गांव" value={farmer.village} />
      <Row label="Panchayat / पंचायत" value={farmer.panchayat} />
      <Row label="Block / ब्लॉक" value={farmer.block} />
      <Row label="District / जिला" value={farmer.district} />
      <Row label="Mobile / मोबाइल" value={farmer.mobile} />
      <Row label="Alternate Mobile / वैकल्पिक मोबाइल" value={farmer.altMobile} />
      <Row label="Email / ईमेल" value={farmer.email} />
    </Section>

    <Section title="Land Details / भूमि जानकारी">
      <Row label="Total Land / कुल भूमि" value={`${farmer.landTotalAcres} acre`} />
      <Row label="Proposed Land / प्रस्तावित भूमि" value={`${farmer.landProposedAcres} acre`} />
      <Row label="Land Type / भूमि प्रकार" value={optionLabel(LAND_TYPE_OPTIONS, farmer.landType)} />
      <Row label="Irrigation / सिंचाई" value={optionLabel(IRRIGATION_OPTIONS, farmer.irrigation)} />
      <Row label="Farming Method / खेती का तरीका" value={optionLabel(FARMING_METHOD_OPTIONS, farmer.farmingMethod)} />
    </Section>

    <Section title="Agreement & Surveyor / सहमति एवं सर्वेक्षक">
      <Row label="Agreement accepted" value={farmer.agreement?.accepted ? `Yes — ${formatDateTime(farmer.agreement.acceptedAt)}` : 'No'} />
      <Row label="Surveyor / सर्वेक्षक" value={farmer.surveyor ? `${farmer.surveyor.name} (${farmer.surveyor.surveyorCode})` : '—'} />
      <Row label="Kendra / केंद्र" value={farmer.sanchalak ? `${farmer.sanchalak.kendraName} (${farmer.sanchalak.sanchalakCode})` : '—'} />
      <Row label="Submitted" value={formatDateTime(farmer.submittedAt)} />
      {farmer.resubmitCount > 0 && <Row label="Resubmitted" value={`${farmer.resubmitCount} time(s)`} />}
    </Section>
  </div>
);

export default FarmerDetailCard;
