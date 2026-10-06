import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiPhone, FiShoppingBag, FiMapPin, FiFileText, FiAlertTriangle, FiHome } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useVendorAuthStore } from "../store/vendorAuthStore";
import { useCategoryStore } from "../../../shared/store/categoryStore";
import { INDIAN_STATES } from "../../../shared/constants/indianStates";
import toast from 'react-hot-toast';

const VendorRegister = () => {
  const navigate = useNavigate();
  const { register: registerVendor, isLoading } = useVendorAuthStore();
  const { categories: allCategories, initialize: initCategories } = useCategoryStore();

  useEffect(() => {
    initCategories();
  }, [initCategories]);

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    storeName: '',
    storeDescription: '',
    address: {
      building: '',
      street: '',
      city: '',
      state: 'Madhya Pradesh',
      zipCode: '',
      country: 'India',
    },
    businessAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'India',
    },
    categories: [],
    fssaiLicenseNumber: '',
    fssaiLicenseDocument: null,
    businessType: 'non-gst', // 'gst' or 'non-gst'
    legalBusinessName: '',
    gstin: '',
    panNumber: '',
    gstCertificate: null,
    panCardDocument: null,
  });

  const isFoodSelected = () => {
    return formData.categories.some(catId => {
      const catObj = allCategories.find(c => String(c.id || c._id) === String(catId));
      return catObj && (String(catObj.name || '').toLowerCase() === 'food' || String(catObj.slug || '').toLowerCase() === 'food');
    });
  };

  const handleCategoryChange = (catId) => {
    const isChecked = formData.categories.includes(catId);
    const updated = isChecked 
      ? formData.categories.filter(id => id !== catId)
      : [...formData.categories, catId];
    setFormData({
      ...formData,
      categories: updated
    });
  };


  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === 'fssaiLicenseDocument' || name === 'gstCertificate' || name === 'panCardDocument') {
      setFormData({
        ...formData,
        [name]: files?.[0] || null,
      });
      return;
    }

    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setFormData({
        ...formData,
        address: {
          ...formData.address,
          [addressField]: value,
        },
      });
    } else if (name.startsWith('businessAddress.')) {
      const businessAddressField = name.split('.')[1];
      setFormData({
        ...formData,
        businessAddress: {
          ...formData.businessAddress,
          [businessAddressField]: value,
        },
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    const cleanPhone = String(formData.phone || '').replace(/\D/g, '').slice(-10);
    if (!formData.name || !formData.email || cleanPhone.length !== 10 || !formData.storeName) {
      toast.error('Please fill in all required fields and a valid 10-digit phone number');
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.categories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }

    const foodSelected = isFoodSelected();
    if (foodSelected) {
      if (!formData.fssaiLicenseNumber || !formData.fssaiLicenseNumber.trim()) {
        toast.error('FSSAI License Number is required for food category');
        return;
      }
      if (!formData.fssaiLicenseDocument) {
        toast.error('FSSAI License Document file is required for food category');
        return;
      }
    }

    // Business verification validation
    if (!formData.panNumber || !formData.panNumber.trim()) {
      toast.error('PAN Number is required');
      return;
    }
    if (!formData.panCardDocument) {
      toast.error('PAN Card Document file is required');
      return;
    }

    if (formData.businessType === 'gst') {
      if (!formData.gstin || !formData.gstin.trim()) {
        toast.error('GSTIN is required for GST Registered sellers');
        return;
      }
      if (!formData.legalBusinessName || !formData.legalBusinessName.trim()) {
        toast.error('Legal Business Name is required for GST Registered sellers');
        return;
      }
      if (!formData.gstCertificate) {
        toast.error('GST Certificate document is required for GST Registered sellers');
        return;
      }
    }

    try {
      const fd = new FormData();
      fd.append('name', formData.name.trim());
      fd.append('email', formData.email.trim().toLowerCase());
      fd.append('phone', cleanPhone);
      fd.append('password', formData.password);
      fd.append('storeName', formData.storeName.trim());
      fd.append('storeDescription', formData.storeDescription.trim());
      const combinedStreet = formData.address.building
        ? `${formData.address.building.trim()}, ${formData.address.street.trim()}`
        : formData.address.street.trim();

      const normalizedAddress = {
        ...formData.address,
        street: combinedStreet,
        city: formData.address.city.trim(),
        state: formData.address.state?.trim() || 'Madhya Pradesh',
        zipCode: formData.address.zipCode.trim(),
        country: 'India',
      };

      fd.append('address', JSON.stringify(normalizedAddress));
      fd.append('categories', JSON.stringify(formData.categories));
      fd.append('businessType', formData.businessType);
      fd.append('panNumber', formData.panNumber.trim());
      fd.append('panCardDocument', formData.panCardDocument);

      if (foodSelected) {
        fd.append('fssaiLicenseNumber', formData.fssaiLicenseNumber.trim());
        fd.append('fssaiLicenseDocument', formData.fssaiLicenseDocument);
      }

      if (formData.businessType === 'gst') {
        fd.append('legalBusinessName', formData.legalBusinessName.trim());
        fd.append('gstin', formData.gstin.trim());
        fd.append('gstCertificate', formData.gstCertificate);
        fd.append('businessAddress', JSON.stringify(formData.businessAddress));
      }

      const result = await registerVendor(fd);

      toast.success(result.message || 'Registration submitted! OTP sent to your phone.');
      // Navigate to verification page with phone and email
      navigate('/vendor/verification', { state: { phone: cleanPhone, email: formData.email } });
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 flex items-center justify-center p-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 gradient-green rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-green">
            <FiShoppingBag className="text-white text-2xl" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Become a Vendor</h1>
          <p className="text-gray-600">Register your store, verify your phone via SMS OTP, then await admin approval</p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal & Account Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal & Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="vendor@example.com"
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number (for SMS OTP) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold text-sm flex items-center gap-1">
                    <FiPhone className="text-gray-400" />
                    +91
                  </span>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full pl-20 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Set Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="At least 6 characters"
                    className="w-full pl-12 pr-12 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter your password"
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Store Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Store Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Store Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiShoppingBag className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="storeName"
                    value={formData.storeName}
                    onChange={handleChange}
                    placeholder="My Awesome Store"
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Store Description
                </label>
                <textarea
                  name="storeDescription"
                  value={formData.storeDescription}
                  onChange={handleChange}
                  placeholder="Describe your store and products..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Business Verification Details */}
          <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-200/60 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Business Verification</h3>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Business Type <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <input
                    type="radio"
                    name="businessType"
                    value="non-gst"
                    checked={formData.businessType === 'non-gst'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  Non-GST Registered
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <input
                    type="radio"
                    name="businessType"
                    value="gst"
                    checked={formData.businessType === 'gst'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  GST Registered
                </label>
              </div>
            </div>

            {formData.businessType === 'gst' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-750 mb-2">
                      Legal Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="legalBusinessName"
                      value={formData.legalBusinessName}
                      onChange={handleChange}
                      placeholder="As per GST certificate"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-750 mb-2">
                      GSTIN <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="gstin"
                      value={formData.gstin}
                      onChange={handleChange}
                      placeholder="e.g. 22AAAAA1111A1Z1"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400 text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-750 mb-2">
                    Upload GST Certificate <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    name="gstCertificate"
                    onChange={handleChange}
                    accept=".pdf,image/*"
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-1 file:text-sm file:text-primary-700 text-sm"
                    required
                  />
                </div>

                <div className="border-t border-gray-200/60 pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">GST Business Address</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Street / Road Address</label>
                      <input
                        type="text"
                        name="businessAddress.street"
                        value={formData.businessAddress.street}
                        onChange={handleChange}
                        placeholder="GST registered street / office address"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                      <input
                        type="text"
                        name="businessAddress.city"
                        value={formData.businessAddress.city}
                        onChange={handleChange}
                        placeholder="e.g. Indore"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">State</label>
                      <select
                        name="businessAddress.state"
                        value={formData.businessAddress.state || 'Madhya Pradesh'}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 text-sm font-medium">
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Pincode (6 digits)</label>
                      <input
                        type="text"
                        name="businessAddress.zipCode"
                        maxLength={6}
                        value={formData.businessAddress.zipCode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setFormData((prev) => ({
                            ...prev,
                            businessAddress: { ...prev.businessAddress, zipCode: val },
                          }));
                        }}
                        placeholder="e.g. 452001"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
                      <input
                        type="text"
                        name="businessAddress.country"
                        value="India"
                        disabled
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 text-sm cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200/60 pt-4">
              <div>
                <label className="block text-sm font-semibold text-gray-75 mb-2">
                  PAN Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="panNumber"
                  value={formData.panNumber}
                  onChange={handleChange}
                  placeholder="e.g. ABCDE1234F"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-75 mb-2">
                  Upload PAN Card <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  name="panCardDocument"
                  onChange={handleChange}
                  accept=".pdf,image/*"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-1 file:text-sm file:text-primary-700 text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Product Categories Selection */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Product Categories</h3>
              <p className="text-xs text-gray-500 mb-4">Select categories of products you plan to sell. You can select multiple.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-gray-200">
                {allCategories && allCategories.map((cat) => {
                  const catId = cat.id || cat._id;
                  const isChecked = formData.categories.includes(catId);
                  return (
                    <label key={catId} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCategoryChange(catId)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Conditional FSSAI Fields */}
            {isFoodSelected() && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-yellow-50/50 border border-yellow-200 rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-start gap-2 text-yellow-800">
                  <FiAlertTriangle className="text-yellow-600 text-lg mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm">FSSAI License Requirement</h4>
                    <p className="text-xs text-yellow-700 mt-0.5">
                      Since you selected the Food category, you must provide your FSSAI License details to register.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-750 mb-2">
                    FSSAI License Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FiFileText className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      name="fssaiLicenseNumber"
                      value={formData.fssaiLicenseNumber}
                      onChange={handleChange}
                      placeholder="Enter 14-digit FSSAI License Number"
                      className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-250 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400 text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-750 mb-2">
                    Upload FSSAI License Document <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      name="fssaiLicenseDocument"
                      onChange={handleChange}
                      accept=".pdf,image/*"
                      className="w-full px-4 py-2.5 bg-white border-2 border-gray-250 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-1 file:text-sm file:text-primary-700 text-sm"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Address Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Business / Pickup Warehouse Address</h3>
            <p className="text-xs text-gray-500 mb-4">This address will be used by couriers for parcel pickups.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Shop / Building / Flat No. & Floor <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiHome className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="address.building"
                    value={formData.address.building || ''}
                    onChange={handleChange}
                    placeholder="e.g. Shop 12, Ground Floor"
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Road / Street / Area / Landmark <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiMapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="address.street"
                    value={formData.address.street}
                    onChange={handleChange}
                    placeholder="e.g. Palasia Main Road, Near Old Bus Stand"
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="address.city"
                  value={formData.address.city}
                  onChange={handleChange}
                  placeholder="e.g. Indore"
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  State <span className="text-red-500">*</span>
                </label>
                <select
                  name="address.state"
                  value={formData.address.state || 'Madhya Pradesh'}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 text-sm font-medium">
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pincode (6 digits) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="address.zipCode"
                  maxLength={6}
                  value={formData.address.zipCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setFormData((prev) => ({
                      ...prev,
                      address: { ...prev.address, zipCode: val },
                    }));
                  }}
                  placeholder="e.g. 452001"
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 text-gray-800 placeholder:text-gray-400 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
                <input
                  type="text"
                  name="address.country"
                  value="India"
                  disabled
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-600 text-sm cursor-not-allowed"
                />
              </div>
            </div>
          </div>



          {/* Info Message */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You must verify your mobile number via SMS OTP first, then your seller registration will be reviewed by admin.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full gradient-green text-white py-3 rounded-xl font-semibold hover:shadow-glow-green transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Registering...' : 'Register as Vendor'}
          </button>

          {/* Login Link */}
          <div className="text-center pt-4">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                to="/vendor/login"
                className="text-primary-600 hover:text-primary-700 font-semibold"
              >
                Login
              </Link>
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default VendorRegister;

