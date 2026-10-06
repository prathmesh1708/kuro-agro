import { useState, useEffect } from 'react';
import { FiSave, FiUser, FiLock, FiShield, FiFileText, FiMapPin, FiUpload, FiDownload, FiClock, FiAlertTriangle } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useVendorAuthStore } from "../../store/vendorAuthStore";
import { uploadVendorImage } from "../../services/vendorService";
import toast from 'react-hot-toast';

const ProfileSettings = () => {
  const { vendor, updateProfile, logout } = useVendorAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [verificationData, setVerificationData] = useState({
    businessType: 'non-gst',
    legalBusinessName: '',
    gstin: '',
    panNumber: '',
    businessAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'India',
    },
    gstCertificateUrl: '',
    panCardDocumentUrl: '',
  });

  const [gstFile, setGstFile] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');

  useEffect(() => {
    if (vendor) {
      setFormData((prev) => ({
        ...prev,
        name: vendor.name || '',
        phone: vendor.phone || '',
      }));
      setVerificationData({
        businessType: vendor.businessType || 'non-gst',
        legalBusinessName: vendor.legalBusinessName || '',
        gstin: vendor.gstin || '',
        panNumber: vendor.panNumber || '',
        businessAddress: vendor.businessAddress || {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'India',
        },
        gstCertificateUrl: vendor.gstCertificate || '',
        panCardDocumentUrl: vendor.panCardDocument || '',
      });
    }
  }, [vendor]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let gstCertificate = verificationData.gstCertificateUrl;
      let panCardDocument = verificationData.panCardDocumentUrl;

      if (gstFile) {
        const gstRes = await uploadVendorImage(gstFile, 'vendors/documents');
        const gstPayload = gstRes?.data ?? gstRes;
        gstCertificate = gstPayload.url || gstPayload;
      }

      if (panFile) {
        const panRes = await uploadVendorImage(panFile, 'vendors/documents');
        const panPayload = panRes?.data ?? panRes;
        panCardDocument = panPayload.url || panPayload;
      }

      const updates = {
        businessType: verificationData.businessType,
        panNumber: verificationData.panNumber,
        panCardDocument,
      };

      if (verificationData.businessType === 'gst') {
        updates.legalBusinessName = verificationData.legalBusinessName;
        updates.gstin = verificationData.gstin;
        updates.gstCertificate = gstCertificate;
        updates.businessAddress = verificationData.businessAddress;
      }

      const res = await updateProfile(updates);
      if (res.success) {
        toast.success('Verification details updated and submitted for review!');
        setGstFile(null);
        setPanFile(null);
        useVendorAuthStore.setState({ vendor: res.vendor });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update verification details.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!vendor) return;

    try {
      await updateProfile({
        name: formData.name,
        phone: formData.phone,
      });
      toast.success('Profile updated successfully');
    } catch {
      // api.js shows toast
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!vendor) return;

    if (!formData.currentPassword) {
      toast.error('Please enter your current password');
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    try {
      // In a real app, this would be an API call to change password
      toast.success('Password changed successfully');
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      toast.error('Failed to change password');
    }
  };

  const sections = [
    { id: 'profile', label: 'Profile Info', icon: FiUser },
    { id: 'verification', label: 'Business Verification', icon: FiShield },
    { id: 'password', label: 'Change Password', icon: FiLock },
    { id: 'security', label: 'Security', icon: FiShield },
  ];

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading vendor information...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-full overflow-x-hidden"
    >
      <div className="lg:hidden">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Profile Settings</h1>
        <p className="text-sm sm:text-base text-gray-600">Manage your profile and account security</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 max-w-full overflow-x-hidden">
        <div className="border-b border-gray-200 overflow-x-hidden">
          <div className="flex overflow-x-auto scrollbar-hide -mx-1 px-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b-2 transition-colors whitespace-nowrap text-xs sm:text-sm ${activeSection === section.id
                    ? 'border-purple-600 text-purple-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                >
                  <Icon className="text-base sm:text-lg" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 sm:p-4 md:p-6">
          {/* Profile Info Section */}
          {activeSection === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold text-sm sm:text-base"
                >
                  <FiSave />
                  Save Profile
                </button>
              </div>
            </form>
          )}

          {/* Business Verification Section */}
          {activeSection === 'verification' && (
            <form onSubmit={handleVerificationSubmit} className="space-y-6">
              {/* Alert Status Banner */}
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                vendor.status === 'approved'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : vendor.status === 'pending'
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : vendor.status === 'action_required'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="mt-0.5">
                  <FiShield className="text-lg" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">
                    Verification Status: <span className="uppercase">{vendor.status || 'pending'}</span>
                  </h4>
                  {vendor.status === 'action_required' && (
                    <p className="text-xs mt-1 font-semibold text-amber-700">
                      Remarks: {vendor.verificationTimeline?.[vendor.verificationTimeline.length - 1]?.remarks || 'See comments below.'}
                    </p>
                  )}
                  {vendor.status === 'rejected' && (
                    <p className="text-xs mt-1 font-semibold text-red-700">
                      Reason: {vendor.suspensionReason || 'Vendor application rejected.'}
                    </p>
                  )}
                  <p className="text-xs mt-1 opacity-90">
                    Note: Changing any GST details or uploading new certificates will automatically change your verification status back to Pending until reviewed by an administrator.
                  </p>
                </div>
              </div>

              {/* Business Type selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Business Verification Type <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <input
                      type="radio"
                      name="businessType"
                      value="non-gst"
                      checked={verificationData.businessType === 'non-gst'}
                      onChange={(e) => setVerificationData({ ...verificationData, businessType: e.target.value })}
                      className="w-4 h-4 text-purple-650 focus:ring-purple-500"
                    />
                    Non-GST Registered
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <input
                      type="radio"
                      name="businessType"
                      value="gst"
                      checked={verificationData.businessType === 'gst'}
                      onChange={(e) => setVerificationData({ ...verificationData, businessType: e.target.value })}
                      className="w-4 h-4 text-purple-650 focus:ring-purple-500"
                    />
                    GST Registered
                  </label>
                </div>
              </div>

              {/* GST Details */}
              {verificationData.businessType === 'gst' && (
                <div className="space-y-4 bg-gray-50/50 p-5 rounded-2xl border border-gray-200/60">
                  <h4 className="font-semibold text-gray-800 text-sm">GST Certification Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Legal Business Name *</label>
                      <input
                        type="text"
                        value={verificationData.legalBusinessName}
                        onChange={(e) => setVerificationData({ ...verificationData, legalBusinessName: e.target.value })}
                        placeholder="Legal Business Name"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-gray-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">GSTIN *</label>
                      <input
                        type="text"
                        value={verificationData.gstin}
                        onChange={(e) => setVerificationData({ ...verificationData, gstin: e.target.value })}
                        placeholder="GSTIN"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-gray-800"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-750 mb-2">
                      GST Certificate File {verificationData.gstCertificateUrl && "(Already uploaded)"}
                    </label>
                    {verificationData.gstCertificateUrl && (
                      <div className="flex gap-2 items-center mb-2">
                        <a
                          href={verificationData.gstCertificateUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-purple-650 hover:text-purple-800 underline flex items-center gap-1">
                          <FiDownload /> View Current GST Certificate
                        </a>
                      </div>
                    )}
                    <input
                      type="file"
                      onChange={(e) => setGstFile(e.target.files?.[0] || null)}
                      accept=".pdf,image/*"
                      className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  <div className="border-t border-gray-200/60 pt-4 space-y-4">
                    <h5 className="font-semibold text-gray-800 text-xs">GST Registered Address</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-705 mb-1">Street Address</label>
                        <input
                          type="text"
                          value={verificationData.businessAddress?.street || ''}
                          onChange={(e) => setVerificationData({
                            ...verificationData,
                            businessAddress: { ...verificationData.businessAddress, street: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-705 mb-1">City</label>
                        <input
                          type="text"
                          value={verificationData.businessAddress?.city || ''}
                          onChange={(e) => setVerificationData({
                            ...verificationData,
                            businessAddress: { ...verificationData.businessAddress, city: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-705 mb-1">State</label>
                        <input
                          type="text"
                          value={verificationData.businessAddress?.state || ''}
                          onChange={(e) => setVerificationData({
                            ...verificationData,
                            businessAddress: { ...verificationData.businessAddress, state: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-705 mb-1">Zip Code</label>
                        <input
                          type="text"
                          value={verificationData.businessAddress?.zipCode || ''}
                          onChange={(e) => setVerificationData({
                            ...verificationData,
                            businessAddress: { ...verificationData.businessAddress, zipCode: e.target.value }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-gray-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PAN Details */}
              <div className="space-y-4 bg-gray-50/50 p-5 rounded-2xl border border-gray-200/60">
                <h4 className="font-semibold text-gray-800 text-sm">PAN Card Details</h4>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">PAN Number *</label>
                  <input
                    type="text"
                    value={verificationData.panNumber}
                    onChange={(e) => setVerificationData({ ...verificationData, panNumber: e.target.value })}
                    placeholder="PAN Number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-gray-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-75 mb-2">
                    PAN Card Document File {verificationData.panCardDocumentUrl && "(Already uploaded)"}
                  </label>
                  {verificationData.panCardDocumentUrl && (
                    <div className="flex gap-2 items-center mb-2">
                      <a
                        href={verificationData.panCardDocumentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-purple-650 hover:text-purple-800 underline flex items-center gap-1">
                        <FiDownload /> View Current PAN Card Document
                      </a>
                    </div>
                  )}
                  <input
                    type="file"
                    onChange={(e) => setPanFile(e.target.files?.[0] || null)}
                    accept=".pdf,image/*"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800"
                  />
                </div>
              </div>

              {/* Submit Actions */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold text-sm sm:text-base disabled:opacity-60"
                >
                  {isUploading ? (
                    <span>Uploading...</span>
                  ) : (
                    <>
                      <FiSave />
                      <span>Submit Verification Details</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Change Password Section */}
          {activeSection === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold text-sm sm:text-base"
                >
                  <FiSave />
                  Change Password
                </button>
              </div>
            </form>
          )}

          {/* Security Section */}
          {activeSection === 'security' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Account Status</h3>
                <div className="space-y-2 text-sm text-blue-700">
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    <span className="font-semibold capitalize">{vendor.status || 'pending'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Verified:</span>
                    <span className="font-semibold">{vendor.isVerified ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Joined:</span>
                    <span className="font-semibold">{new Date(vendor.joinDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="text-sm font-semibold text-yellow-800 mb-2">Security Recommendations</h3>
                <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                  <li>Use a strong, unique password</li>
                  <li>Enable two-factor authentication when available</li>
                  <li>Never share your login credentials</li>
                  <li>Log out from shared devices</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={logout}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-semibold text-sm sm:text-base"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileSettings;

