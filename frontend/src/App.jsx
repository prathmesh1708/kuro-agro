import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import { initializePushNotifications, setupForegroundNotificationHandler } from "./services/pushNotificationService";

import CartDrawer from "./shared/components/Cart/CartDrawer";
import ProtectedRoute from "./shared/components/Auth/ProtectedRoute";
import ErrorBoundary from "./shared/components/ErrorBoundary/ErrorBoundary";
import AdminLogin from "./modules/Admin/pages/Login";
import AdminProtectedRoute from "./modules/Admin/components/AdminProtectedRoute";
import AdminLayout from "./modules/Admin/components/Layout/AdminLayout";
import Dashboard from "./modules/Admin/pages/Dashboard";
import Products from "./modules/Admin/pages/Products";
import ProductForm from "./modules/Admin/pages/ProductForm";
import AdminOrders from "./modules/Admin/pages/Orders";
import OrderDetail from "./modules/Admin/pages/OrderDetail";
import ReturnRequests from "./modules/Admin/pages/ReturnRequests";
import ReturnRequestDetail from "./modules/Admin/pages/ReturnRequestDetail";
import Categories from "./modules/Admin/pages/Categories";
import Customers from "./modules/Admin/pages/Customers";

import Campaigns from "./modules/Admin/pages/Campaigns";
import Banners from "./modules/Admin/pages/Banners";
import Reviews from "./modules/Admin/pages/Reviews";
import Analytics from "./modules/Admin/pages/Analytics";
import Content from "./modules/Admin/pages/Content";
import Settings from "./modules/Admin/pages/Settings";
import More from "./modules/Admin/pages/More";
import PromoCodes from "./modules/Admin/pages/PromoCodes";
// Orders child pages
import AllOrders from "./modules/Admin/pages/orders/AllOrders";
import OrderTracking from "./modules/Admin/pages/orders/OrderTracking";

import Invoice from "./modules/Admin/pages/orders/Invoice";
// Products child pages
import ManageProducts from "./modules/Admin/pages/products/ManageProducts";
import ProductRatings from "./modules/Admin/pages/products/ProductRatings";

// Categories child pages
import ManageCategories from "./modules/Admin/pages/categories/ManageCategories";
import CategoryOrder from "./modules/Admin/pages/categories/CategoryOrder";
// Customers child pages
import ViewCustomers from "./modules/Admin/pages/customers/ViewCustomers";
import CustomerAddresses from "./modules/Admin/pages/customers/Addresses";
import Transactions from "./modules/Admin/pages/customers/Transactions";
import CustomerDetailPage from "./modules/Admin/pages/customers/CustomerDetailPage";
// Delivery Management child pages
import DeliveryBoys from "./modules/Admin/pages/delivery/DeliveryBoys";
import CashCollection from "./modules/Admin/pages/delivery/CashCollection";
import AssignDelivery from "./modules/Admin/pages/delivery/AssignDelivery";
// Vendors child pages
import Vendors from "./modules/Admin/pages/Vendors";
import ManageVendors from "./modules/Admin/pages/vendors/ManageVendors";
import PendingApprovals from "./modules/Admin/pages/vendors/PendingApprovals";
import PayoutManagement from "./modules/Admin/pages/vendors/PayoutManagement";
import VendorDetail from "./modules/Admin/pages/vendors/VendorDetail";
import CommissionRates from "./modules/Admin/pages/vendors/CommissionRates";
import AdminVendorAnalytics from "./modules/Admin/pages/vendors/VendorAnalytics";

// Offers & Sliders child pages
import HomeSliders from "./modules/Admin/pages/offers/HomeSliders";
import FestivalOffers from "./modules/Admin/pages/offers/FestivalOffers";
// Notifications child pages
import PushNotifications from "./modules/Admin/pages/notifications/PushNotifications";
import CustomMessages from "./modules/Admin/pages/notifications/CustomMessages";
import AllNotifications from "./modules/Admin/pages/notifications/AllNotifications";
// Support Desk child pages
import LiveChat from "./modules/Admin/pages/support/LiveChat";
import TicketTypes from "./modules/Admin/pages/support/TicketTypes";
import Tickets from "./modules/Admin/pages/support/Tickets";
// Reports child pages
import SalesReport from "./modules/Admin/pages/reports/SalesReport";
import InventoryReport from "./modules/Admin/pages/reports/InventoryReport";
// Consolidated Settings pages
import GeneralSettings from "./modules/Admin/pages/settings/GeneralSettings";
import PaymentShippingSettings from "./modules/Admin/pages/settings/PaymentShippingSettings";
import OrdersCustomersSettings from "./modules/Admin/pages/settings/OrdersCustomersSettings";
import ProductsInventorySettings from "./modules/Admin/pages/settings/ProductsInventorySettings";
import ContentFeaturesSettings from "./modules/Admin/pages/settings/ContentFeaturesSettings";
import NotificationsSEOSettings from "./modules/Admin/pages/settings/NotificationsSEOSettings";
// Policies child pages
import PrivacyPolicy from "./modules/Admin/pages/policies/PrivacyPolicy";
import RefundPolicy from "./modules/Admin/pages/policies/RefundPolicy";
import TermsConditions from "./modules/Admin/pages/policies/TermsConditions";
import RouteWrapper from "./shared/components/RouteWrapper";
import ScrollToTop from "./shared/components/ScrollToTop";
import AppBootstrap from "./shared/components/AppBootstrap";

// Mobile App Routes
import MobileHome from "./modules/UserApp/pages/Home";
import MobileProductDetail from "./modules/UserApp/pages/ProductDetail";
import MobileSeller from "./modules/UserApp/pages/Seller";
import MobileStores from "./modules/UserApp/pages/Stores";
import MobileCategory from "./modules/UserApp/pages/Category";
import MobileBrand from "./modules/UserApp/pages/Brand";
import MobileCategories from "./modules/UserApp/pages/categories";
import MobileCheckout from "./modules/UserApp/pages/Checkout";
import MobileSearch from "./modules/UserApp/pages/Search";
import MobileLogin from "./modules/UserApp/pages/Login";
import MobileRegister from "./modules/UserApp/pages/Register";
import MobileVerification from "./modules/UserApp/pages/Verification";
import MobileForgotPassword from "./modules/UserApp/pages/ForgotPassword";
import MobileResetPassword from "./modules/UserApp/pages/ResetPassword";
import MobileProfile from "./modules/UserApp/pages/Profile";
import UserNotifications from "./modules/UserApp/pages/Notifications";
import MobileOrders from "./modules/UserApp/pages/Orders";
import MobileOrderDetail from "./modules/UserApp/pages/OrderDetail";
import MobileAddresses from "./modules/UserApp/pages/Addresses";
import MobileWishlist from "./modules/UserApp/pages/Wishlist";
import MobileOffers from "./modules/UserApp/pages/Offers";
import MobileDailyDeals from "./modules/UserApp/pages/DailyDeals";
import MobileFlashSale from "./modules/UserApp/pages/FlashSale";
import MobileNewArrivals from "./modules/UserApp/pages/NewArrivals";
import MobileCampaignSale from "./modules/UserApp/pages/CampaignSale";
import MobileTrackOrder from "./modules/UserApp/pages/TrackOrder";
import MobileOrderConfirmation from "./modules/UserApp/pages/OrderConfirmation";
import ComingSoon from "./modules/UserApp/pages/ComingSoon";
// Field Network Routes (Sanchalak / Surveyor)
import FieldAccounts from "./modules/Admin/pages/fieldNetwork/FieldAccounts";
import FieldCommissionRates from "./modules/Admin/pages/fieldNetwork/CommissionRates";
import AdminFarmers from "./modules/Admin/pages/fieldNetwork/Farmers";
import SanchalakProtectedRoute from "./modules/Sanchalak/components/SanchalakProtectedRoute";
import SanchalakDashboard from "./modules/Sanchalak/pages/Dashboard";
import SanchalakFarmers from "./modules/Sanchalak/pages/Farmers";
import SanchalakFarmerDetail from "./modules/Sanchalak/pages/FarmerDetail";
import SanchalakProfile from "./modules/Sanchalak/pages/Profile";
import SanchalakSurveyorDetail from "./modules/Sanchalak/pages/SurveyorDetail";
import SanchalakSurveyors from "./modules/Sanchalak/pages/Surveyors";
import SurveyorProtectedRoute from "./modules/Surveyor/components/SurveyorProtectedRoute";
import SurveyorDashboard from "./modules/Surveyor/pages/Dashboard";
import SurveyorFarmers from "./modules/Surveyor/pages/Farmers";
import SurveyorFarmerForm from "./modules/Surveyor/pages/FarmerForm";
import SurveyorProfile from "./modules/Surveyor/pages/Profile";
import SurveyorFarmerDetail from "./modules/Surveyor/pages/FarmerDetail";
// Delivery Routes
import DeliveryLogin from "./modules/Delivery/pages/Login";
import DeliveryRegister from "./modules/Delivery/pages/Register";
import DeliveryForgotPassword from "./modules/Delivery/pages/ForgotPassword";
import DeliveryResetPassword from "./modules/Delivery/pages/ResetPassword";
import DeliveryProtectedRoute from "./modules/Delivery/components/DeliveryProtectedRoute";
import DeliveryLayout from "./modules/Delivery/components/Layout/DeliveryLayout";
import DeliveryDashboard from "./modules/Delivery/pages/Dashboard";
import DeliveryOrders from "./modules/Delivery/pages/Orders";
import DeliveryOrderDetail from "./modules/Delivery/pages/OrderDetail";
import DeliveryProfile from "./modules/Delivery/pages/Profile";
import DeliveryNotifications from "./modules/Delivery/pages/Notifications";
// Vendor Routes
import VendorLogin from "./modules/Vendor/pages/Login";
import VendorRegister from "./modules/Vendor/pages/Register";
import VendorVerification from "./modules/Vendor/pages/Verification";
import VendorForgotPassword from "./modules/Vendor/pages/ForgotPassword";
import VendorResetPassword from "./modules/Vendor/pages/ResetPassword";
import VendorProtectedRoute from "./modules/Vendor/components/VendorProtectedRoute";
import VendorLayout from "./modules/Vendor/components/Layout/VendorLayout";
import VendorDashboard from "./modules/Vendor/pages/Dashboard";
import VendorProducts from "./modules/Vendor/pages/Products";
import VendorManageProducts from "./modules/Vendor/pages/products/ManageProducts";
import VendorAddProduct from "./modules/Vendor/pages/products/AddProduct";
import VendorBulkUpload from "./modules/Vendor/pages/products/VendorBulkUpload";
import VendorProductForm from "./modules/Vendor/pages/products/ProductForm";
import VendorOrders from "./modules/Vendor/pages/Orders";
import VendorAllOrders from "./modules/Vendor/pages/orders/AllOrders";
import VendorOrderTracking from "./modules/Vendor/pages/orders/OrderTracking";
import VendorOrderDetail from "./modules/Vendor/pages/orders/OrderDetail";
import VendorAnalytics from "./modules/Vendor/pages/Analytics";
import VendorEarnings from "./modules/Vendor/pages/Earnings";
import VendorPaymentSettlements from "./modules/Vendor/pages/PaymentSettlements";
import VendorSettings from "./modules/Vendor/pages/Settings";
import VendorStockManagement from "./modules/Vendor/pages/StockManagement";
import VendorWalletHistory from "./modules/Vendor/pages/WalletHistory";
import VendorChat from "./modules/Vendor/pages/Chat";
import VendorReturnRequests from "./modules/Vendor/pages/ReturnRequests";
import VendorReturnRequestDetail from "./modules/Vendor/pages/returns/ReturnRequestDetail";
import VendorProductReviews from "./modules/Vendor/pages/ProductReviews";
import VendorShippingManagement from "./modules/Vendor/pages/ShippingManagement";
import VendorCustomers from "./modules/Vendor/pages/Customers";
import VendorCustomerDetail from "./modules/Vendor/pages/CustomerDetail";
import VendorInventoryReports from "./modules/Vendor/pages/InventoryReports";
import VendorPerformanceMetrics from "./modules/Vendor/pages/PerformanceMetrics";
import VendorDocuments from "./modules/Vendor/pages/Documents";
import VendorNotifications from "./modules/Vendor/pages/Notifications";
import VendorSupportTickets from "./modules/Vendor/pages/SupportTickets";
import VendorPickupLocations from "./modules/Vendor/pages/PickupLocations";
import VendorReports from "./modules/Vendor/pages/Reports";
import VendorLanguageSettings from "./modules/Vendor/pages/LanguageSettings";
import StaticPrivacyPolicy from "./shared/pages/StaticPrivacyPolicy";
import StaticSupport from "./shared/pages/StaticSupport";

// Inner component that has access to useLocation
const AppRoutes = () => {
  return (
    <Routes>
      {/* Publicly accessible static pages */}
      <Route path="/privacy-policy" element={<RouteWrapper><StaticPrivacyPolicy /></RouteWrapper>} />
      <Route path="/support" element={<RouteWrapper><StaticSupport /></RouteWrapper>} />
      <Route path="/vendor/privacy-policy" element={<RouteWrapper><StaticPrivacyPolicy /></RouteWrapper>} />
      <Route path="/vendor/support" element={<RouteWrapper><StaticSupport /></RouteWrapper>} />
      <Route path="/delivery/privacy-policy" element={<RouteWrapper><StaticPrivacyPolicy /></RouteWrapper>} />
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
        <Route path="field-network/surveyors" element={<FieldAccounts key="surveyor" kind="surveyor" />} />
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
    initializePushNotifications();
    setupForegroundNotificationHandler((payload) => {
      console.log('App received foreground notification:', payload);
    });
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
        <AppRoutes />
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
