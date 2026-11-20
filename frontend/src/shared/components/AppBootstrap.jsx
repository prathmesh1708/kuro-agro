import { useEffect } from "react";
import api from "../utils/api";

const PRODUCTS_CACHE_KEY = "user-catalog-products-cache";
const VENDORS_CACHE_KEY = "user-catalog-vendors-cache";
const BRANDS_CACHE_KEY = "user-catalog-brands-cache";

const normalizeProduct = (raw) => {
  const vendorObj =
    raw?.vendorId && typeof raw.vendorId === "object" ? raw.vendorId : null;
  const brandObj =
    raw?.brandId && typeof raw.brandId === "object" ? raw.brandId : null;
  const categoryObj =
    raw?.categoryId && typeof raw.categoryId === "object" ? raw.categoryId : null;

  return {
    ...raw,
    id: raw?._id || raw?.id,
    vendorId: vendorObj?._id || raw?.vendorId,
    brandId: brandObj?._id || raw?.brandId,
    categoryId: categoryObj?._id || raw?.categoryId,
    vendorName: raw?.vendorName || vendorObj?.storeName || "",
    brandName: raw?.brandName || brandObj?.name || "",
    categoryName: raw?.categoryName || categoryObj?.name || "",
    image: raw?.image || raw?.images?.[0] || "",
    images: Array.isArray(raw?.images) ? raw.images : raw?.image ? [raw.image] : [],
  };
};

const normalizeVendor = (raw) => ({
  ...raw,
  id: raw?._id || raw?.id,
});

const normalizeBrand = (raw) => ({
  ...raw,
  id: raw?._id || raw?.id,
});

// Writes the list to localStorage and reports whether the stored data actually changed.
const writeCache = (key, list) => {
  try {
    const next = JSON.stringify(list);
    if (localStorage.getItem(key) === next) return false;
    localStorage.setItem(key, next);
    return true;
  } catch {
    return false;
  }
};

// Only sync once per page load (StrictMode mounts effects twice in development).
let hasSynced = false;

const AppBootstrap = () => {
  useEffect(() => {
    if (hasSynced) return undefined;

    const syncCatalog = async () => {
      hasSynced = true;
      try {
        const [productsRes, vendorsRes, brandsRes] = await Promise.allSettled([
          api.get("/products", { params: { page: 1, limit: 500 } }),
          api.get("/vendors/all", { params: { status: "approved", page: 1, limit: 200 } }),
          api.get("/brands/all"),
        ]);

        let changed = false;

        if (productsRes.status === "fulfilled") {
          const payload = productsRes.value?.data;
          const list = Array.isArray(payload?.products)
            ? payload.products.map(normalizeProduct)
            : [];
          changed = writeCache(PRODUCTS_CACHE_KEY, list) || changed;
        }

        if (vendorsRes.status === "fulfilled") {
          const payload = vendorsRes.value?.data;
          const list = Array.isArray(payload?.vendors)
            ? payload.vendors.map(normalizeVendor)
            : [];
          changed = writeCache(VENDORS_CACHE_KEY, list) || changed;
        }

        if (brandsRes.status === "fulfilled") {
          const payload = brandsRes.value?.data;
          const list = Array.isArray(payload) ? payload.map(normalizeBrand) : [];
          changed = writeCache(BRANDS_CACHE_KEY, list) || changed;
        }

        // Pages re-render from the cache on this event, so only fire it when data changed.
        if (changed) {
          window.dispatchEvent(new Event("catalog-cache-updated"));
        }
      } catch {
        // Keep the last cached catalog if the API is unreachable.
      }
    };

    // Let the current page load its own data first; sync the full catalog when idle.
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(syncCatalog, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(syncCatalog, 1500);
    return () => clearTimeout(id);
  }, []);

  return null;
};

export default AppBootstrap;
