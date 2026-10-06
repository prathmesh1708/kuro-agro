import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  FiMapPin,
  FiCreditCard,
  FiTruck,
  FiCheck,
  FiX,
  FiPlus,
  FiEdit2,
  FiArrowLeft,
  FiShoppingBag,
  FiTag,
  FiAlertTriangle,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { FiLock } from "react-icons/fi";
import { useCartStore } from "../../../shared/store/useStore";
import { useAuthStore } from "../../../shared/store/authStore";
import { useAddressStore } from "../../../shared/store/addressStore";
import { useOrderStore } from "../../../shared/store/orderStore";
import { useLocationStore } from "../../../shared/store/locationStore";
import { formatPrice } from "../../../shared/utils/helpers";
import api from "../../../shared/utils/api";
import toast from "react-hot-toast";
import MobileLayout from "../components/Layout/MobileLayout";
import MobileCheckoutSteps from "../components/Mobile/MobileCheckoutSteps";
import PageTransition from "../../../shared/components/PageTransition";
import OrderSummary from "../components/Mobile/CheckoutOrderSummary";
import { loadRazorpaySDK } from "../../../shared/utils/razorpay";

const MobileCheckout = () => {
  const navigate = useNavigate();
  const { items, getTotal, clearCart, getItemsByVendor } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const { addresses, getDefaultAddress, addAddress, updateAddress, fetchAddresses } = useAddressStore();
  const setLocationFromAddress = useLocationStore((state) => state.setLocationFromAddress);
  const { createOrder, verifyRazorpayPayment, cancelOrder } = useOrderStore();

  // Group items by vendor
  const itemsByVendor = useMemo(
    () => getItemsByVendor(),
    [items, getItemsByVendor]
  );

  const [step, setStep] = useState(1);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [editingAddress, setEditingAddress] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [shippingOption, setShippingOption] = useState("standard");
  const [estimatedShipping, setEstimatedShipping] = useState(null);
  const [isEstimatingShipping, setIsEstimatingShipping] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    zipCode: "",
    state: "",
    country: "",
    paymentMethod: "online",
  });

  useEffect(() => {
    if (isAuthenticated) {
      fetchAddresses().catch(() => null);
      // Fetch latest profile state to sync COD blacklist status
      api.get("/user/auth/profile")
        .then((response) => {
          const payload = response?.data?.data || response?.data || response;
          if (payload && useAuthStore.getState().user) {
            useAuthStore.setState({
              user: {
                ...useAuthStore.getState().user,
                ...payload
              }
            });
          }
        })
        .catch(() => null);
    }
  }, [isAuthenticated, fetchAddresses]);

  useEffect(() => {
    let cancelled = false;
    const fetchCoupons = async () => {
      try {
        const response = await api.get("/coupons/available");
        const payload = response?.data ?? response;
        if (!cancelled) {
          setAvailableCoupons(Array.isArray(payload) ? payload : []);
        }
      } catch {
        if (!cancelled) {
          setAvailableCoupons([]);
        }
      }
    };

    fetchCoupons();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      }));

      const defaultAddress = getDefaultAddress();
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
        setFormData((prev) => ({
          ...prev,
          name: defaultAddress.fullName || user.name || "",
          email: user.email || "",
          phone: defaultAddress.phone || user.phone || "",
          address: defaultAddress.address || "",
          city: defaultAddress.city || "",
          zipCode: defaultAddress.zipCode || "",
          state: defaultAddress.state || "",
          country: defaultAddress.country || "",
        }));
      }
    }
  }, [isAuthenticated, user, getDefaultAddress, addresses]);

  const calculateShippingFallback = () => {
    const total = getTotal();
    if (appliedCoupon?.type === "freeship") {
      return 0;
    }
    if (total >= 100) {
      return 0;
    }
    if (shippingOption === "express") {
      return 100;
    }
    return 50;
  };

  const [gstResult, setGstResult] = useState(null);

  useEffect(() => {
    const fetchCartGst = async () => {
      if (items.length === 0) {
        setGstResult(null);
        return;
      }
      try {
        const bodyItems = items.map(item => ({
          productId: item.id || item.productId,
          quantity: item.quantity,
          price: item.price,
          variant: item.variant || {},
          categoryId: item.categoryId || null
        }));
        const response = await api.post('/cart/gst-preview', { items: bodyItems });
        const payload = response.data ?? response;
        if (payload) {
          setGstResult(payload);
        }
      } catch (err) {
        console.error("Failed to fetch cart GST preview:", err);
      }
    };
    fetchCartGst();
  }, [items]);

  const total = getTotal();
  const shipping =
    typeof estimatedShipping === "number"
      ? estimatedShipping
      : calculateShippingFallback();
  const discount = appliedCoupon ? appliedDiscount : 0;

  // Calculate dynamic GST matching backend discount proportions
  let tax = 0;
  if (gstResult && gstResult.items) {
    const discountRatio = total > 0 ? (discount / total) : 0;
    let totalTax = 0;
    gstResult.items.forEach(item => {
      const itemSubtotal = item.price * item.quantity;
      const itemDiscount = itemSubtotal * discountRatio;
      const taxableAmount = Math.max(0, itemSubtotal - itemDiscount);
      const rate = item.gstSnapshot?.rate ?? 18;
      const taxIncluded = item.gstSnapshot?.taxIncluded ?? false;
      const calc = (taxableAmount * (rate / 100)) / (taxIncluded ? (1 + rate / 100) : 1);
      totalTax += calc;
    });
    tax = parseFloat(totalTax.toFixed(2));
  } else {
    const taxableAmount = Math.max(0, total - discount);
    tax = parseFloat((taxableAmount * 0.18).toFixed(2));
  }

  const finalTotal = parseFloat(Math.max(0, total + shipping + tax - discount).toFixed(2));

  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null);
      setAppliedDiscount(0);
    }
  }, [total, appliedCoupon]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      const validItems = items
        .map((item) => ({
          productId: item?.id,
          quantity: Number(item?.quantity || 1),
          variant: item?.variant || undefined,
        }))
        .filter((item) => item.productId);

      if (!validItems.length) {
        if (active) setEstimatedShipping(0);
        return;
      }

      setIsEstimatingShipping(true);
      try {
        const response = await api.post("/shipping/estimate", {
          items: validItems,
          shippingAddress: {
            country: String(formData.country || "").trim(),
          },
          shippingOption,
          couponType: appliedCoupon?.type || null,
        });

        const payload = response?.data ?? response;
        const nextShipping = Number(payload?.shipping);
        if (active) {
          setEstimatedShipping(Number.isFinite(nextShipping) ? nextShipping : null);
        }
      } catch {
        if (active) {
          setEstimatedShipping(null);
        }
      } finally {
        if (active) {
          setIsEstimatingShipping(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [items, formData.country, shippingOption, appliedCoupon?.type]);

  const handleApplyCoupon = async (codeOverride = "") => {
    const normalizedCode = String(codeOverride || couponCode).trim().toUpperCase();
    if (!normalizedCode) {
      toast.error("Please enter a coupon code");
      return;
    }

    setIsApplyingCoupon(true);
    try {
      const response = await api.post("/coupons/validate", {
        code: normalizedCode,
        cartTotal: total,
      });
      const payload = response?.data ?? response;
      const coupon = payload?.coupon;
      const discountAmount = Number(payload?.discount || 0);

      if (!coupon) {
        throw new Error("Invalid coupon response");
      }

      setCouponCode(coupon.code || normalizedCode);
      setAppliedCoupon(coupon);
      setAppliedDiscount(discountAmount);
      toast.success(`Coupon "${coupon.code}" applied!`);
    } catch {
      setAppliedCoupon(null);
      setAppliedDiscount(0);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleSelectAddress = (address) => {
    if (!address) return;
    const addrId = address.id || address._id;
    setSelectedAddressId(addrId);
    setLocationFromAddress(address);
    setFormData((prev) => ({
      ...prev,
      name: address.fullName || address.name || prev.name,
      phone: address.phone || prev.phone,
      address: address.address || prev.address,
      city: address.city || prev.city,
      zipCode: address.zipCode || prev.zipCode,
      state: address.state || prev.state,
      country: address.country || prev.country || "India",
    }));
  };

  const handleOpenAddAddress = () => {
    setEditingAddress(null);
    setShowAddressForm(true);
  };

  const handleOpenEditAddress = (addr, e) => {
    e?.stopPropagation();
    setEditingAddress(addr);
    setShowAddressForm(true);
  };

  const handleSaveAddressModal = async (addressData) => {
    try {
      if (editingAddress) {
        const addrId = editingAddress.id || editingAddress._id;
        const updated = await updateAddress(addrId, addressData);
        handleSelectAddress(updated || { ...addressData, id: addrId });
        toast.success("Address updated successfully!");
      } else {
        const created = await addAddress(addressData);
        handleSelectAddress(created || addressData);
        toast.success("New address saved and selected!");
      }
      setShowAddressForm(false);
      setEditingAddress(null);
    } catch (error) {
      toast.error(error?.message || "Failed to save address");
    }
  };

  if (items.length === 0) {
    return (
      <PageTransition>
        <MobileLayout showBottomNav={false} showCartBar={false}>
          <div className="flex items-center justify-center min-h-[60vh] px-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Your cart is empty
              </h2>
              <button
                onClick={() => navigate("/home")}
                className="gradient-green text-white px-6 py-3 rounded-xl font-semibold">
                Continue Shopping
              </button>
            </div>
          </div>
        </MobileLayout>
      </PageTransition>
    );
  }

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalizedShipping = {
      name: String(formData.name || "").trim(),
      email: String(formData.email || user?.email || "").trim().toLowerCase(),
      phone: String(formData.phone || "").replace(/\D/g, "").slice(-10),
      address: String(formData.address || "").trim(),
      city: String(formData.city || "").trim(),
      zipCode: String(formData.zipCode || "").trim(),
      state: String(formData.state || "").trim(),
      country: String(formData.country || "").trim() || "India",
    };

    const missingRequired = Object.values(normalizedShipping).some((v) => !v);
    if (missingRequired) {
      toast.error("Please fill all shipping details correctly.");
      return;
    }

    if (normalizedShipping.phone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }

    if (step === 2 && isApplyingCoupon) {
      toast.error("Please wait for coupon validation to complete.");
      return;
    }
    if (step === 2 && isPlacingOrder) {
      return;
    }

    if (step === 1) {
      // Auto-save first address for authenticated user if no saved addresses exist
      if (isAuthenticated && addresses.length === 0) {
        addAddress({
          name: "Home",
          fullName: normalizedShipping.name,
          phone: normalizedShipping.phone,
          address: normalizedShipping.address,
          city: normalizedShipping.city,
          state: normalizedShipping.state,
          zipCode: normalizedShipping.zipCode,
          country: normalizedShipping.country,
          isDefault: true,
        }).catch(() => {});
      }
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    } else if (step === 2) {
      setIsPlacingOrder(true);

      try {
        const order = await createOrder({
          userId: isAuthenticated ? user?.id : null,
          items: items,
          shippingAddress: normalizedShipping,
          paymentMethod: formData.paymentMethod,
          subtotal: total,
          shipping: shipping,
          tax: tax,
          discount: discount,
          total: finalTotal,
          couponCode: appliedCoupon ? (appliedCoupon.code || couponCode.trim().toUpperCase()) : null,
          shippingOption,
        });

        if (formData.paymentMethod === "online" && order?.razorpay) {
          const isSDKLoaded = await loadRazorpaySDK();
          if (!isSDKLoaded) {
            toast.error("Failed to load Razorpay payment gateway. Please check your connection.");
            setIsPlacingOrder(false);
            return;
          }

          const options = {
            key: order.razorpay.razorpayKeyId,
            amount: order.razorpay.amount,
            currency: order.razorpay.currency || "INR",
            name: "Raathi Store",
            description: `Order #${order.id}`,
            order_id: order.razorpay.razorpayOrderId,
            prefill: {
              name: normalizedShipping.name,
              email: normalizedShipping.email,
              contact: normalizedShipping.phone,
            },
            theme: {
              color: "#16a34a",
            },
            handler: async function (response) {
              try {
                await verifyRazorpayPayment({
                  orderId: order.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });
                clearCart();
                toast.success("Payment successful! Order placed.");
                navigate(`/order-confirmation/${order.id}`);
              } catch (verifyErr) {
                toast.error(verifyErr?.message || "Payment verification failed.");
                await cancelOrder(order.id, "Payment verification failed");
                setIsPlacingOrder(false);
              }
            },
            modal: {
              onDismiss: async function () {
                toast.error("Payment cancelled. Order was cancelled to release stock.");
                try {
                  await cancelOrder(order.id, "Payment cancelled by customer");
                } catch {
                  // silent catch if already cancelled
                }
                setIsPlacingOrder(false);
              },
            },
          };

          const rzp = new window.Razorpay(options);
          rzp.on("payment.failed", async function (response) {
            toast.error(response?.error?.description || "Payment failed.");
            try {
              await cancelOrder(order.id, "Payment failed");
            } catch {
              // silent catch
            }
            setIsPlacingOrder(false);
          });
          rzp.open();
        } else {
          // COD flow
          clearCart();
          toast.success("Order placed successfully!");
          navigate(`/order-confirmation/${order.id}`);
          setIsPlacingOrder(false);
        }
      } catch (error) {
        toast.error(error?.message || "Failed to place order");
        setIsPlacingOrder(false);
      }
    }
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={false}>
        <div className="w-full pb-24 min-h-screen bg-gray-50">
          {/* Header */}
          <div className="bg-[#E8E2FF] border-b border-purple-100 sticky top-0 z-30 shadow-sm">
            {/* Title Bar */}
            <div className="px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <FiArrowLeft className="text-xl text-gray-700" />
              </button>
              <h1 className="text-xl font-bold text-gray-800">Checkout</h1>
            </div>
            {/* Steps Bar */}
            <div className="px-4 pb-3">
              <MobileCheckoutSteps currentStep={step} totalSteps={2} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="lg:px-4 lg:py-6">
            <div className="lg:grid lg:grid-cols-12 lg:gap-8">
              {/* Left Column - Steps */}
              <div className="lg:col-span-8 space-y-6">
                {/* Step 1: Shipping Information */}
                {step === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="px-4 py-4 lg:p-0 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <FiTruck className="text-primary-600" />
                        {isAuthenticated && addresses.length > 0 ? "Select Delivery Address" : "Shipping Information"}
                      </h2>
                      {isAuthenticated && addresses.length > 0 && (
                        <button
                          type="button"
                          onClick={handleOpenAddAddress}
                          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-xl border border-primary-200 transition-all shadow-sm">
                          <FiPlus className="text-base" />
                          Add New Address
                        </button>
                      )}
                    </div>

                    {/* Saved Addresses Cards */}
                    {isAuthenticated && addresses.length > 0 ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {addresses.map((address) => {
                            const addrId = address.id || address._id;
                            const isSelected = String(selectedAddressId) === String(addrId);
                            return (
                              <div
                                key={addrId}
                                onClick={() => handleSelectAddress(address)}
                                className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                                  isSelected
                                    ? "border-primary-500 bg-primary-50/40 shadow-md shadow-primary-500/5 ring-2 ring-primary-500/20"
                                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                                }`}>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                      isSelected ? "border-primary-600 bg-primary-600" : "border-gray-300"
                                    }`}>
                                      {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                                    </span>
                                    <span className="font-bold text-gray-800 text-sm">
                                      {address.name || "Address"}
                                    </span>
                                    {address.isDefault && (
                                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 font-bold text-[10px] rounded-md uppercase tracking-wider">
                                        Default
                                      </span>
                                    )}
                                  </div>

                                  {/* Edit Address Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenEditAddress(address, e)}
                                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-white rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                                    title="Edit this address">
                                    <FiEdit2 className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Edit</span>
                                  </button>
                                </div>

                                <div className="pl-6 space-y-1">
                                  <p className="text-sm font-bold text-gray-900">
                                    {address.fullName}
                                  </p>
                                  <p className="text-xs text-gray-600 leading-relaxed">
                                    {address.address}
                                  </p>
                                  <p className="text-xs text-gray-600 font-medium">
                                    {address.city}, {address.state} - {address.zipCode}
                                  </p>
                                  <p className="text-xs text-gray-500 pt-1 flex items-center gap-1">
                                    <span>📞</span> {address.phone}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Add Another Delivery Address Button Card */}
                        <div
                          onClick={handleOpenAddAddress}
                          className="p-4 rounded-2xl border-2 border-dashed border-gray-300 hover:border-primary-500 bg-gray-50/60 hover:bg-primary-50/20 cursor-pointer transition-all flex items-center justify-center gap-2 text-gray-600 hover:text-primary-700 font-bold text-sm py-4">
                          <FiPlus className="text-lg" />
                          <span>Add Another Delivery Address</span>
                        </div>
                      </div>
                    ) : (
                      /* Address Form for Guests or Users with No Saved Addresses */
                      <div className="space-y-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm lg:p-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                            placeholder="Recipient's full name"
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Email Address *
                            </label>
                            <input
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleInputChange}
                              required
                              placeholder="Order confirmation email"
                              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Phone Number (10 digits) *
                            </label>
                            <input
                              type="tel"
                              name="phone"
                              value={formData.phone}
                              onChange={handleInputChange}
                              required
                              maxLength={10}
                              placeholder="10-digit mobile number"
                              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Street Address *
                          </label>
                          <textarea
                            name="address"
                            value={formData.address}
                            onChange={handleInputChange}
                            required
                            rows={3}
                            placeholder="Flat, House no., Building, Apartment, Street"
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              City *
                            </label>
                            <input
                              type="text"
                              name="city"
                              value={formData.city}
                              onChange={handleInputChange}
                              required
                              placeholder="City"
                              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              State *
                            </label>
                            <input
                              type="text"
                              name="state"
                              value={formData.state}
                              onChange={handleInputChange}
                              required
                              placeholder="State"
                              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              ZIP / PIN Code *
                            </label>
                            <input
                              type="text"
                              name="zipCode"
                              value={formData.zipCode}
                              onChange={handleInputChange}
                              required
                              placeholder="PIN Code"
                              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Country *
                            </label>
                            <input
                              type="text"
                              name="country"
                              value={formData.country || "India"}
                              onChange={handleInputChange}
                              required
                              placeholder="Country"
                              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                            />
                          </div>
                        </div>
                        {isAuthenticated && (
                          <p className="text-xs text-primary-600 bg-primary-50 p-2.5 rounded-xl border border-primary-100 font-medium">
                            💡 This address will be saved to your account for 1-click checkout on your next orders.
                          </p>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Step 2: Payment */}
                {step === 2 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="px-4 py-4 lg:p-0">
                    {/* Delivery Destination Summary Preview */}
                    <div className="mb-4 p-4 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600 mt-0.5 flex-shrink-0">
                          <FiMapPin className="text-lg" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Delivering to</span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 truncate">
                              {formData.name}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm font-semibold text-gray-800 mt-1 line-clamp-2">
                            {formData.address}, {formData.city}, {formData.state} - {formData.zipCode}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 font-medium">
                            📞 {formData.phone}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-3 py-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl border border-primary-200 transition-colors flex-shrink-0"
                      >
                        Change
                      </button>
                    </div>

                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <FiCreditCard className="text-primary-600" />
                      Payment Method
                    </h2>

                    {user?.codStats?.warningCount > 0 && !user?.codStats?.isCodBlacklisted && (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm flex items-start gap-2">
                        <FiAlertTriangle className="text-yellow-600 text-lg mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-bold">Active Account Warnings</p>
                          <p className="text-xs text-yellow-700 mt-0.5">
                            You have received {user.codStats.warningCount} warning(s) regarding Cash on Delivery cancellations. 
                            Please complete your future COD orders. Accounts exceeding a 40% cancellation rate will have Cash on Delivery disabled.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="space-y-3 mb-6">
                      {[
                        { id: "online", label: "Online Payment", subtext: "UPI, Cards, NetBanking, Wallets via Razorpay" },
                        { id: "cod", label: "Cash on Delivery", subtext: "Pay with cash upon delivery" }
                      ].map((option) => {
                        const isCod = option.id === "cod";
                        const isBlacklisted = isCod && user?.codStats?.isCodBlacklisted;
                        const isSelected = formData.paymentMethod === option.id;
                        
                        return (
                          <label
                            key={option.id}
                            className={`flex flex-col p-4 rounded-xl border-2 transition-all ${
                              isBlacklisted 
                                ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed" 
                                : isSelected
                                  ? "border-primary-500 bg-primary-50 cursor-pointer"
                                  : "border-gray-200 cursor-pointer hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="paymentMethod"
                                value={option.id}
                                checked={isSelected}
                                onChange={handleInputChange}
                                disabled={isBlacklisted}
                                className="w-5 h-5 text-primary-500"
                              />
                              <div>
                                <span className="font-semibold text-gray-800 text-base">
                                  {option.label}
                                </span>
                                {option.subtext && (
                                  <p className="text-xs text-gray-500 mt-0.5">{option.subtext}</p>
                                )}
                              </div>
                            </div>
                            {isBlacklisted && (
                              <p className="mt-2 text-sm text-red-600 font-medium">
                                Cash on Delivery is currently unavailable due to high cancellation rates. Please complete your payment online.
                              </p>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {/* Shipping Options */}
                    {total < 100 && (
                      <div className="mb-6">
                        <h3 className="text-base font-semibold text-gray-800 mb-3">
                          Shipping Options
                        </h3>
                        <div className="space-y-3">
                          <label
                            className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${shippingOption === "standard"
                              ? "border-primary-500 bg-primary-50"
                              : "border-gray-200"
                              }`}>
                            <div>
                              <input
                                type="radio"
                                name="shippingOption"
                                value="standard"
                                checked={shippingOption === "standard"}
                                onChange={(e) => setShippingOption(e.target.value)}
                                className="w-5 h-5 text-primary-500 mr-3"
                              />
                              <span className="font-semibold text-gray-800 text-base">
                                Standard Shipping
                              </span>
                              <p className="text-xs text-gray-600">
                                5-7 business days
                              </p>
                            </div>
                            <span className="font-bold text-gray-800">
                              {formatPrice(50)}
                            </span>
                          </label>
                          <label
                            className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${shippingOption === "express"
                              ? "border-primary-500 bg-primary-50"
                              : "border-gray-200"
                              }`}>
                            <div>
                              <input
                                type="radio"
                                name="shippingOption"
                                value="express"
                                checked={shippingOption === "express"}
                                onChange={(e) => setShippingOption(e.target.value)}
                                className="w-5 h-5 text-primary-500 mr-3"
                              />
                              <span className="font-semibold text-gray-800 text-base">
                                Express Shipping
                              </span>
                              <p className="text-xs text-gray-600">
                                2-3 business days
                              </p>
                            </div>
                            <span className="font-bold text-gray-800">
                              {formatPrice(100)}
                            </span>
                          </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {isEstimatingShipping
                            ? "Updating shipping estimate..."
                            : `Estimated shipping: ${formatPrice(shipping)}`}
                        </p>
                      </div>
                    )}

                    {/* Coupon Code */}
                    <div className="mb-6">
                      <h3 className="text-base font-semibold text-gray-800 mb-3">
                        Coupon Code
                      </h3>
                      {!appliedCoupon ? (
                        <>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value)}
                              placeholder="Enter code"
                              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                            />
                            <button
                              type="button"
                              onClick={() => handleApplyCoupon()}
                              disabled={isApplyingCoupon}
                              className="px-4 py-3 gradient-green text-white rounded-xl font-semibold hover:shadow-glow-green transition-all">
                              {isApplyingCoupon ? "Applying..." : "Apply"}
                            </button>
                          </div>
                          {availableCoupons.length > 0 && (
                            <div className="mt-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                              <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                <FiTag className="text-primary-600" />
                                Available coupons
                              </h4>
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {availableCoupons.slice(0, 8).map((coupon) => (
                                  <button
                                    key={coupon._id || coupon.code}
                                    type="button"
                                    onClick={() => handleApplyCoupon(coupon.code)}
                                    disabled={isApplyingCoupon}
                                    className="w-full text-left p-2 bg-white rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
                                  >
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-semibold text-gray-800">{coupon.code}</p>
                                      <p className="text-xs font-semibold text-primary-700">
                                        {coupon.type === "percentage"
                                          ? `${coupon.value}% OFF`
                                          : coupon.type === "fixed"
                                            ? `${formatPrice(coupon.value)} OFF`
                                            : "Free Shipping"}
                                      </p>
                                    </div>
                                    <p className="text-xs text-gray-600">
                                      Min order: {formatPrice(coupon.minOrderValue || 0)}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                          <div>
                            <p className="text-sm font-semibold text-green-800">
                              {appliedCoupon.code || "Coupon"} Applied
                            </p>
                            <p className="text-xs text-green-600">
                              Code: {couponCode}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAppliedCoupon(null);
                              setAppliedDiscount(0);
                              setCouponCode("");
                            }}
                            className="text-red-600 hover:text-red-700">
                            <FiX className="text-lg" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Order Summary (Mobile Only) */}
                    <div className="glass-card rounded-xl p-4 lg:hidden">
                      <OrderSummary
                        itemsByVendor={itemsByVendor}
                        total={total}
                        discount={discount}
                        shipping={shipping}
                        tax={tax}
                        finalTotal={finalTotal}
                        formatPrice={formatPrice}
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Right Column - Desktop Order Summary */}
              <div className="hidden lg:block lg:col-span-4">
                <div className="sticky top-24 space-y-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <OrderSummary
                      itemsByVendor={itemsByVendor}
                      total={total}
                      discount={discount}
                      shipping={shipping}
                      tax={tax}
                      finalTotal={finalTotal}
                      formatPrice={formatPrice}
                    />
                    <div className="p-4 border-t border-gray-100 bg-gray-50">
                      <button
                        type="submit"
                        disabled={step === 2 && isPlacingOrder}
                        className="w-full gradient-green text-white py-3.5 rounded-xl font-bold text-lg shadow-lg hover:shadow-glow-green transition-all duration-300 transform hover:-translate-y-0.5">
                        {step === 2 ? (isPlacingOrder ? "Placing Order..." : "Place Order") : "Continue to Payment"}
                      </button>
                      {step === 2 && (
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="w-full mt-3 py-2 text-gray-500 font-semibold hover:text-gray-700 transition-colors text-sm">
                          Back to Shipping
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Trust Badges or Info */}
                  <div className="flex justify-center gap-4 text-gray-400 text-2xl pt-2 opacity-70">
                    <FiLock className="w-6 h-6" />
                    <span className="text-xs text-gray-500">Secure Checkout</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Buttons (Mobile Fixed Bottom) */}
            <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40 safe-area-bottom lg:hidden">
              <div className="flex gap-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors">
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={step === 2 && isPlacingOrder}
                  className="flex-1 gradient-green text-white py-3 rounded-xl font-semibold hover:shadow-glow-green transition-all duration-300">
                  {step === 2 ? (isPlacingOrder ? "Placing..." : "Place Order") : "Continue"}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Address Form Modal (Add / Edit) */}
        <AnimatePresence>
          {showAddressForm && (
            <AddressFormModal
              initialData={editingAddress}
              onSubmit={handleSaveAddressModal}
              onCancel={() => {
                setShowAddressForm(false);
                setEditingAddress(null);
              }}
            />
          )}
        </AnimatePresence>
      </MobileLayout>
    </PageTransition>
  );
};

// Address Form Modal Component (Supports Add and Edit)
const AddressFormModal = ({ onSubmit, onCancel, initialData }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || "Home",
    fullName: initialData?.fullName || "",
    phone: initialData?.phone || "",
    address: initialData?.address || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    zipCode: initialData?.zipCode || "",
    country: initialData?.country || "India",
    isDefault: Boolean(initialData?.isDefault),
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.phone.trim() || !formData.address.trim() || !formData.city.trim() || !formData.state.trim() || !formData.zipCode.trim()) {
      toast.error("Please fill all required address fields.");
      return;
    }
    if (formData.phone.replace(/\D/g, "").length !== 10) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }
    onSubmit(formData);
  };

  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-[10000] flex items-end sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden"
      onClick={onCancel}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800">
            {initialData ? "Edit Delivery Address" : "Add New Delivery Address"}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <FiX className="text-xl" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="space-y-3.5 overflow-y-auto pr-1 pb-6 flex-1">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                Address Type / Label
              </label>
              <div className="flex gap-2">
                {["Home", "Work", "Other"].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, name: label }))}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      formData.name === label
                        ? "bg-primary-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                Full Name *
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                placeholder="Recipient's full name"
                className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                Phone Number (10 digits) *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                maxLength={10}
                placeholder="10-digit mobile number"
                className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                Street Address *
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                rows={2}
                placeholder="Flat, House no., Building, Apartment, Street"
                className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                  City *
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  placeholder="City"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                  State *
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  required
                  placeholder="State"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                  ZIP / PIN Code *
                </label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  required
                  placeholder="PIN Code"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                  Country *
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  required
                  placeholder="Country"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={formData.isDefault}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                />
                <span>Set as default delivery address</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-100 bg-white flex-shrink-0">
            <button
              type="submit"
              className="flex-1 gradient-green text-white py-3.5 rounded-xl font-semibold hover:shadow-glow-green transition-all shadow-md">
              {initialData ? "Update Address" : "Save & Deliver Here"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );

  return createPortal(modalContent, document.body);
};


export default MobileCheckout;
