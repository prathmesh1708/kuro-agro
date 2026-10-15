import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import StatsCards from "../components/Analytics/StatsCards";
import RevenueLineChart from "../components/Analytics/RevenueLineChart";
import SalesBarChart from "../components/Analytics/SalesBarChart";
import OrderStatusPieChart from "../components/Analytics/OrderStatusPieChart";
import CustomerGrowthAreaChart from "../components/Analytics/CustomerGrowthAreaChart";
import RevenueVsOrdersChart from "../components/Analytics/RevenueVsOrdersChart";
import TopProducts from "../components/Analytics/TopProducts";
import RecentOrders from "../components/Analytics/RecentOrders";
import TimePeriodFilter, { DASHBOARD_PERIODS } from "../components/Analytics/TimePeriodFilter";
import ExportButton from "../components/ExportButton";
import { formatCurrency } from "../utils/adminHelpers";
import {
  getDashboardStats,
  getRevenueData,
  getOrderStatusBreakdown,
  getTopProducts,
  getCustomerGrowth,
  getRecentOrders,
} from "../services/adminService";
import { useReviewsStore } from "../../../shared/store/reviewsStore";
import { FiMessageSquare, FiStar, FiTrash2, FiAlertTriangle, FiUserX } from "react-icons/fi";

const EMPTY_STATS = {
  totalRevenue: 0,
  totalOrders: 0,
  totalProducts: 0,
  totalCustomers: 0,
  totalVendors: 0,
  pendingOrders: 0,
};

// Card titles and the comparison shown under the % change, per period.
const PERIOD_META = {
  today: { label: "Today", compare: "vs same time yesterday" },
  yesterday: { label: "Yesterday", compare: "vs the day before" },
  week: { label: "This Week", compare: "vs same days last week" },
  month: { label: "This Month", compare: "vs same days last month" },
  year: { label: "This Year", compare: "vs same period last year" },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { allReviews, blockedUsers } = useReviewsStore();
  const [period, setPeriod] = useState("today");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState(EMPTY_STATS);
  const [revenueData, setRevenueData] = useState([]);
  const [orderStatusData, setOrderStatusData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [customerGrowth, setCustomerGrowth] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  // Every card, chart and list below follows the selected period; the server works out its dates in IST.
  const fetchDashboardData = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = { range: period };
      const [
        statsRes,
        revenueRes,
        orderStatusRes,
        topProductsRes,
        customerGrowthRes,
        recentOrdersRes,
      ] = await Promise.allSettled([
        getDashboardStats(params),
        getRevenueData(undefined, params),
        getOrderStatusBreakdown(params),
        getTopProducts(params),
        getCustomerGrowth(undefined, params),
        getRecentOrders(params),
      ]);

      const valueOf = (result, fallback) => (result.status === "fulfilled" ? result.value.data || fallback : fallback);
      const d = valueOf(statsRes, {});
      setStats({
        totalRevenue: d.totalRevenue || 0,
        totalOrders: d.totalOrders || 0,
        totalProducts: d.totalProducts || 0,
        totalCustomers: d.newCustomers || 0,
        totalVendors: d.totalVendors || 0,
        pendingOrders: d.pendingOrders || 0,
        revenueChange: d.revenueChange ?? undefined,
        ordersChange: d.ordersChange ?? undefined,
        customersChange: d.customersChange ?? undefined,
      });
      setRevenueData(valueOf(revenueRes, []));
      setOrderStatusData(valueOf(orderStatusRes, []));
      setTopProducts(valueOf(topProductsRes, []));
      setCustomerGrowth(valueOf(customerGrowthRes, []));
      setRecentOrders(valueOf(recentOrdersRes, []));
    } catch (error) {
      // Don't toast here as api.js interceptor handled global errors
      // or to avoid 6+ toasts if all parallel requests fail simultaneously
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Full-page spinner only on first load; switching period keeps the page and dims it while loading.
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const meta = PERIOD_META[period];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="lg:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Welcome back! Here's your business overview.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full">
          <TimePeriodFilter selectedPeriod={period} onPeriodChange={setPeriod} periods={DASHBOARD_PERIODS} />
          <ExportButton
            data={revenueData}
            headers={[
              { label: meta.label, accessor: (row) => row.label },
              { label: "Revenue", accessor: (row) => formatCurrency(row.revenue) },
              { label: "Orders", accessor: (row) => row.orders },
            ]}
            filename={`revenue_${period}`}
          />
        </div>
      </div>

      <div className={`space-y-6 transition-opacity ${refreshing ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Stats Cards */}
      <StatsCards
        stats={stats}
        changeHint={meta.compare}
        titles={{
          revenue: `Revenue · ${meta.label}`,
          orders: `Orders · ${meta.label}`,
          products: "Active Products",
          customers: `New Customers · ${meta.label}`,
        }}
      />

      {/* Review Moderation Overview */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-800">Reviews & Moderation Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          {/* Card 1: Total Reviews */}
          <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-blue-50 text-blue-600 p-2.5 rounded-lg">
                <FiMessageSquare size={18} />
              </div>
            </div>
            <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Reviews</h3>
            <p className="text-gray-800 text-2xl font-bold mt-1">{allReviews.length}</p>
          </div>

          {/* Card 2: Active Reviews */}
          <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-green-50 text-green-600 p-2.5 rounded-lg">
                <FiStar size={18} />
              </div>
            </div>
            <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Active Reviews</h3>
            <p className="text-gray-800 text-2xl font-bold mt-1">
              {allReviews.filter(r => r.status === 'active' || r.status === 'approved').length}
            </p>
          </div>

          {/* Card 3: Removed Reviews */}
          <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-red-50 text-red-600 p-2.5 rounded-lg">
                <FiTrash2 size={18} />
              </div>
            </div>
            <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Removed Reviews</h3>
            <p className="text-gray-800 text-2xl font-bold mt-1">
              {allReviews.filter(r => r.status === 'removed').length}
            </p>
          </div>

          {/* Card 4: Reported Reviews */}
          <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-amber-50 text-amber-600 p-2.5 rounded-lg">
                <FiAlertTriangle size={18} />
              </div>
            </div>
            <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Reported Reviews</h3>
            <p className="text-gray-800 text-2xl font-bold mt-1">
              {allReviews.filter(r => r.status === 'reported').length}
            </p>
          </div>

          {/* Card 5: Blocked Users */}
          <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-orange-50 text-orange-600 p-2.5 rounded-lg">
                <FiUserX size={18} />
              </div>
            </div>
            <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Blocked Users</h3>
            <p className="text-gray-800 text-2xl font-bold mt-1">{blockedUsers.length}</p>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueLineChart data={revenueData} period={period} />
        <SalesBarChart data={revenueData} period={period} />
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueVsOrdersChart data={revenueData} period={period} />
        <OrderStatusPieChart data={orderStatusData} />
      </div>

      {/* Customer Growth Chart */}
      <div className="grid grid-cols-1 gap-6">
        <CustomerGrowthAreaChart data={customerGrowth} period={period} />
      </div>

      {/* Products and Orders Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopProducts products={topProducts} />
        <RecentOrders
          orders={recentOrders}
          onViewOrder={(order) => navigate(`/admin/orders/${order._id || order.orderId}`)}
        />
      </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
