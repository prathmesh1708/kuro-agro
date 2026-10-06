import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import toast from "react-hot-toast";
import api from "../utils/api";
import logoImage from "../../assets/kuro-agro-logo.png";

const defaultSettings = {
  general: {
    storeName: "KuroAgro",
    storeLogo: logoImage,
    favicon: logoImage,
    contactEmail: "contact@example.com",
    contactPhone: "+1234567890",
    address: "",
    businessHours: "Mon-Fri 9AM-6PM",
    timezone: "UTC",
    currency: "INR",
    language: "en",
    socialMedia: {
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
    },
    accentColor: "#C9922A",
    storeDescription: "",
  },
  payment: {
    paymentMethods: ["cod", "card", "wallet"],
    codEnabled: true,
    cardEnabled: true,
    walletEnabled: true,
    upiEnabled: false,
    paymentGateway: "stripe",
    stripePublicKey: "",
    stripeSecretKey: "",
    paymentFees: {
      cod: 0,
      card: 2.5,
      wallet: 1.5,
      upi: 0.5,
    },
  },
  shipping: {
    shippingZones: [],
    freeShippingThreshold: 100,
    defaultShippingRate: 5,
    shippingMethods: ["standard", "express"],
  },
  orders: {
    cancellationTimeLimit: 24, // hours
    minimumOrderValue: 0,
    orderTrackingEnabled: true,
    orderConfirmationEmail: true,
    orderStatuses: [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ],
  },
  customers: {
    guestCheckoutEnabled: true,
    registrationRequired: false,
    emailVerificationRequired: false,
    customerAccountFeatures: {
      orderHistory: true,
      wishlist: true,
      addresses: true,
    },
  },
  products: {
    itemsPerPage: 12,
    gridColumns: 4,
    defaultSort: "popularity",
    lowStockThreshold: 10,
    outOfStockBehavior: "show", // 'hide' or 'show'
    stockAlertsEnabled: true,
  },
  tax: {
    defaultTaxRate: 18,
    taxCalculationMethod: "exclusive", // 'inclusive' or 'exclusive'
    priceDisplayFormat: "INR", // Currency format
  },
  content: {
    privacyPolicy: "",
    termsConditions: "",
    refundPolicy: "",
  },
  features: {
    wishlistEnabled: true,
    reviewsEnabled: true,
    flashSaleEnabled: true,
    dailyDealsEnabled: true,
    liveChatEnabled: true,
    couponCodesEnabled: true,
  },
  homepage: {
    heroBannerEnabled: true,
    sections: {
      mostPopular: { enabled: true, order: 1 },
      trending: { enabled: true, order: 2 },
      flashSale: { enabled: true, order: 3 },
      dailyDeals: { enabled: true, order: 4 },
      recommended: { enabled: true, order: 5 },
    },
  },
  reviews: {
    moderationMode: "manual", // 'auto' or 'manual'
    purchaseRequired: true,
    displaySettings: {
      showAll: true,
      verifiedOnly: false,
      withPhotosOnly: false,
    },
  },
  email: {
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    fromEmail: "noreply@example.com",
    fromName: "KuroAgro",
  },
  notifications: {
    email: {
      orderConfirmation: true,
      shippingUpdate: true,
      deliveryUpdate: true,
    },
    smsEnabled: false,
    pushEnabled: false,
    admin: {
      newOrders: true,
      lowStock: true,
    },
  },
  seo: {
    metaTitle: "Appzeto E-commerce - Shop Online",
    metaDescription: "Shop the latest trends and products",
    metaKeywords: "ecommerce, shopping, online store",
    ogImage: logoImage,
    canonicalUrl: "",
  },
  theme: {
    primaryColor: "#10B981",
    secondaryColor: "#3B82F6",
    fontFamily: "Inter",
  },
};

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      isLoading: false,

      // Load settings from the server. Admin pages get every section; the storefront gets
      // only the public sections (no payment keys or SMTP passwords).
      initialize: async () => {
        set({ isLoading: true });
        try {
          const isAdminArea =
            typeof window !== "undefined" &&
            window.location.pathname.startsWith("/admin");
          const response = await api.get(isAdminArea ? "/admin/settings" : "/settings");
          const serverSettings = response?.data || {};
          const merged = { ...defaultSettings };
          for (const [section, value] of Object.entries(serverSettings)) {
            merged[section] = { ...(defaultSettings[section] || {}), ...value };
          }
          set({ settings: merged, isLoading: false });
        } catch {
          // Keep the cached settings if the server is unreachable.
          set({ isLoading: false });
        }
      },

      // Get settings
      getSettings: () => {
        const state = get();
        if (!state.settings) {
          state.initialize();
        }
        return get().settings;
      },

      // Update one settings section and save it to the server.
      updateSettings: (category, settingsData) => {
        const previousSettings = get().settings;
        const updatedSettings = {
          ...previousSettings,
          [category]: {
            ...previousSettings[category],
            ...settingsData,
          },
        };
        set({ settings: updatedSettings, isLoading: true });

        api
          .put("/admin/settings", { [category]: updatedSettings[category] })
          .then(() => {
            set({ isLoading: false });
            toast.success("Settings saved", { id: "settings-saved" });
          })
          .catch(() => {
            // Roll back so the screen matches what is saved; the api interceptor shows the error.
            set({ settings: previousSettings, isLoading: false });
          });

        return updatedSettings;
      },
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
