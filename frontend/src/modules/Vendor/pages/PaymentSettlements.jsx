import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FiCreditCard, 
  FiDollarSign, 
  FiAlertCircle, 
  FiCheckCircle, 
  FiInfo, 
  FiUpload, 
  FiFileText,
  FiCalendar
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { 
  getVendorPayoutSummary, 
  getVendorSettlements, 
  getVendorBankDetails, 
  updateVendorBankDetailsNew,
  uploadVendorImage 
} from '../services/vendorService';
import { formatPrice } from '../../../shared/utils/helpers';
import { useVendorAuthStore } from '../store/vendorAuthStore';

const PaymentSettlements = () => {
  const [activeTab, setActiveTab] = useState('bank');
  const [summary, setSummary] = useState({
    releasedAmount: 0,
    pendingAmount: 0,
    onHoldAmount: 0,
    reason: '',
  });

  // Bank Form State
  const [bankForm, setBankForm] = useState({
    accountName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    bankName: '',
    ifscCode: '',
    branchName: '',
    upiId: '',
    cancelledCheque: '',
    panNumber: '',
    gstNumber: '',
  });
  const [bankStatus, setBankStatus] = useState('not_submitted');
  const [bankRemarks, setBankRemarks] = useState('');
  const [chequeFile, setChequeFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Settlements List State
  const [settlements, setSettlements] = useState([]);
  const [settlementsTotal, setSettlementsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoadingList, setIsLoadingList] = useState(false);

  useEffect(() => {
    fetchSummary();
    fetchBankDetails();
  }, []);

  useEffect(() => {
    fetchSettlements();
  }, [activeTab, page]);

  const fetchSummary = async () => {
    try {
      const res = await getVendorPayoutSummary();
      const payload = res?.data ?? res;
      if (payload) {
        setSummary(payload);
      }
    } catch (err) {
      console.error('Failed to fetch summary', err);
    }
  };

  const fetchBankDetails = async () => {
    try {
      const res = await getVendorBankDetails();
      const payload = res?.data ?? res;
      if (payload) {
        setBankForm({
          accountName: payload.accountName || '',
          accountNumber: payload.accountNumber || '',
          confirmAccountNumber: payload.accountNumber || '',
          bankName: payload.bankName || '',
          ifscCode: payload.ifscCode || '',
          branchName: payload.branchName || '',
          upiId: payload.upiId || '',
          cancelledCheque: payload.cancelledCheque || '',
          panNumber: payload.panNumber || '',
          gstNumber: payload.gstNumber || '',
        });
        setBankStatus(payload.status || 'not_submitted');
        setBankRemarks(payload.remarks || '');
      }
    } catch (err) {
      console.error('Failed to fetch bank details', err);
    }
  };

  const fetchSettlements = async () => {
    if (activeTab === 'bank') return;
    setIsLoadingList(true);
    try {
      let statusParam = 'all';
      if (activeTab === 'pending') statusParam = 'pending';
      if (activeTab === 'released') statusParam = 'released';

      const res = await getVendorSettlements({ status: statusParam, page, limit: 15 });
      const payload = res?.data ?? res;
      if (payload) {
        setSettlements(payload.settlements || []);
        setSettlementsTotal(payload.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch settlements list', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleBankInputChange = (e) => {
    let { name, value } = e.target;
    if (name === 'ifscCode') {
      value = value.toUpperCase().replace(/\s/g, '');
    }
    setBankForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setChequeFile(file);
    }
  };

  const handleBankSubmit = async (e) => {
    e.preventDefault();

    const trimmedAccountName = (bankForm.accountName || '').trim();
    const trimmedAccountNumber = (bankForm.accountNumber || '').trim();
    const trimmedConfirmAccountNumber = (bankForm.confirmAccountNumber || '').trim();
    const trimmedBankName = (bankForm.bankName || '').trim();
    const normalizedIfsc = (bankForm.ifscCode || '').trim().toUpperCase();

    if (!trimmedAccountName || !trimmedAccountNumber || !trimmedConfirmAccountNumber || !trimmedBankName || !normalizedIfsc) {
      return toast.error('Account Name, Account Number, Confirm Account Number, Bank Name, and IFSC Code are required.');
    }

    // Confirm Account Number Match check
    if (trimmedAccountNumber !== trimmedConfirmAccountNumber) {
      return toast.error('Account numbers do not match.');
    }

    // IFSC check
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(normalizedIfsc)) {
      return toast.error('Invalid IFSC Code format (e.g. SBIN0001234)');
    }

    setIsSubmitting(true);
    let chequeUrl = bankForm.cancelledCheque;

    try {
      // Upload file if new one is selected
      if (chequeFile) {
        setIsUploading(true);
        const uploadRes = await uploadVendorImage(chequeFile, 'vendors/bank-details');
        const payload = uploadRes?.data ?? uploadRes;
        chequeUrl = payload.url || payload;
        setIsUploading(false);
      }

      await updateVendorBankDetailsNew({
        ...bankForm,
        accountName: trimmedAccountName,
        accountNumber: trimmedAccountNumber,
        confirmAccountNumber: trimmedConfirmAccountNumber,
        bankName: trimmedBankName,
        ifscCode: normalizedIfsc,
        cancelledCheque: chequeUrl,
      });

      // Sync fresh vendor profile into auth store
      try {
        const { getVendorProfile } = await import('../services/vendorService');
        const profileRes = await getVendorProfile();
        const profile = profileRes?.data ?? profileRes;
        if (profile) {
          useVendorAuthStore.setState({ vendor: profile });
        }
      } catch (e) {
        console.warn('Failed to sync profile after bank submission', e);
      }

      toast.success('Bank details submitted successfully!');
      fetchBankDetails();
      fetchSummary();
    } catch (err) {
      console.error('Failed to save bank details', err);
      toast.error(err?.message || 'Failed to submit bank details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'bank', label: 'Bank Details' },
    { id: 'history', label: 'Settlement History' },
    { id: 'pending', label: 'Pending Settlements' },
    { id: 'released', label: 'Released Settlements' },
  ];

  const getStatusBadge = (status) => {
    const badges = {
      approved: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-blue-100 text-blue-800 border-blue-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      action_required: 'bg-amber-100 text-amber-800 border-amber-200',
      not_submitted: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    const labels = {
      approved: 'Approved & Verified',
      pending: 'Pending Verification',
      rejected: 'Rejected',
      action_required: 'Action Required',
      not_submitted: 'Not Submitted',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badges[status] || badges.not_submitted}`}>
        {labels[status] || labels.not_submitted}
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-full overflow-x-hidden"
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Payment & Settlements</h1>
        <p className="text-sm sm:text-base text-gray-600">Configure bank details and track settlements</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pending Payout */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-blue-100 text-blue-700 p-3 rounded-lg flex-shrink-0">
            <FiInfo className="text-2xl" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Pending Settlement (Ready to Release)</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatPrice(summary.pendingAmount)}</h3>
          </div>
        </div>

        {/* Released Payout */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-green-100 text-green-700 p-3 rounded-lg flex-shrink-0">
            <FiCheckCircle className="text-2xl" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Released Payouts</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatPrice(summary.releasedAmount)}</h3>
          </div>
        </div>

        {/* On Hold Payout */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-orange-100 text-orange-700 p-3 rounded-lg flex-shrink-0">
            <FiAlertCircle className="text-2xl" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">On Hold Amount</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatPrice(summary.onHoldAmount)}</h3>
            {summary.onHoldAmount > 0 && (
              <p className="text-xs text-orange-600 mt-1 font-semibold truncate" title={summary.reason}>
                Reason: {summary.reason}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 overflow-x-auto scrollbar-hide">
          <div className="flex -mx-1 px-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setPage(1); }}
                className={`px-6 py-4 border-b-2 font-semibold text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {/* Bank Details Tab */}
          {activeTab === 'bank' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-gray-150 pb-4">
                <h2 className="text-lg font-bold text-gray-800">Verification Status</h2>
                {getStatusBadge(bankStatus)}
              </div>

              {bankRemarks && (
                <div className="p-4 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-sm font-medium">
                  <strong>Verification Notes:</strong> {bankRemarks}
                </div>
              )}

              <form onSubmit={handleBankSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Account Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Account Holder Name *</label>
                    <input
                      type="text"
                      name="accountName"
                      required
                      value={bankForm.accountName}
                      onChange={handleBankInputChange}
                      disabled={bankStatus === 'approved' || bankStatus === 'pending'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* Bank Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Name *</label>
                    <input
                      type="text"
                      name="bankName"
                      required
                      value={bankForm.bankName}
                      onChange={handleBankInputChange}
                      disabled={bankStatus === 'approved' || bankStatus === 'pending'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* Account Number */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Account Number *</label>
                    <input
                      type="password"
                      name="accountNumber"
                      required
                      value={bankForm.accountNumber}
                      onChange={handleBankInputChange}
                      disabled={bankStatus === 'approved' || bankStatus === 'pending'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* Confirm Account Number */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Account Number *</label>
                    <input
                      type="text"
                      name="confirmAccountNumber"
                      required
                      value={bankForm.confirmAccountNumber}
                      onChange={handleBankInputChange}
                      disabled={bankStatus === 'approved' || bankStatus === 'pending'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* IFSC Code */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">IFSC Code *</label>
                    <input
                      type="text"
                      name="ifscCode"
                      required
                      placeholder="e.g. SBIN0001234"
                      value={bankForm.ifscCode}
                      onChange={handleBankInputChange}
                      disabled={bankStatus === 'approved' || bankStatus === 'pending'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* Branch Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Branch Name (Optional)</label>
                    <input
                      type="text"
                      name="branchName"
                      value={bankForm.branchName}
                      onChange={handleBankInputChange}
                      disabled={bankStatus === 'approved' || bankStatus === 'pending'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* UPI ID */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">UPI ID (Optional)</label>
                    <input
                      type="text"
                      name="upiId"
                      value={bankForm.upiId}
                      onChange={handleBankInputChange}
                      disabled={bankStatus === 'approved' || bankStatus === 'pending'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* PAN Number */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">PAN Number (Optional)</label>
                    <input
                      type="text"
                      name="panNumber"
                      value={bankForm.panNumber}
                      onChange={handleBankInputChange}
                      disabled={bankStatus === 'approved' || bankStatus === 'pending'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-500 uppercase"
                    />
                  </div>

                  {/* GST Number */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">GST Number (Optional)</label>
                    <input
                      type="text"
                      name="gstNumber"
                      value={bankForm.gstNumber}
                      onChange={handleBankInputChange}
                      disabled={bankStatus === 'approved' || bankStatus === 'pending'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-500 uppercase"
                    />
                  </div>

                  {/* Cancelled Cheque Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cancelled Cheque (Optional)</label>
                    {bankForm.cancelledCheque && (
                      <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                        <FiFileText className="text-gray-500 text-lg flex-shrink-0" />
                        <a href={bankForm.cancelledCheque} target="_blank" rel="noreferrer" className="text-xs text-purple-650 hover:underline truncate">
                          View Cancelled Cheque
                        </a>
                      </div>
                    )}
                    {bankStatus !== 'approved' && bankStatus !== 'pending' && (
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <FiUpload className="w-8 h-8 mb-2 text-gray-500" />
                            <p className="text-xs text-gray-500 px-2 text-center">
                              {chequeFile ? `File Selected: ${chequeFile.name}` : 'Click to upload cancelled cheque'}
                            </p>
                          </div>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit button */}
                {bankStatus !== 'approved' && bankStatus !== 'pending' && (
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting || isUploading}
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit details'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Settlements Lists (History, Pending, Released) */}
          {activeTab !== 'bank' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800 capitalize">{activeTab} Settlements</h2>
              
              {isLoadingList ? (
                <div className="text-center py-8 text-gray-500">Loading settlements...</div>
              ) : settlements.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No settlements found in this section.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Settlement ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Commission</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Platform Fee</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shipping Deduction</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Net Payable</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 text-sm">
                      {settlements.map((s) => (
                        <tr key={s._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gray-800">{s._id}</td>
                          <td className="px-4 py-3 text-gray-650 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <FiCalendar className="text-gray-400" />
                              {new Date(s.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-red-600 font-medium">-{formatPrice(s.commission)}</td>
                          <td className="px-4 py-3 text-red-600 font-medium">-{formatPrice(s.platformFee)}</td>
                          <td className="px-4 py-3 text-red-600 font-medium">-{formatPrice(s.shippingDeduction)}</td>
                          <td className="px-4 py-3 text-green-700 font-bold">{formatPrice(s.netPayable)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                              s.status === 'released' || s.status === 'completed'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : s.status === 'on_hold'
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {s.status === 'on_hold' ? `On Hold (${s.reason || 'Pending verification'})` : s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default PaymentSettlements;
