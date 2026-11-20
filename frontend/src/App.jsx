import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useEffect, lazy, Suspense } from "react";

import CartDrawer from "./shared/components/Cart/CartDrawer";
import ProtectedRoute from "./shared/components/Auth/ProtectedRoute";
import ErrorBoundary from "./shared/components/ErrorBoundary/ErrorBoundary";
const AdminLogin = lazy(() => import("./modules/Admin/pages/Login"));
const AdminProtectedRoute = lazy(() => import("./modules/Admin/components/AdminProtectedRoute"));
const AdminLayout = lazy(() => import("./modules/Admin/components/Layout/AdminLayout"));
const Dashboard = lazy(() => import("./modules/Admin/pages/Dashboard"));
const Products = lazy(() => import("./modules/Admin/pages/Products"));
const ProductForm = lazy(() => import("./modules/Admin/pages/ProductForm"));
const AdminOrders = lazy(() => import("./modules/Admin/pages/Orders"));
const OrderDetail = lazy(() => import("./modules/Admin/pages/OrderDetail"));
const ReturnRequests = lazy(() => import("./modules/Admin/pages/ReturnRequests"));
const ReturnRequestDetail = lazy(() => import("./modules/Admin/pages/ReturnRequestDetail"));
const Categories = lazy(() => import("./modules/Admin/pages/Categories"));
const Customers = lazy(() => import("./modules/Admin/pages/Customers"));

const Campaigns = lazy(() => import("./modules/Admin/pages/Campaigns"));
const Banners = lazy(() => import("./modules/Admin/pages/Banners"));
const Reviews = lazy(() => import("./modules/Admin/pages/Reviews"));
const Analytics = lazy(() => import("./modules/Admin/pages/Analytics"));
const Content = lazy(() => import("./modules/Admin/pages/Content"));
const Settings = lazy(() => import("./modules/Admin/pages/Settings"));
const More = lazy(() => import("./modules/Admin/pages/More"));
const PromoCodes = lazy(() => import("./modules/Admin/pages/PromoCodes"));
// Orders child pages
const AllOrders = lazy(() => import("./modules/Admin/pages/orders/AllOrders"));
const OrderTracking = lazy(() => import("./modules/Admin/pages/orders/OrderTracking"));

const Invoice = lazy(() => import("./modules/Admin/pages/orders/Invoice"));
// Products child pages
const ManageProducts = lazy(() => import("./modules/Admin/pages/products/ManageProducts"));
const ProductRatings = lazy(() => import("./modules/Admin/pages/products/ProductRatings"));

// Categories child pages
const ManageCategories = lazy(() => import("./modules/Admin/pages/categories/ManageCategories"));
const CategoryOrder = lazy(() => import("./modules/Admin/pages/categories/CategoryOrder"));
// Customers child pages
const ViewCustomers = lazy(() => import("./modules/Admin/pages/customers/ViewCustomers"));
const CustomerAddresses = lazy(() => import("./modules/Admin/pages/customers/Addresses"));
const Transactions = lazy(() => import("./modules/Admin/pages/customers/Transactions"));
const CustomerDetailPage = lazy(() => import("./modules/Admin/pages/customers/CustomerDetailPage"));
// Delivery Management child pages
const DeliveryBoys = lazy(() => import("./modules/Admin/pages/delivery/DeliveryBoys"));
const CashCollection = lazy(() => import("./modules/Admin/pages/delivery/CashCollection"));
const AssignDelivery = lazy(() => import("./modules/Admin/pages/delivery/AssignDelivery"));
// Vendors child pages
const Vendors = lazy(() => import("./modules/Admin/pages/Vendors"));
const ManageVendors = lazy(() => import("./modules/Admin/pages/vendors/ManageVendors"));
const PendingApprovals = lazy(() => import("./modules/Admin/pages/vendors/PendingApprovals"));
const PayoutManagement = lazy(() => import("./modules/Admin/pages/vendors/PayoutManagement"));
const VendorDetail = lazy(() => import("./modules/Admin/pages/vendors/VendorDetail"));
const CommissionRates = lazy(() => import("./modules/Admin/pages/vendors/CommissionRates"));
const AdminVendorAnalytics = lazy(() => import("./modules/Admin/pages/vendors/VendorAnalytics"));

// Offers & Sliders child pages
const HomeSliders = lazy(() => import("./modules/Admin/pages/offers/HomeSliders"));
const FestivalOffers = lazy(() => import("./modules/Admin/pages/offers/FestivalOffers"));
// Notifications child pages
const PushNotifications = lazy(() => import("./modules/Admin/pages/notifications/PushNotifications"));
const CustomMessages = lazy(() => import("./modules/Admin/pages/notifications/CustomMessages"));
const AllNotifications = lazy(() => import("./modules/Admin/pages/notifications/AllNotifications"));
// Support Desk child pages
const LiveChat = lazy(() => import("./modules/Admin/pages/support/LiveChat"));
const TicketTypes = lazy(() => import("./modules/Admin/pages/support/TicketTypes"));
const Tickets = lazy(() => import("./modules/Admin/pages/support/Tickets"));
// Reports child pages
const SalesReport = lazy(() => import("./modules/Admin/pages/reports/SalesReport"));
const InventoryReport = lazy(() => import("./modules/Admin/pages/reports/InventoryReport"));
// Consolidated Settings pages
const GeneralSettings = lazy(() => import("./modules/Admin/pages/settings/GeneralSettings"));
const PaymentShippingSettings = lazy(() => import("./modules/Admin/pages/settings/PaymentShippingSettings"));
const OrdersCustomersSettings = lazy(() => import("./modules/Admin/pages/settings/OrdersCustomersSettings"));
const ProductsInventorySettings = lazy(() => import("./modules/Admin/pages/settings/ProductsInventorySettings"));
const ContentFeaturesSettings = lazy(() => import("./modules/Admin/pages/settings/ContentFeaturesSettings"));
const NotificationsSEOSettings = lazy(() => import("./modules/Admin/pages/settings/NotificationsSEOSettings"));
// Policies child pages
const PrivacyPolicy = lazy(() => import("./modules/Admin/pages/policies/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./modules/Admin/pages/policies/RefundPolicy"));
const TermsConditions = lazy(() => import("./modules/Admin/pages/policies/TermsConditions"));
import RouteWrapper from "./shared/components/RouteWrapper";
import ScrollToTop from "./shared/components/ScrollToTop";
import AppBootstrap from "./shared/components/AppBootstrap";

// Mobile App Routes
import MobileHome from "./modules/UserApp/pages/Home";
const MobileProductDetail = lazy(() => import("./modules/UserApp/pages/ProductDetail"));
const MobileSeller = lazy(() => import("./modules/UserApp/pages/Seller"));
const MobileStores = lazy(() => import("./modules/UserApp/pages/Stores"));
const MobileCategory = lazy(() => import("./modules/UserApp/pages/Category"));
const MobileBrand = lazy(() => import("./modules/UserApp/pages/Brand"));
const MobileCategories = lazy(() => import("./modules/UserApp/pages/categories"));
const MobileCheckout = lazy(() => import("./modules/UserApp/pages/Checkout"));
const MobileSearch = lazy(() => import("./modules/UserApp/pages/Search"));
const MobileLogin = lazy(() => import("./modules/UserApp/pages/Login"));
const MobileRegister = lazy(() => import("./modules/UserApp/pages/Register"));
const MobileVerification = lazy(() => import("./modules/UserApp/pages/Verification"));
const MobileForgotPassword = lazy(() => import("./modules/UserApp/pages/ForgotPassword"));
const MobileResetPassword = lazy(() => import("./modules/UserApp/pages/ResetPassword"));
const MobileProfile = lazy(() => import("./modules/UserApp/pages/Profile"));
const UserNotifications = lazy(() => import("./modules/UserApp/pages/Notifications"));
const MobileOrders = lazy(() => import("./modules/UserApp/pages/Orders"));
const MobileOrderDetail = lazy(() => import("./modules/UserApp/pages/OrderDetail"));
const MobileAddresses = lazy(() => import("./modules/UserApp/pages/Addresses"));
const MobileWishlist = lazy(() => import("./modules/UserApp/pages/Wishlist"));
const MobileOffers = lazy(() => import("./modules/UserApp/pages/Offers"));
const MobileDailyDeals = lazy(() => import("./modules/UserApp/pages/DailyDeals"));
const MobileFlashSale = lazy(() => import("./modules/UserApp/pages/FlashSale"));
const MobileNewArrivals = lazy(() => import("./modules/UserApp/pages/NewArrivals"));
const MobileCampaignSale = lazy(() => import("./modules/UserApp/pages/CampaignSale"));
const MobileTrackOrder = lazy(() => import("./modules/UserApp/pages/TrackOrder"));
const MobileOrderConfirmation = lazy(() => import("./modules/UserApp/pages/OrderConfirmation"));
const ComingSoon = lazy(() => import("./modules/UserApp/pages/ComingSoon"));
// Field Network Routes (Sanchalak / Surveyor)
const FieldAccounts = lazy(() => import("./modules/Admin/pages/fieldNetwork/FieldAccounts"));
const FieldCommissionRates = lazy(() => import("./modules/Admin/pages/fieldNetwork/CommissionRates"));
const AdminFarmers = lazy(() => import("./modules/Admin/pages/fieldNetwork/Farmers"));
const ProcurementRequests = lazy(() => import("./modules/Admin/pages/procurement/ProcurementRequests"));
const ProcuredStock = lazy(() => import("./modules/Admin/pages/procurement/ProcuredStock"));
const ProduceList = lazy(() => import("./modules/Admin/pages/procurement/ProduceList"));
const SeedItems = lazy(() => import("./modules/Admin/pages/seeds/SeedItems"));
const SeedDispatches = lazy(() => import("./modules/Admin/pages/seeds/SeedDispatches"));
const SeedRemittances = lazy(() => import("./modules/Admin/pages/seeds/SeedRemittances"));
const FieldAccountProfile = lazy(() => import("./modules/Admin/pages/fieldNetwork/FieldAccountProfile"));
const SanchalakProtectedRoute = lazy(() => import("./modules/Sanchalak/components/SanchalakProtectedRoute"));
const SanchalakDashboard = lazy(() => import("./modules/Sanchalak/pages/Dashboard"));
const SanchalakFarmers = lazy(() => import("./modules/Sanchalak/pages/Farmers"));
const SanchalakFarmerDetail = lazy(() => import("./modules/Sanchalak/pages/FarmerDetail"));
const SanchalakProfile = lazy(() => import("./modules/Sanchalak/pages/Profile"));
const SanchalakSurveyorDetail = lazy(() => import("./modules/Sanchalak/pages/SurveyorDetail"));
const SanchalakSurveyors = lazy(() => import("./modules/Sanchalak/pages/Surveyors"));
const SanchalakPurchases = lazy(() => import("./modules/Sanchalak/pages/Purchases"));
const SanchalakPurchaseDetail = lazy(() => import("./modules/Sanchalak/pages/PurchaseDetail"));
const SanchalakWarehouse = lazy(() => import("./modules/Sanchalak/pages/Warehouse"));
const SanchalakSellToAdmin = lazy(() => import("./modules/Sanchalak/pages/SellToAdmin"));
const SanchalakSales = lazy(() => import("./modules/Sanchalak/pages/Sales"));
const SanchalakSaleDetail = lazy(() => import("./modules/Sanchalak/pages/SaleDetail"));
const SanchalakSeedGiven = lazy(() => import("./modules/Sanchalak/pages/SeedGiven"));
const KisanProtectedRoute = lazy(() => import("./modules/Kisan/components/KisanProtectedRoute"));
const KisanDashboard = lazy(() => import("./modules/Kisan/pages/Dashboard"));
const KisanSell = lazy(() => import("./modules/Kisan/pages/Sell"));
const KisanRequests = lazy(() => import("./modules/Kisan/pages/Requests"));
const KisanRequestDetail = lazy(() => import("./modules/Kisan/pages/RequestDetail"));
const KisanProfile = lazy(() => import("./modules/Kisan/pages/Profile"));
const KisanSeedRequests = lazy(() => import("./modules/Kisan/pages/SeedRequests"));
const KisanSeedRequestDetail = lazy(() => import("./modules/Kisan/pages/SeedRequestDetail"));
const SurveyorProtectedRoute = lazy(() => import("./modules/Surveyor/components/SurveyorProtectedRoute"));
const SurveyorDashboard = lazy(() => import("./modules/Surveyor/pages/Dashboard"));
const SurveyorFarmers = lazy(() => import("./modules/Surveyor/pages/Farmers"));
const SurveyorFarmerForm = lazy(() => import("./modules/Surveyor/pages/FarmerForm"));
const SurveyorProfile = lazy(() => import("./modules/Surveyor/pages/Profile"));
const SurveyorFarmerDetail = lazy(() => import("./modules/Surveyor/pages/FarmerDetail"));
const SurveyorSeeds = lazy(() => import("./modules/Surveyor/pages/Seeds"));
const SurveyorIssueSeed = lazy(() => import("./modules/Surveyor/pages/IssueSeed"));
const SurveyorSeedIssues = lazy(() => import("./modules/Surveyor/pages/SeedIssues"));
const SurveyorSeedIssueDetail = lazy(() => import("./modules/Surveyor/pages/SeedIssueDetail"));
const SurveyorSeedAccount = lazy(() => import("./modules/Surveyor/pages/SeedAccount"));
// Delivery Routes
const DeliveryLogin = lazy(() => import("./modules/Delivery/pages/Login"));
const DeliveryRegister = lazy(() => import("./modules/Delivery/pages/Register"));
const DeliveryForgotPassword = lazy(() => import("./modules/Delivery/pages/ForgotPassword"));
const DeliveryResetPassword = lazy(() => import("./modules/Delivery/pages/ResetPassword"));
const DeliveryProtectedRoute = lazy(() => import("./modules/Delivery/components/DeliveryProtectedRoute"));
const DeliveryLayout = lazy(() => import("./modules/Delivery/components/Layout/DeliveryLayout"));
const DeliveryDashboard = lazy(() => import("./modules/Delivery/pages/Dashboard"));
const DeliveryOrders = lazy(() => import("./modules/Delivery/pages/Orders"));
const DeliveryOrderDetail = lazy(() => import("./modules/Delivery/pages/OrderDetail"));
const DeliveryProfile = lazy(() => import("./modules/Delivery/pages/Profile"));
const DeliveryNotifications = lazy(() => import("./modules/Delivery/pages/Notifications"));
// Vendor Routes
const VendorLogin = lazy(() => import("./modules/Vendor/pages/Login"));
const VendorRegister = lazy(() => import("./modules/Vendor/pages/Register"));
const VendorVerification = lazy(() => import("./modules/Vendor/pages/Verification"));
const VendorForgotPassword = lazy(() => import("./modules/Vendor/pages/ForgotPassword"));
const VendorResetPassword = lazy(() => import("./modules/Vendor/pages/ResetPassword"));
const VendorProtectedRoute = lazy(() => import("./modules/Vendor/components/VendorProtectedRoute"));
const VendorLayout = lazy(() => import("./modules/Vendor/components/Layout/VendorLayout"));
const VendorDashboard = lazy(() => import("./modules/Vendor/pages/Dashboard"));
const VendorProducts = lazy(() => import("./modules/Vendor/pages/Products"));
const VendorManageProducts = lazy(() => import("./modules/Vendor/pages/products/ManageProducts"));
const VendorAddProduct = lazy(() => import("./modules/Vendor/pages/products/AddProduct"));
const VendorBulkUpload = lazy(() => import("./modules/Vendor/pages/products/VendorBulkUpload"));
const VendorProductForm = lazy(() => import("./modules/Vendor/pages/products/ProductForm"));
const VendorOrders = lazy(() => import("./modules/Vendor/pages/Orders"));
const VendorAllOrders = lazy(() => import("./modules/Vendor/pages/orders/AllOrders"));
const VendorOrderTracking = lazy(() => import("./modules/Vendor/pages/orders/OrderTracking"));
const VendorOrderDetail = lazy(() => import("./modules/Vendor/pages/orders/OrderDetail"));
const VendorAnalytics = lazy(() => import("./modules/Vendor/pages/Analytics"));
const VendorEarnings = lazy(() => import("./modules/Vendor/pages/Earnings"));
const VendorPaymentSettlements = lazy(() => import("./modules/Vendor/pages/PaymentSettlements"));
const VendorSettings = lazy(() => import("./modules/Vendor/pages/Settings"));
const VendorStockManagement = lazy(() => import("./modules/Vendor/pages/StockManagement"));
const VendorWalletHistory = lazy(() => import("./modules/Vendor/pages/WalletHistory"));
const VendorChat = lazy(() => import("./modules/Vendor/pages/Chat"));
const VendorReturnRequests = lazy(() => import("./modules/Vendor/pages/ReturnRequests"));
const VendorReturnRequestDetail = lazy(() => import("./modules/Vendor/pages/returns/ReturnRequestDetail"));
const VendorProductReviews = lazy(() => import("./modules/Vendor/pages/ProductReviews"));
const VendorShippingManagement = lazy(() => import("./modules/Vendor/pages/ShippingManagement"));
const VendorCustomers = lazy(() => import("./modules/Vendor/pages/Customers"));
const VendorCustomerDetail = lazy(() => import("./modules/Vendor/pages/CustomerDetail"));
const VendorInventoryReports = lazy(() => import("./modules/Vendor/pages/InventoryReports"));
const VendorPerformanceMetrics = lazy(() => import("./modules/Vendor/pages/PerformanceMetrics"));
const VendorDocuments = lazy(() => import("./modules/Vendor/pages/Documents"));
const VendorNotifications = lazy(() => import("./modules/Vendor/pages/Notifications"));
const VendorSupportTickets = lazy(() => import("./modules/Vendor/pages/SupportTickets"));
const VendorPickupLocations = lazy(() => import("./modules/Vendor/pages/PickupLocations"));
const VendorReports = lazy(() => import("./modules/Vendor/pages/Reports"));
const VendorLanguageSettings = lazy(() => import("./modules/Vendor/pages/LanguageSettings"));
const StaticPrivacyPolicy = lazy(() => import("./shared/pages/StaticPrivacyPolicy"));
const StaticTermsConditions = lazy(() => import("./shared/pages/StaticTermsConditions"));
const StaticSupport = lazy(() => import("./shared/pages/StaticSupport"));

// Lightweight placeholder shown while a lazily-loaded page chunk downloads.
const RouteFallback = () => (
  <div className="flex min-h-[60vh] w-full items-center justify-center">
    <div className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />
  </div>
);

// Inner component that has access to useLocation
const AppRoutes = () => {
  return (
    <Routes>
      {/* Publicly accessible static pages */}
      <Route path="/privacy-policy" element={<RouteWrapper><StaticPrivacyPolicy /></RouteWrapper>} />
      <Route path="/privacy" element={<RouteWrapper><StaticPrivacyPolicy /></RouteWrapper>} />
      <Route path="/terms-and-conditions" element={<RouteWrapper><StaticTermsConditions /></RouteWrapper>} />
      <Route path="/terms" element={<RouteWrapper><StaticTermsConditions /></RouteWrapper>} />
      <Route path="/terms-conditions" element={<RouteWrapper><StaticTermsConditions /></RouteWrapper>} />
      <Route path="/support" element={<RouteWrapper><StaticSupport /></RouteWrapper>} />
      <Route path="/vendor/privacy-policy" element={<RouteWrapper><StaticPrivacyPolicy defaultRole="vendor" /></RouteWrapper>} />
      <Route path="/vendor/privacy" element={<RouteWrapper><StaticPrivacyPolicy defaultRole="vendor" /></RouteWrapper>} />
      <Route path="/vendor/terms" element={<RouteWrapper><StaticTermsConditions defaultRole="vendor" /></RouteWrapper>} />
      <Route path="/vendor/terms-conditions" element={<RouteWrapper><StaticTermsConditions defaultRole="vendor" /></RouteWrapper>} />
      <Route path="/vendor/support" element={<RouteWrapper><StaticSupport /></RouteWrapper>} />
      <Route path="/delivery/privacy-policy" element={<RouteWrapper><StaticPrivacyPolicy defaultRole="delivery" /></RouteWrapper>} />
      <Route path="/delivery/privacy" element={<RouteWrapper><StaticPrivacyPolicy defaultRole="delivery" /></RouteWrapper>} />
      <Route path="/delivery/terms" element={<RouteWrapper><StaticTermsConditions defaultRole="delivery" /></RouteWrapper>} />
      <Route path="/delivery/terms-conditions" element={<RouteWrapper><StaticTermsConditions defaultRole="delivery" /></RouteWrapper>} />
      <Route path="/delivery/support" element={<RouteWrapper><StaticSupport /></RouteWrapper>} />

      <Route
        path="/"
        element={
          <RouteWrapper>
            <MobileHome />
          </RouteWrapper>
        }
      />
      <Route
        path="/home"
        element={
          <RouteWrapper>
            <MobileHome />
          </RouteWrapper>
        }
      />
      <Route
        path="/product/:id"
        element={
          <RouteWrapper>
            <MobileProductDetail />
          </RouteWrapper>
        }
      />
      <Route
        path="/seller/:id"
        element={
          <RouteWrapper>
            <MobileSeller />
          </RouteWrapper>
        }
      />
      <Route
        path="/stores"
        element={
          <RouteWrapper>
            <MobileStores />
          </RouteWrapper>
        }
      />
      <Route
        path="/category/:id"
        element={
          <RouteWrapper>
            <MobileCategory />
          </RouteWrapper>
        }
      />
      <Route
        path="/brand/:id"
        element={
          <RouteWrapper>
            <MobileBrand />
          </RouteWrapper>
        }
      />
      <Route
        path="/categories"
        element={
          <RouteWrapper>
            <MobileCategories />
          </RouteWrapper>
        }
      />
      <Route
        path="/search"
        element={
          <RouteWrapper>
            <MobileSearch />
          </RouteWrapper>
        }
      />
      <Route
        path="/checkout"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileCheckout />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />

      <Route
        path="/login"
        element={
          <RouteWrapper>
            <MobileLogin />
          </RouteWrapper>
        }
      />
      <Route
        path="/register"
        element={
          <RouteWrapper>
            <MobileRegister />
          </RouteWrapper>
        }
      />
      <Route
        path="/signup"
        element={<Navigate to="/register" replace />}
      />
      <Route
        path="/verification"
        element={
          <RouteWrapper>
            <MobileVerification />
          </RouteWrapper>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <RouteWrapper>
            <MobileForgotPassword />
          </RouteWrapper>
        }
      />
      <Route
        path="/reset-password"
        element={
          <RouteWrapper>
            <MobileResetPassword />
          </RouteWrapper>
        }
      />
      <Route
        path="/wishlist"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileWishlist />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/offers"
        element={
          <RouteWrapper>
            <MobileOffers />
          </RouteWrapper>
        }
      />
      <Route
        path="/daily-deals"
        element={
          <RouteWrapper>
            <MobileDailyDeals />
          </RouteWrapper>
        }
      />
      <Route
        path="/flash-sale"
        element={
          <RouteWrapper>
            <MobileFlashSale />
          </RouteWrapper>
        }
      />
      <Route
        path="/new-arrivals"
        element={
          <RouteWrapper>
            <MobileNewArrivals />
          </RouteWrapper>
        }
      />
      <Route
        path="/sale/:slug"
        element={
          <RouteWrapper>
            <MobileCampaignSale />
          </RouteWrapper>
        }
      />
      <Route
        path="/order-confirmation/:orderId"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileOrderConfirmation />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/orders/:orderId"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileOrderDetail />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/track-order/:orderId"
        element={
          <RouteWrapper>
            <MobileTrackOrder />
          </RouteWrapper>
        }
      />
      <Route
        path="/profile"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileProfile />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/notifications"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <UserNotifications />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/orders"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileOrders />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/addresses"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileAddresses />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AdminLayout />
          </AdminProtectedRoute>
        }>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="products/manage-products" element={<ManageProducts />} />
        <Route path="products/product-ratings" element={<ProductRatings />} />
        <Route path="products/procured-stock" element={<ProcuredStock />} />
        <Route path="products/produce-list" element={<ProduceList />} />
        <Route path="more" element={<More />} />
        <Route path="categories" element={<Categories />} />
        <Route
          path="categories/manage-categories"
          element={<ManageCategories />}
        />
        <Route path="categories/category-order" element={<CategoryOrder />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="orders/:id/invoice" element={<Invoice />} />
        <Route path="orders/all-orders" element={<AllOrders />} />
        <Route path="orders/order-tracking" element={<OrderTracking />} />
        <Route path="return-requests" element={<ReturnRequests />} />
        <Route path="return-requests/:id" element={<ReturnRequestDetail />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/view-customers" element={<ViewCustomers />} />
        <Route path="customers/addresses" element={<CustomerAddresses />} />
        <Route path="customers/transactions" element={<Transactions />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />

        <Route path="delivery" element={<DeliveryBoys />} />
        <Route path="delivery/delivery-boys" element={<DeliveryBoys />} />
        <Route path="delivery/cash-collection" element={<CashCollection />} />
        <Route path="delivery/assign-delivery" element={<AssignDelivery />} />
        <Route path="field-network" element={<Navigate to="/admin/field-network/sanchalaks" replace />} />
        <Route path="field-network/sanchalaks" element={<FieldAccounts key="sanchalak" kind="sanchalak" />} />
        <Route path="field-network/sanchalaks/:id" element={<FieldAccountProfile key="sanchalak" kind="sanchalak" />} />
        <Route path="field-network/surveyors" element={<FieldAccounts key="surveyor" kind="surveyor" />} />
        <Route path="field-network/surveyors/:id" element={<FieldAccountProfile key="surveyor" kind="surveyor" />} />
        <Route path="field-network/procurement-requests" element={<ProcurementRequests />} />
        <Route path="field-network/seeds" element={<SeedItems />} />
        <Route path="field-network/seed-dispatches" element={<SeedDispatches />} />
        <Route path="field-network/seed-payments" element={<SeedRemittances />} />
        <Route path="field-network/commission" element={<FieldCommissionRates />} />
        <Route path="farmers" element={<AdminFarmers />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="vendors/manage-vendors" element={<ManageVendors />} />
        <Route
          path="vendors/pending-approvals"
          element={<PendingApprovals />}
        />
        <Route
          path="vendors/payout-management"
          element={<PayoutManagement />}
        />
        <Route path="vendors/commission-rates" element={<CommissionRates />} />
        <Route
          path="vendors/vendor-analytics"
          element={<AdminVendorAnalytics />}
        />
        <Route path="vendors/:id" element={<VendorDetail />} />

        <Route path="offers" element={<HomeSliders />} />
        <Route path="offers/home-sliders" element={<HomeSliders />} />
        <Route path="offers/festival-offers" element={<FestivalOffers />} />
        <Route path="promocodes" element={<PromoCodes />} />
        <Route path="notifications" element={<AllNotifications />} />
        <Route
          path="notifications/push-notifications"
          element={<PushNotifications />}
        />
        <Route
          path="notifications/custom-messages"
          element={<CustomMessages />}
        />
        <Route path="support" element={<Tickets />} />
        <Route path="support/live-chat" element={<LiveChat />} />
        <Route path="support/ticket-types" element={<TicketTypes />} />
        <Route path="support/tickets" element={<Tickets />} />
        <Route path="reports" element={<SalesReport />} />
        <Route path="reports/sales-report" element={<SalesReport />} />
        <Route path="reports/inventory-report" element={<InventoryReport />} />
        <Route path="analytics" element={<Analytics />} />
        <Route
          path="settings"
          element={<Navigate to="/admin/settings/general" replace />}
        />
        <Route path="settings/general" element={<Settings />} />
        <Route path="settings/payment-shipping" element={<Settings />} />
        <Route path="settings/orders-customers" element={<Settings />} />
        <Route path="settings/products-inventory" element={<Settings />} />
        <Route path="settings/content-features" element={<Settings />} />
        <Route path="settings/notifications-seo" element={<Settings />} />
        <Route path="policies" element={<PrivacyPolicy />} />
        <Route path="policies/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="policies/refund-policy" element={<RefundPolicy />} />
        <Route path="policies/terms-conditions" element={<TermsConditions />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="banners" element={<Banners />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="content" element={<Content />} />
      </Route>
      {/* Field Network Routes — login and registration live on the shared /login and /register pages */}
      <Route path="/sanchalak" element={<Navigate to="/sanchalak/dashboard" replace />} />
      <Route
        path="/sanchalak/dashboard"
        element={
          <SanchalakProtectedRoute>
            <SanchalakDashboard />
          </SanchalakProtectedRoute>
        }
      />
      <Route
        path="/sanchalak/farmers"
        element={
          <SanchalakProtectedRoute>
            <SanchalakFarmers />
          </SanchalakProtectedRoute>
        }
      />
      <Route
        path="/sanchalak/farmers/:id"
        element={
          <SanchalakProtectedRoute>
            <SanchalakFarmerDetail />
          </SanchalakProtectedRoute>
        }
      />
      <Route
        path="/sanchalak/surveyors"
        element={
          <SanchalakProtectedRoute>
            <SanchalakSurveyors />
          </SanchalakProtectedRoute>
        }
      />
      <Route
        path="/sanchalak/surveyors/:id"
        element={
          <SanchalakProtectedRoute>
            <SanchalakSurveyorDetail />
          </SanchalakProtectedRoute>
        }
      />
      <Route
        path="/sanchalak/profile"
        element={
          <SanchalakProtectedRoute>
            <SanchalakProfile />
          </SanchalakProtectedRoute>
        }
      />
      {[
        ["purchases", <SanchalakPurchases />],
        ["purchases/:id", <SanchalakPurchaseDetail />],
        ["warehouse", <SanchalakWarehouse />],
        ["warehouse/sell", <SanchalakSellToAdmin />],
        ["sales", <SanchalakSales />],
        ["sales/:id", <SanchalakSaleDetail />],
        ["seed-given", <SanchalakSeedGiven />],
      ].map(([path, page]) => (
        <Route key={path} path={`/sanchalak/${path}`} element={<SanchalakProtectedRoute>{page}</SanchalakProtectedRoute>} />
      ))}
      {/* Kisan (farmer) Routes — login is the shared /login?role=kisan page (mobile + OTP) */}
      <Route path="/kisan" element={<Navigate to="/kisan/dashboard" replace />} />
      {[
        ["dashboard", <KisanDashboard />],
        ["sell", <KisanSell />],
        ["requests", <KisanRequests />],
        ["requests/:id", <KisanRequestDetail />],
        ["seeds", <KisanSeedRequests />],
        ["seeds/:id", <KisanSeedRequestDetail />],
        ["profile", <KisanProfile />],
      ].map(([path, page]) => (
        <Route key={path} path={`/kisan/${path}`} element={<KisanProtectedRoute>{page}</KisanProtectedRoute>} />
      ))}
      <Route path="/surveyor" element={<Navigate to="/surveyor/dashboard" replace />} />
      <Route
        path="/surveyor/dashboard"
        element={
          <SurveyorProtectedRoute>
            <SurveyorDashboard />
          </SurveyorProtectedRoute>
        }
      />
      <Route
        path="/surveyor/farmers"
        element={
          <SurveyorProtectedRoute>
            <SurveyorFarmers />
          </SurveyorProtectedRoute>
        }
      />
      <Route
        path="/surveyor/farmers/new"
        element={
          <SurveyorProtectedRoute>
            <SurveyorFarmerForm key="new" />
          </SurveyorProtectedRoute>
        }
      />
      <Route
        path="/surveyor/farmers/:id"
        element={
          <SurveyorProtectedRoute>
            <SurveyorFarmerDetail />
          </SurveyorProtectedRoute>
        }
      />
      <Route
        path="/surveyor/farmers/:id/edit"
        element={
          <SurveyorProtectedRoute>
            <SurveyorFarmerForm key="edit" />
          </SurveyorProtectedRoute>
        }
      />
      {[
        ["seeds", <SurveyorSeeds />],
        ["seed-issues", <SurveyorSeedIssues />],
        ["seed-issues/new", <SurveyorIssueSeed />],
        ["seed-issues/:id", <SurveyorSeedIssueDetail />],
        ["seed-account", <SurveyorSeedAccount />],
      ].map(([path, page]) => (
        <Route key={path} path={`/surveyor/${path}`} element={<SurveyorProtectedRoute>{page}</SurveyorProtectedRoute>} />
      ))}
      <Route
        path="/surveyor/profile"
        element={
          <SurveyorProtectedRoute>
            <SurveyorProfile />
          </SurveyorProtectedRoute>
        }
      />
      {/* Delivery Routes */}
      <Route path="/delivery/login" element={<DeliveryLogin />} />
      <Route path="/delivery/register" element={<DeliveryRegister />} />
      <Route
        path="/delivery/forgot-password"
        element={<DeliveryForgotPassword />}
      />
      <Route
        path="/delivery/reset-password"
        element={<DeliveryResetPassword />}
      />
      <Route
        path="/delivery"
        element={
          <DeliveryProtectedRoute>
            <DeliveryLayout />
          </DeliveryProtectedRoute>
        }>
        <Route index element={<Navigate to="/delivery/dashboard" replace />} />
        <Route path="dashboard" element={<DeliveryDashboard />} />
        <Route path="orders" element={<DeliveryOrders />} />
        <Route path="orders/:id" element={<DeliveryOrderDetail />} />
        <Route path="notifications" element={<DeliveryNotifications />} />
        <Route path="profile" element={<DeliveryProfile />} />
      </Route>
      {/* Vendor Routes */}
      <Route path="/vendor/login" element={<VendorLogin />} />
      <Route path="/vendor/register" element={<VendorRegister />} />
      <Route path="/vendor/verification" element={<VendorVerification />} />
      <Route
        path="/vendor/forgot-password"
        element={<VendorForgotPassword />}
      />
      <Route path="/vendor/reset-password" element={<VendorResetPassword />} />
      <Route
        path="/vendor"
        element={
          <VendorProtectedRoute>
            <VendorLayout />
          </VendorProtectedRoute>
        }>
        <Route index element={<Navigate to="/vendor/dashboard" replace />} />
        <Route path="dashboard" element={<VendorDashboard />} />
        <Route path="products" element={<VendorProducts />} />
        <Route
          path="products/manage-products"
          element={<VendorManageProducts />}
        />
        <Route path="products/add-product" element={<VendorAddProduct />} />
        <Route path="products/bulk-upload" element={<VendorBulkUpload />} />
        <Route path="products/:id" element={<VendorProductForm />} />
        <Route path="orders" element={<VendorOrders />} />
        <Route path="orders/all-orders" element={<VendorAllOrders />} />
        <Route path="orders/order-tracking" element={<VendorOrderTracking />} />
        <Route path="orders/:id" element={<VendorOrderDetail />} />
        <Route path="analytics" element={<VendorAnalytics />} />
        <Route path="reports" element={<VendorReports />} />
        <Route path="payment-settlements" element={<VendorPaymentSettlements />} />
        <Route path="payment-settlements/bank-details" element={<VendorPaymentSettlements />} />
        <Route path="payment-settlements/settlement-history" element={<VendorPaymentSettlements />} />
        <Route path="payment-settlements/pending-settlements" element={<VendorPaymentSettlements />} />
        <Route path="payment-settlements/released-settlements" element={<VendorPaymentSettlements />} />
        <Route path="earnings" element={<VendorEarnings />} />
        <Route path="earnings/overview" element={<VendorEarnings />} />
        <Route
          path="earnings/commission-history"
          element={<VendorEarnings />}
        />
        <Route
          path="earnings/settlement-history"
          element={<VendorEarnings />}
        />
        <Route path="stock-management" element={<VendorStockManagement />} />
        <Route path="wallet-history" element={<VendorWalletHistory />} />
        <Route path="chat" element={<VendorChat />} />
        <Route path="notifications" element={<VendorNotifications />} />
        <Route path="return-requests" element={<VendorReturnRequests />} />
        <Route
          path="return-requests/:id"
          element={<VendorReturnRequestDetail />}
        />
        <Route path="product-reviews" element={<VendorProductReviews />} />
        <Route
          path="shipping-management"
          element={<VendorShippingManagement />}
        />
        <Route path="pickup-locations" element={<VendorPickupLocations />} />
        <Route path="customers/:id" element={<VendorCustomerDetail />} />
        <Route path="customers" element={<VendorCustomers />} />
        <Route path="support-tickets" element={<VendorSupportTickets />} />
        <Route path="inventory-reports" element={<VendorInventoryReports />} />
        <Route
          path="performance-metrics"
          element={<VendorPerformanceMetrics />}
        />
        <Route path="documents" element={<VendorDocuments />} />
        <Route path="language-settings" element={<VendorLanguageSettings />} />
        <Route path="settings" element={<VendorSettings />} />
        <Route path="settings/store" element={<VendorSettings />} />
        <Route path="settings/payment" element={<VendorSettings />} />
        <Route path="settings/payment-settings" element={<VendorSettings />} />
        <Route path="settings/shipping" element={<VendorSettings />} />
        <Route path="settings/shipping-settings" element={<VendorSettings />} />
        <Route path="settings/gst" element={<VendorSettings />} />
        <Route path="profile" element={<VendorSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  useEffect(() => {
    // Defer Firebase/push setup until the browser is idle so it never blocks first paint.
    const start = () =>
      import("./services/pushNotificationService").then(
        ({ initializePushNotifications, setupForegroundNotificationHandler }) => {
          initializePushNotifications();
          setupForegroundNotificationHandler((payload) => {
            console.log("App received foreground notification:", payload);
          });
        }
      );
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 2000);
    return () => clearTimeout(id);
  }, []);

  return (
    <ErrorBoundary>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}>
        <AppBootstrap />
        <ScrollToTop />
        <Suspense fallback={<RouteFallback />}>
          <AppRoutes />
        </Suspense>
        <CartDrawer />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#212121",
              color: "#fff",
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: "#388E3C",
                secondary: "#fff",
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: "#FF6161",
                secondary: "#fff",
              },
            },
          }}
        />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
