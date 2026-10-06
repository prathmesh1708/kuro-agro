import { useState } from 'react';
import { FiSearch, FiCheck, FiX, FiMessageSquare, FiEye, FiAlertTriangle, FiUserCheck, FiUserX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import DataTable from '../components/DataTable';
import ExportButton from '../components/ExportButton';
import Badge from '../../../shared/components/Badge';
import AnimatedSelect from '../components/AnimatedSelect';
import { formatDateTime } from '../utils/adminHelpers';
import { useReviewsStore } from '../../../shared/store/reviewsStore';
import toast from 'react-hot-toast';

const Reviews = () => {
  const { 
    allReviews, 
    removeReview, 
    restoreReview, 
    blockedUsers, 
    blockUser, 
    unblockUser 
  } = useReviewsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRating, setSelectedRating] = useState('all');
  
  // Modals state
  const [viewingReview, setViewingReview] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'remove'|'block'|'restore'|'unblock', data: any }

  // Filter reviews
  const filteredReviews = allReviews.filter((review) => {
    const matchesSearch = 
      String(review.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(review.user).toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(review.customerEmail).toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(review.productName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(review.comment).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      selectedStatus === 'all' || 
      review.status === selectedStatus;

    const matchesRating = 
      selectedRating === 'all' || 
      String(review.rating) === selectedRating;

    return matchesSearch && matchesStatus && matchesRating;
  });

  // Action Handlers
  const handleOpenConfirm = (type, data) => {
    setConfirmAction({ type, data });
  };

  const handleCloseConfirm = () => {
    setConfirmAction(null);
  };

  const handleExecuteAction = () => {
    if (!confirmAction) return;

    const { type, data } = confirmAction;

    if (type === 'remove') {
      // Future API Call: await api.delete(`/admin/reviews/${data.id}`)
      removeReview(data.id);
      toast.success('Review removed successfully');
    } else if (type === 'restore') {
      // Future API Call: await api.patch(`/admin/reviews/${data.id}/status`, { status: 'active' })
      restoreReview(data.id);
      toast.success('Review restored successfully');
    } else if (type === 'block') {
      // Future API Call: await api.post(`/admin/users/block`, { email: data.customerEmail })
      blockUser(data.user);
      if (data.customerEmail) blockUser(data.customerEmail);
      toast.success(`User ${data.user} has been blocked`);
    } else if (type === 'unblock') {
      // Future API Call: await api.post(`/admin/users/unblock`, { email: data.customerEmail })
      unblockUser(data.user);
      if (data.customerEmail) unblockUser(data.customerEmail);
      toast.success(`User ${data.user} has been unblocked`);
    }

    setConfirmAction(null);
  };

  const columns = [
    {
      key: 'id',
      label: 'Review ID',
      sortable: true,
      render: (value) => <span className="text-[10px] font-mono text-gray-500">{value}</span>
    },
    {
      key: 'productName',
      label: 'Product',
      sortable: true,
      render: (value) => <span className="font-semibold text-gray-700">{value || 'Rathi Product'}</span>
    },
    {
      key: 'user',
      label: 'User Name',
      sortable: true,
      render: (value, row) => (
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-gray-800">{value}</p>
            {(blockedUsers.includes(value) || blockedUsers.includes(row.customerEmail)) && (
              <Badge variant="error" size="sm">Blocked</Badge>
            )}
          </div>
          <p className="text-xs text-gray-500">{row.customerEmail}</p>
        </div>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-0.5 text-yellow-400">
          {[...Array(5)].map((_, i) => (
            <span key={i} className={i < value ? 'text-yellow-400' : 'text-gray-200'}>
              ★
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'comment',
      label: 'Review Text',
      sortable: false,
      render: (value) => <p className="max-w-xs truncate text-sm text-gray-600">{value}</p>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <Badge
          variant={
            value === 'active' || value === 'approved'
              ? 'success'
              : value === 'removed'
                ? 'error'
                : 'warning'
          }
        >
          {value === 'active' || value === 'approved' ? 'Active' : value === 'removed' ? 'Removed' : 'Reported'}
        </Badge>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (value) => <span className="text-xs text-gray-500">{formatDateTime(value)}</span>
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => {
        const isUserBlocked = blockedUsers.includes(row.user) || blockedUsers.includes(row.customerEmail);
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewingReview(row)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="View Review"
            >
              <FiEye size={16} />
            </button>
            {row.status === 'removed' ? (
              <button
                onClick={() => handleOpenConfirm('restore', row)}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Restore Review"
              >
                <FiCheck size={16} />
              </button>
            ) : (
              <button
                onClick={() => handleOpenConfirm('remove', row)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove Review"
              >
                <FiX size={16} />
              </button>
            )}
            {isUserBlocked ? (
              <button
                onClick={() => handleOpenConfirm('unblock', row)}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Unblock User"
              >
                <FiUserCheck size={16} />
              </button>
            ) : (
              <button
                onClick={() => handleOpenConfirm('block', row)}
                className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                title="Block User"
              >
                <FiUserX size={16} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Title block */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Review Management</h1>
          <p className="text-gray-600">Moderate customer reviews and handle user block/unblock requests</p>
        </div>
      </div>

      {/* Filter and search block */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          <div className="relative flex-1 w-full">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, Username, Email, Product, Comment..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <AnimatedSelect
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'reported', label: 'Reported' },
                { value: 'removed', label: 'Removed' },
              ]}
              className="min-w-[130px]"
            />
            <AnimatedSelect
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              options={[
                { value: 'all', label: 'All Ratings' },
                { value: '5', label: '5 Stars' },
                { value: '4', label: '4 Stars' },
                { value: '3', label: '3 Stars' },
                { value: '2', label: '2 Stars' },
                { value: '1', label: '1 Star' },
              ]}
              className="min-w-[130px]"
            />
            <ExportButton
              data={filteredReviews}
              headers={[
                { label: 'Review ID', accessor: (row) => row.id },
                { label: 'Product', accessor: (row) => row.productName },
                { label: 'Customer', accessor: (row) => row.user },
                { label: 'Email', accessor: (row) => row.customerEmail },
                { label: 'Rating', accessor: (row) => row.rating },
                { label: 'Comment', accessor: (row) => row.comment },
                { label: 'Status', accessor: (row) => row.status },
                { label: 'Date', accessor: (row) => row.date },
              ]}
              filename="reviews_moderation_export"
            />
          </div>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <DataTable
          data={filteredReviews}
          columns={columns}
          pagination={true}
          itemsPerPage={10}
        />
      </div>

      {/* View Review Modal */}
      <AnimatePresence>
        {viewingReview && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingReview(null)}
              className="absolute inset-0 bg-black/55 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-lg overflow-hidden relative z-10 shadow-2xl border border-gray-100"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2 text-primary-600">
                  <FiMessageSquare className="text-xl" />
                  <h3 className="font-bold text-gray-800 text-lg">Review Details</h3>
                </div>
                <button 
                  onClick={() => setViewingReview(null)}
                  className="p-1 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FiX size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase">Review ID</p>
                    <p className="font-mono text-sm text-gray-800 mt-0.5">{viewingReview.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase">Status</p>
                    <div className="mt-0.5">
                      <Badge variant={viewingReview.status === 'active' || viewingReview.status === 'approved' ? 'success' : viewingReview.status === 'removed' ? 'error' : 'warning'}>
                        {viewingReview.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Product</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{viewingReview.productName || 'Rathi Product'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase">User Name</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{viewingReview.user}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase">Email</p>
                    <p className="text-sm text-gray-600 mt-0.5">{viewingReview.customerEmail}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase">Rating</p>
                    <div className="flex items-center gap-0.5 text-yellow-400 mt-0.5">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={i < viewingReview.rating ? 'text-yellow-400' : 'text-gray-200'}>
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase">Date Submitted</p>
                    <p className="text-xs text-gray-600 mt-1">{formatDateTime(viewingReview.date)}</p>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Review Comment</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-xl leading-relaxed border border-gray-200">
                    {viewingReview.comment}
                  </p>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={() => setViewingReview(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-semibold"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog Modal */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseConfirm}
              className="absolute inset-0 bg-black/55 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl w-full max-w-md overflow-hidden relative z-10 shadow-2xl p-6 border border-gray-100"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 text-red-600 rounded-full shrink-0">
                  <FiAlertTriangle className="text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">
                    Confirm {confirmAction.type === 'remove' ? 'Remove Review' : confirmAction.type === 'restore' ? 'Restore Review' : confirmAction.type === 'block' ? 'Block User' : 'Unblock User'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Are you sure you want to {confirmAction.type === 'remove' ? 'remove this review from the store catalog' : confirmAction.type === 'restore' ? 'restore this review to active status' : confirmAction.type === 'block' ? `block the account of ${confirmAction.data.user}` : `unblock the account of ${confirmAction.data.user}`}?
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={handleCloseConfirm}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteAction}
                  className={`px-4 py-2 text-white rounded-lg transition-colors text-sm font-semibold shadow-sm ${
                    confirmAction.type === 'remove' || confirmAction.type === 'block'
                      ? 'bg-red-600 hover:bg-red-700 shadow-red-100'
                      : 'bg-green-600 hover:bg-green-700 shadow-green-100'
                  }`}
                >
                  Confirm Action
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Reviews;
