import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import {
  AGREEMENT_DECLARATION,
  AGREEMENT_SECTIONS,
  FARMING_METHOD_OPTIONS,
  IRRIGATION_OPTIONS,
  LAND_TYPE_OPTIONS,
} from '../../../shared/constants/farmerRegistration';
import { useSurveyorAuthStore } from '../store/surveyorStore';
import { getMyFarmer, registerFarmer, resubmitFarmer } from '../services/surveyorService';

const MOBILE_PATTERN = { value: /^[6-9]\d{9}$/, message: 'Enter a 10-digit mobile number starting with 6-9' };

const inputClass = (hasError) =>
  `w-full px-4 py-3 rounded-xl border-2 ${hasError ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-gold-500'} focus:outline-none transition-colors text-base bg-white`;

const Field = ({ label, error, children, hint }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
    {children}
    {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    {error && <p className="mt-1 text-sm text-red-600">{error.message}</p>}
  </div>
);

const SectionCard = ({ title, children }) => (
  <section className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 space-y-4">
    <h2 className="text-base font-bold text-gray-900">{title}</h2>
    {children}
  </section>
);

const digitsOnly = (max) => (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, max);
};

// Kuro Rice farmer registration, filled in by the Surveyor at the farm.
const FarmerForm = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { account } = useSurveyorAuthStore();
  const [existing, setExisting] = useState(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(isEdit);
  const [submitted, setSubmitted] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { landType: '', irrigation: '', farmingMethod: 'natural', agreementAccepted: false } });

  const mobile = watch('mobile');
  const landTotal = watch('landTotalAcres');

  useEffect(() => {
    if (!isEdit) return;
    getMyFarmer(id)
      .then((response) => {
        const farmer = response?.data;
        if (farmer?.status !== 'rejected') {
          toast.error('Only a rejected registration can be edited.');
          navigate(`/surveyor/farmers/${id}`, { replace: true });
          return;
        }
        setExisting(farmer);
        reset({
          aadhaar: '',
          name: farmer.name,
          fatherName: farmer.fatherName,
          village: farmer.village,
          panchayat: farmer.panchayat,
          block: farmer.block,
          district: farmer.district,
          mobile: farmer.mobile,
          altMobile: farmer.altMobile,
          email: farmer.email,
          landTotalAcres: farmer.landTotalAcres,
          landProposedAcres: farmer.landProposedAcres,
          landType: farmer.landType,
          irrigation: farmer.irrigation,
          farmingMethod: farmer.farmingMethod,
          agreementAccepted: false,
        });
      })
      .catch(() => navigate('/surveyor/farmers', { replace: true }))
      .finally(() => setIsLoadingExisting(false));
  }, [id, isEdit, navigate, reset]);

  const onSubmit = async (values) => {
    const payload = {
      aadhaar: values.aadhaar.trim(),
      name: values.name.trim(),
      fatherName: values.fatherName.trim(),
      village: values.village.trim(),
      panchayat: values.panchayat.trim(),
      block: values.block.trim(),
      district: values.district.trim(),
      mobile: values.mobile.trim(),
      altMobile: values.altMobile.trim(),
      email: values.email.trim(),
      landTotalAcres: Number(values.landTotalAcres),
      landProposedAcres: Number(values.landProposedAcres),
      landType: values.landType,
      irrigation: values.irrigation,
      farmingMethod: values.farmingMethod,
      agreementAccepted: values.agreementAccepted === true,
    };

    try {
      const response = isEdit ? await resubmitFarmer(id, payload) : await registerFarmer(payload);
      setSubmitted(response?.data);
      window.scrollTo({ top: 0 });
    } catch {
      // The API client already shows the error message.
    }
  };

  if (submitted) {
    return (
      <FieldPanelLayout role="surveyor" title="Register Farmer">
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-4">
          <FiCheckCircle className="mx-auto text-primary-500" size={56} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Resubmitted' : 'Registration submitted'}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {submitted.name}&apos;s registration has been sent to admin for verification.
            </p>
          </div>
          <p className="inline-block rounded-xl bg-gold-50 border border-gold-200 px-4 py-2 font-mono font-bold text-gold-900">
            {submitted.registrationCode}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Link to={`/surveyor/farmers/${submitted.id}`} className="py-3 rounded-xl border-2 border-gray-200 font-semibold text-gray-800">
              View Details
            </Link>
            {!isEdit && (
              <button
                type="button"
                onClick={() => {
                  setSubmitted(null);
                  reset({ landType: '', irrigation: '', farmingMethod: 'natural', agreementAccepted: false });
                }}
                className="py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-white font-semibold"
              >
                Register Another Farmer
              </button>
            )}
          </div>
        </div>
      </FieldPanelLayout>
    );
  }

  return (
    <FieldPanelLayout role="surveyor" title="Register Farmer">
      <Link to={isEdit ? `/surveyor/farmers/${id}` : '/surveyor/farmers'} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
        <FiArrowLeft /> Back
      </Link>
      <h1 className="text-xl font-bold text-gray-900">
        {isEdit ? 'Correct & Resubmit' : 'Farmer Registration'}
        <span className="block text-sm font-semibold text-gray-500">कुरो राइस किसान पंजीकरण</span>
      </h1>

      {existing?.adminRemark && (
        <p className="mt-4 flex gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span><span className="font-semibold">Admin remark:</span> {existing.adminRemark}</span>
        </p>
      )}

      {isLoadingExisting ? (
        <p className="text-center text-sm text-gray-500 py-10">Loading…</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-5" noValidate>
          <SectionCard title="Basic Details / मूल जानकारी">
            <Field
              label="Aadhaar Number / आधार संख्या (12 अंक)"
              error={errors.aadhaar}
              hint={isEdit ? `Re-enter the farmer's Aadhaar (on file: ${existing?.aadhaarMasked})` : undefined}
            >
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                onInput={digitsOnly(12)}
                {...register('aadhaar', {
                  required: 'Aadhaar number is required',
                  pattern: { value: /^\d{12}$/, message: 'Aadhaar must be exactly 12 digits' },
                })}
                className={`${inputClass(errors.aadhaar)} font-mono tracking-wider`}
              />
            </Field>
            <Field label="Name / नाम" error={errors.name}>
              <input type="text" {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })} className={inputClass(errors.name)} />
            </Field>
            <Field label="Father Name / पिता का नाम" error={errors.fatherName}>
              <input type="text" {...register('fatherName', { required: 'Father name is required', minLength: { value: 2, message: 'Too short' } })} className={inputClass(errors.fatherName)} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Village / गांव" error={errors.village}>
                <input type="text" {...register('village', { required: 'Village is required' })} className={inputClass(errors.village)} />
              </Field>
              <Field label="Panchayat / पंचायत" error={errors.panchayat}>
                <input type="text" {...register('panchayat', { required: 'Panchayat is required' })} className={inputClass(errors.panchayat)} />
              </Field>
              <Field label="Block / ब्लॉक" error={errors.block}>
                <input type="text" {...register('block', { required: 'Block is required' })} className={inputClass(errors.block)} />
              </Field>
              <Field label="District / जिला" error={errors.district}>
                <input type="text" {...register('district', { required: 'District is required' })} className={inputClass(errors.district)} />
              </Field>
              <Field label="Mobile / मोबाइल" error={errors.mobile}>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  onInput={digitsOnly(10)}
                  {...register('mobile', { required: 'Mobile is required', pattern: MOBILE_PATTERN })}
                  className={inputClass(errors.mobile)}
                />
              </Field>
              <Field label="Alternate Mobile / वैकल्पिक मोबाइल" error={errors.altMobile}>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  onInput={digitsOnly(10)}
                  {...register('altMobile', {
                    required: 'Alternate mobile is required',
                    pattern: MOBILE_PATTERN,
                    validate: (value) => value !== mobile || 'Must be different from mobile',
                  })}
                  className={inputClass(errors.altMobile)}
                />
              </Field>
            </div>
            <Field label="Email ID / ईमेल" error={errors.email}>
              <input
                type="email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                })}
                className={inputClass(errors.email)}
              />
            </Field>
          </SectionCard>

          <SectionCard title="Land Details / भूमि जानकारी">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Total Land (Acre) / कुल भूमि" error={errors.landTotalAcres}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  {...register('landTotalAcres', {
                    required: 'Required',
                    min: { value: 0.01, message: 'Must be more than 0' },
                  })}
                  className={inputClass(errors.landTotalAcres)}
                />
              </Field>
              <Field label="Proposed Land / प्रस्तावित भूमि" error={errors.landProposedAcres}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  {...register('landProposedAcres', {
                    required: 'Required',
                    min: { value: 0.01, message: 'Must be more than 0' },
                    validate: (value) => !landTotal || Number(value) <= Number(landTotal) || 'Cannot exceed total land',
                  })}
                  className={inputClass(errors.landProposedAcres)}
                />
              </Field>
            </div>
            <Field label="🌾 Land Type / भूमि प्रकार" error={errors.landType}>
              <select {...register('landType', { required: 'Select land type' })} className={inputClass(errors.landType)}>
                <option value="" disabled>Select / चुनें</option>
                {LAND_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="💧 Irrigation / सिंचाई" error={errors.irrigation}>
              <select {...register('irrigation', { required: 'Select irrigation' })} className={inputClass(errors.irrigation)}>
                <option value="" disabled>Select / चुनें</option>
                {IRRIGATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="🌱 Farming Method / खेती का तरीका" error={errors.farmingMethod}>
              <select {...register('farmingMethod', { required: 'Select farming method' })} className={inputClass(errors.farmingMethod)}>
                {FARMING_METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </SectionCard>

          <SectionCard title="Agreement / सहमति">
            <div className="max-h-80 overflow-y-auto rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-4 text-sm text-gray-700">
              {AGREEMENT_SECTIONS.map((section) => (
                <div key={section.title}>
                  <p className="font-bold text-gray-900 mb-2">{section.title}</p>
                  <ul className="space-y-2">
                    {section.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="text-green-600 shrink-0">✔</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div>
                <p className="font-bold text-gray-900 mb-1">Declaration / घोषणा</p>
                <p>{AGREEMENT_DECLARATION}</p>
              </div>
            </div>
            <label className={`flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer ${errors.agreementAccepted ? 'border-red-300' : 'border-gray-200'}`}>
              <input
                type="checkbox"
                {...register('agreementAccepted', { validate: (v) => v === true || 'The farmer must agree to continue' })}
                className="mt-1 h-5 w-5 accent-gold-500"
              />
              <span className="font-semibold text-gray-900">I Agree / मैं सहमत हूँ</span>
            </label>
            {errors.agreementAccepted && <p className="text-sm text-red-600">{errors.agreementAccepted.message}</p>}
            <Field label="Surveyor Name / सर्वेक्षक का नाम">
              <input
                type="text"
                value={account ? `${account.name} (${account.surveyorCode})` : ''}
                readOnly
                className={`${inputClass(false)} bg-gray-50 text-gray-600`}
              />
            </Field>
          </SectionCard>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gold-500 hover:bg-gold-600 text-white py-4 rounded-xl font-bold text-base transition-all hover:shadow-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting…' : `🚀 ${isEdit ? 'Resubmit' : 'Submit'} / जमा करें`}
          </button>
        </form>
      )}
    </FieldPanelLayout>
  );
};

export default FarmerForm;
