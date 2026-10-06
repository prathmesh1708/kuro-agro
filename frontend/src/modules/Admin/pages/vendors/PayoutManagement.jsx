import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiSearch, 
  FiCheckCircle, 
  FiXCircle, 
  FiAlertCircle, 
  FiCreditCard, 
  FiDollarSign, 
  FiCalendar,
  FiFilter,
  FiUserCheck,
  FiFileText,
  FiList
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { 
  getVendorsPayoutList, 
  updateVendorBankStatus, 
  getSettlementsList, 
  updateSettlementStatus 
} from '../../services/adminService';
import { formatPrice } from '../../../../shared/utils/helpers';

const PayoutManagement = () => {
  const [activeTab, setActiveTab] = useState('sellers');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sellers Tab States
  const [sellers, setSellers] = useState([]);
  const [loadingSellers, setLoadingSellers] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyRemarks, setVerifyRemarks] = useState('');

  // Settlements Tab States
  const [settlements, setSettlements] = useState([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);
  const [settlementFilter, setSettlementFilter] = useState('all');
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');

  useEffect(() => {
    if (activeTab === 'sellers') {
      fetchSellers();
    } else {
      fetchSettlements();
    }
  }, [activeTab, settlementFilter]);

  const fetchSellers = async () => {
    setLoadingSellers(true);
    try {
      const res = await getVendorsPayoutList();
      const payload = res?.data ?? res;
      setSellers(payload || []);
    } catch (err) {
      console.error('Failed to fetch sellers payout summary', err);
    } finally {
      setLoadingSellers(false);
    }
  };

  const fetchSettlements = async () => {
    setLoadingSettlements(true);
    try {
      const res = await getSettlementsList({ status: settlementFilter });
      const payload = res?.data ?? res;
      setSettlements(payload?.settlements || []);
    } catch (err) {
      console.error('Failed to fetch settlements list', err);
    } finally {
      setLoadingSettlements(false);
    }
  };

  const handleUpdateBankStatus = async (status) => {
    if (!selectedSeller) return;
    try {
      await updateVendorBankStatus(selectedSeller.id, status, verifyRemarks);
      toast.success(`Seller bank status updated to ${status}`);
      setShowVerifyModal(false);
      setSelectedSeller(null);
      setVerifyRemarks('');
      fetchSellers();
    } catch (err) {
      toast.error(err?.message || 'Failed to update status');
    }
  };

  const handleReleaseSettlement = async (e) => {
    e.preventDefault();
    if (!selectedSettlement) return;
    if (!transactionId.trim()) {
      return toast.error('Transaction ID is required to release settlement.');
    }
    try {
      await updateSettlementStatus(selectedSettlement._id, 'release', transactionId, releaseNotes);
      toast.success('Settlement released successfully!');
      setShowReleaseModal(false);
      setSelectedSettlement(null);
      setTransactionId('');
      setReleaseNotes('');
      fetchSettlements();
    } catch (err) {
      toast.error(err?.message || 'Failed to release settlement');
    }
  };

  const handleHoldSettlement = async (settlementId) => {
    const notes = prompt('Enter reason for placing this settlement on hold:');
    if (notes === null) return; // cancelled
    try {
      await updateSettlementStatus(settlementId, 'hold', '', notes);
      toast.success('Settlement placed on hold.');
      fetchSettlements();
    } catch (err) {
      toast.error(err?.message || 'Failed to update settlement status');
    }
  };

  const filteredSellers = sellers.filter(seller => 
    seller.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    seller.storeName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const badges = {
      approved: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      action_required: 'bg-amber-100 text-amber-800 border-amber-200',
      not_submitted: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    const labels = {
      approved: 'Approved',
      pending: 'Pending Verification',
      rejected: 'Rejected',
      action_required: 'Action Required',
      not_submitted: 'Not Submitted',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${badges[status] || badges.not_submitted}`}>
        {labels[status] || labels.not_submitted}
      </span>
    );
  };

  const getSettlementBadge = (status) => {
    const badges = {
      released: 'bg-green-100 text-green-800 border-green-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-blue-100 text-blue-800 border-blue-200',
      on_hold: 'bg-orange-100 text-orange-850 border-orange-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${badges[status] || badges.pending}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden p-1">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-850">Payouts & Settlements</h1>
          <p className="text-sm text-gray-500 mt-1">Manage vendor payouts, verify bank details, and release funds.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('sellers')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-semibold text-sm transition-colors ${
            activeTab === 'sellers'
              ? 'border-purple-650 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiUserCheck className="text-lg" />
          Sellers Payout & Bank Verification
        </button>
        <button
          onClick={() => setActiveTab('settlements')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-semibold text-sm transition-colors ${
            activeTab === 'settlements'
              ? 'border-purple-650 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiList className="text-lg" />
          Settlements & Release Control
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {activeTab === 'sellers' ? (
          /* SELLERS TAB */
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:max-w-xs">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-450 text-base" />
                <input
                  type="text"
                  placeholder="Search sellers..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {loadingSellers ? (
              <div className="text-center py-12 text-gray-500">Loading sellers...</div>
            ) : filteredSellers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No sellers found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Seller / Shop</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bank Details Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">On Hold</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Release</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Released</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 text-sm">
                    {filteredSellers.map((seller) => (
                      <tr key={seller.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-800">{seller.name}</div>
                          <div className="text-xs text-gray-500">{seller.storeName}</div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(seller.bankStatus)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-orange-600">
                          {formatPrice(seller.onHoldAmount)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-blue-600">
                          {formatPrice(seller.pendingAmount)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-green-700">
                          {formatPrice(seller.releasedAmount)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedSeller(seller);
                              setVerifyRemarks(seller.bankDetails?.remarks || '');
                              setShowVerifyModal(true);
                            }}
                            className="text-xs font-bold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Verify & Update
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* SETTLEMENTS TAB */
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Filter Tabs */}
              <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                {['all', 'pending', 'released', 'on_hold', 'failed', 'cancelled'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSettlementFilter(tab)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                      settlementFilter === tab 
                        ? 'bg-white text-gray-850 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'on_hold' ? 'On Hold' : tab}
                  </button>
                ))}
              </div>
            </div>

            {loadingSettlements ? (
              <div className="text-center py-12 text-gray-500">Loading settlements...</div>
            ) : settlements.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No settlements found in this section.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Settlement ID</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Seller</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Payable</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 text-sm">
                    {settlements.map((s) => (
                      <tr key={s._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-gray-800">{s._id}</td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-800">{s.vendorId?.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{s.vendorId?.storeName || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          <span className="flex items-center gap-1">
                            <FiCalendar />
                            {new Date(s.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">
                          {formatPrice(s.netPayable)}
                        </td>
                        <td className="px-6 py-4">
                          {getSettlementBadge(s.status)}
                          {s.status === 'on_hold' && s.reason && (
                            <div className="text-[10px] text-orange-600 mt-1 max-w-[150px] truncate" title={s.reason}>
                              Reason: {s.reason}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {(s.status === 'pending' || s.status === 'on_hold') && (
                            <button
                              onClick={() => {
                                setSelectedSettlement(s);
                                setTransactionId('');
                                setReleaseNotes('');
                                setShowReleaseModal(true);
                              }}
                              className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Release Payout
                            </button>
                          )}
                          {s.status === 'pending' && (
                            <button
                              onClick={() => handleHoldSettlement(s._id)}
                              className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Put on Hold
                            </button>
                          )}
                          {(s.status === 'released' || s.status === 'completed') && (
                            <span className="text-xs text-gray-400 font-medium">Released: {s.transactionId || 'N/A'}</span>
                          )}
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

      {/* Verify Bank Details Modal */}
      <AnimatePresence>
        {showVerifyModal && selectedSeller && (
          <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-gray-150 flex justify-between items-center bg-gray-50">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">Verify Seller Bank Details</h3>
                  <p className="text-xs text-gray-500">Review payout details for {selectedSeller.name}</p>
                </div>
                <button 
                  onClick={() => setShowVerifyModal(false)}
                  className="text-gray-400 hover:text-gray-650 text-xl font-bold"
                >
                  &times;
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {selectedSeller.bankStatus === 'not_submitted' ? (
                  <div className="p-4 bg-gray-50 text-gray-500 rounded-xl text-center font-medium">
                    This seller has not submitted any bank details yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="block text-xs font-semibold text-gray-400">Account Holder Name</span>
                        <span className="font-medium text-gray-800">{selectedSeller.bankDetails.accountName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-gray-400">Bank Name</span>
                        <span className="font-medium text-gray-800">{selectedSeller.bankDetails.bankName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-gray-400">Account Number</span>
                        <span className="font-medium font-mono text-gray-800">{selectedSeller.bankDetails.accountNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-gray-400">IFSC Code</span>
                        <span className="font-medium font-mono text-gray-800 uppercase">{selectedSeller.bankDetails.ifscCode || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-gray-400">Branch Name</span>
                        <span className="font-medium text-gray-800">{selectedSeller.bankDetails.branchName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-gray-400">UPI ID</span>
                        <span className="font-medium text-gray-800">{selectedSeller.bankDetails.upiId || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-gray-400">PAN Number</span>
                        <span className="font-medium uppercase text-gray-800">{selectedSeller.bankDetails.panNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-gray-400">GST Number</span>
                        <span className="font-medium uppercase text-gray-800">{selectedSeller.bankDetails.gstNumber || 'N/A'}</span>
                      </div>
                    </div>

                    {selectedSeller.bankDetails.cancelledCheque && (
                      <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                          <FiFileText className="text-gray-400" /> Cancelled Cheque Document
                        </span>
                        <a 
                          href={selectedSeller.bankDetails.cancelledCheque} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-xs font-bold text-purple-650 hover:underline"
                        >
                          View Cheque
                        </a>
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <label className="block text-xs font-semibold text-gray-500">Remarks / Feedback (Required for Rejection or Changes)</label>
                      <textarea
                        value={verifyRemarks}
                        onChange={e => setVerifyRemarks(e.target.value)}
                        placeholder="Add remarks or explanation here..."
                        rows="3"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {selectedSeller.bankStatus !== 'not_submitted' && (
                <div className="p-4 bg-gray-50 border-t border-gray-150 flex flex-wrap gap-2 justify-end">
                  <button
                    onClick={() => handleUpdateBankStatus('action_required')}
                    className="px-4 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                  >
                    Request Changes
                  </button>
                  <button
                    onClick={() => handleUpdateBankStatus('rejected')}
                    className="px-4 py-2 text-xs font-bold text-red-750 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    Reject Details
                  </button>
                  <button
                    onClick={() => handleUpdateBankStatus('approved')}
                    className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                  >
                    Approve Details
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Release Settlement Payout Modal */}
      <AnimatePresence>
        {showReleaseModal && selectedSettlement && (
          <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-gray-150 flex justify-between items-center bg-gray-50">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">Release Settlement Payment</h3>
                  <p className="text-xs text-gray-500">Record payout release detail</p>
                </div>
                <button 
                  onClick={() => setShowReleaseModal(false)}
                  className="text-gray-400 hover:text-gray-655 text-xl font-bold"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleReleaseSettlement}>
                <div className="p-5 space-y-4">
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-purple-900 text-sm">
                    <div className="flex justify-between">
                      <span>Shop Name:</span>
                      <strong className="text-purple-950">{selectedSettlement.vendorId?.storeName || 'N/A'}</strong>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span>Net Payable Amount:</span>
                      <strong className="text-purple-950">{formatPrice(selectedSettlement.netPayable)}</strong>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-655">Transaction ID / Reference Number *</label>
                    <input
                      type="text"
                      required
                      value={transactionId}
                      onChange={e => setTransactionId(e.target.value)}
                      placeholder="e.g. TXN982348234"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-655">Internal Notes (Optional)</label>
                    <textarea
                      value={releaseNotes}
                      onChange={e => setReleaseNotes(e.target.value)}
                      placeholder="Add settlement transaction notes..."
                      rows="2"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-150 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReleaseModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-655 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    Confirm Release
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PayoutManagement;
