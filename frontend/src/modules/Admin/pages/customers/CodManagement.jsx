import { useState, useEffect } from "react";
import { 
  FiSearch, FiAlertTriangle, FiSlash, FiCheckCircle, 
  FiActivity, FiUser, FiInfo, FiX 
} from "react-icons/fi";
import { 
  getCodUsers, 
  getUserCodTimeline, 
  issueUserWarning, 
  toggleUserBlacklist 
} from "../../services/adminService";
import toast from "react-hot-toast";

export default function CodManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Selected user detail states
  const [selectedUser, setSelectedUser] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  
  // Action modal states
  const [actionUser, setActionUser] = useState(null);
  const [actionType, setActionType] = useState(""); // "warn" or "blacklist" or "whitelist"
  const [actionReason, setActionReason] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await getCodUsers({ search, status, page, limit: 10 });
      const data = response?.data?.data || response?.data || response;
      setUsers(data.users || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load COD stats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [status, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleOpenTimeline = async (userObj) => {
    setSelectedUser(userObj);
    setTimelineLoading(true);
    setShowTimelineModal(true);
    try {
      const userId = userObj.userId?._id || userObj.userId;
      const response = await getUserCodTimeline(userId);
      const data = response?.data?.data || response?.data || response;
      setTimeline(data.timeline || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch timeline.");
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleOpenAction = (userObj, type) => {
    setActionUser(userObj);
    setActionType(type);
    setActionReason("");
    setActionSubmitting(false);
  };

  const handleSubmitAction = async (e) => {
    e.preventDefault();
    if (!actionReason.trim()) {
      toast.error("Please provide a reason.");
      return;
    }
    
    setActionSubmitting(true);
    const userId = actionUser.userId?._id || actionUser.userId;
    try {
      if (actionType === "warn") {
        await issueUserWarning(userId, actionReason);
        toast.success("Warning issued successfully.");
      } else if (actionType === "blacklist") {
        await toggleUserBlacklist(userId, true, actionReason);
        toast.success("User blacklisted from COD.");
      } else if (actionType === "whitelist") {
        await toggleUserBlacklist(userId, false, actionReason);
        toast.success("User removed from COD blacklist.");
      }
      
      setActionUser(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error("Failed to perform action.");
    } finally {
      setActionSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">COD Abuse & Blacklist Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor cancellation percentages, issue warnings, and restrict COD payment privileges.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center border border-gray-300 rounded-xl px-3 py-2 w-full md:max-w-md bg-gray-50">
          <FiSearch className="text-gray-400 mr-2 text-lg" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            className="bg-transparent border-none outline-none text-sm w-full focus:ring-0 text-gray-800"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="hidden" />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Filter Status:</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-full md:w-auto"
          >
            <option value="">All Customers</option>
            <option value="warned">Warned</option>
            <option value="blacklisted">Blacklisted</option>
            <option value="high_risk">High Risk (cancellation &gt; 40%)</option>
          </select>
        </div>
      </div>

      {/* Main Customers List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12">
            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 text-sm mt-3">Loading statistics...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FiInfo className="text-gray-400 text-4xl mb-3" />
            <p className="text-gray-600 font-medium">No customers match the criteria.</p>
            <p className="text-gray-400 text-sm">Try modifying your filters or search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Total COD Orders</th>
                  <th className="px-6 py-4">Delivered</th>
                  <th className="px-6 py-4">Cancelled</th>
                  <th className="px-6 py-4">Cancellation %</th>
                  <th className="px-6 py-4">Warnings</th>
                  <th className="px-6 py-4">COD Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {users.map((item) => {
                  const userDetail = item.userId || {};
                  const isHighRisk = item.totalCodOrders >= 3 && item.cancellationRate >= 40;
                  
                  return (
                    <tr key={item._id || userDetail._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold uppercase">
                            {userDetail.name ? userDetail.name[0] : "?"}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{userDetail.name || "Guest"}</p>
                            <p className="text-xs text-gray-400">{userDetail.email || "No email"}</p>
                            <p className="text-xs text-gray-400">{userDetail.phone || "No phone"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold">{item.totalCodOrders || 0}</td>
                      <td className="px-6 py-4 text-green-600 font-medium">{item.deliveredCodOrders || 0}</td>
                      <td className="px-6 py-4 text-red-600 font-medium">{item.cancelledCodOrders || 0}</td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${isHighRisk ? 'text-red-600' : item.cancellationRate > 20 ? 'text-yellow-600' : 'text-gray-800'}`}>
                          {item.cancellationRate || 0}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.warningCount > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                          {item.warningCount || 0} Warned
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {item.isCodBlacklisted ? (
                          <span className="flex items-center gap-1 text-red-600 font-semibold text-xs bg-red-50 px-2 py-1 rounded-lg w-max border border-red-200">
                            <FiSlash className="text-sm" /> Restricted
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600 font-semibold text-xs bg-green-50 px-2 py-1 rounded-lg w-max border border-green-200">
                            <FiCheckCircle className="text-sm" /> Allowed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenTimeline(item)}
                            title="View Timeline & Logs"
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                          >
                            <FiActivity className="text-lg" />
                          </button>
                          
                          <button
                            onClick={() => handleOpenAction(item, "warn")}
                            title="Issue Warning"
                            className="px-3 py-1.5 text-xs font-bold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-xl transition-colors border border-yellow-200"
                          >
                            Warn
                          </button>

                          {item.isCodBlacklisted ? (
                            <button
                              onClick={() => handleOpenAction(item, "whitelist")}
                              className="px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 rounded-xl transition-colors border border-green-200"
                            >
                              Allow COD
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenAction(item, "blacklist")}
                              className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-200"
                            >
                              Block COD
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 bg-gray-50">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Timeline Modal */}
      {showTimelineModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800">COD History & Audit Timeline</h3>
                <p className="text-xs text-gray-500 mt-1">Showing all history for {selectedUser?.userId?.name || "Customer"}</p>
              </div>
              <button onClick={() => setShowTimelineModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <FiX className="text-xl" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {timelineLoading ? (
                <div className="flex flex-col items-center justify-center p-12">
                  <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-500 text-xs mt-3">Fetching logs...</p>
                </div>
              ) : timeline.length === 0 ? (
                <div className="text-center p-12 text-gray-500 text-sm">
                  <FiActivity className="text-4xl mx-auto mb-2 text-gray-300" />
                  No timeline events recorded yet.
                </div>
              ) : (
                <div className="relative border-l-2 border-gray-200 ml-4 pl-6 space-y-8">
                  {timeline.map((item, idx) => {
                    let iconBg = "bg-gray-100 text-gray-600";
                    let title = "";
                    let detail = "";
                    
                    if (item.type === "order") {
                      const isCancelled = item.data.status === "cancelled";
                      iconBg = isCancelled ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600";
                      title = `COD Order: ${item.data.orderId} - ${item.data.status.toUpperCase()}`;
                      detail = isCancelled 
                        ? `Reason: ${item.data.cancellationReason || "No reason given"}`
                        : `Total: Rs.${item.data.total}`;
                    } else if (item.type === "warning") {
                      iconBg = "bg-yellow-100 text-yellow-600";
                      title = "Warning Issued";
                      detail = `Reason: ${item.data.reason} (Issued by: ${item.data.issuedBy})`;
                    } else if (item.type === "blacklist_event") {
                      const isBlock = item.data.action === "blacklisted";
                      iconBg = isBlock ? "bg-red-200 text-red-700 font-bold" : "bg-green-200 text-green-700 font-bold";
                      title = isBlock ? "COD Access Restricted" : "COD Access Restored";
                      detail = `Reason: ${item.data.reason} (Action by: ${item.data.adminName})`;
                    }
                    
                    return (
                      <div key={idx} className="relative">
                        <span className={`absolute -left-[35px] top-0 w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shadow-sm`}>
                          <FiUser className="text-xs" />
                        </span>
                        <div>
                          <span className="text-xs text-gray-400 font-medium">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                          <h4 className="font-semibold text-gray-800 text-sm mt-0.5">{title}</h4>
                          <p className="text-xs text-gray-500 mt-1">{detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button 
                onClick={() => setShowTimelineModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Dialog Form Modal */}
      {actionUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitAction} className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 capitalize">
                {actionType === "warn" ? "Issue Warning" : actionType === "blacklist" ? "Restrict COD Access" : "Restore COD Access"}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Applying administrative action on {actionUser?.userId?.name || "Customer"}.
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Provide Reason / Comments:</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain why this action is being taken..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActionUser(null)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionSubmitting}
                className={`px-4 py-2 text-white rounded-xl text-sm font-semibold transition-colors ${
                  actionType === "warn" 
                    ? "bg-yellow-600 hover:bg-yellow-700" 
                    : actionType === "blacklist" 
                      ? "bg-red-600 hover:bg-red-700" 
                      : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {actionSubmitting ? "Submitting..." : "Submit Action"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
