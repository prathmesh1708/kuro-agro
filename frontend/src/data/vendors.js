// Catalog data now comes from the API (see AppBootstrap and catalogData). This stays empty so
// legacy helpers keep their signatures without showing placeholder products.
export const vendors = [];

const normalizeId = (value) => String(value ?? "").trim();

// Get vendor by ID
export const getVendorById = (id) => {
  const targetId = normalizeId(id);
  return vendors.find((v) => normalizeId(v.id) === targetId);
};

// Get vendors by status
export const getVendorsByStatus = (status) => {
  return vendors.filter((v) => v.status === status);
};

// Get approved vendors only
export const getApprovedVendors = () => {
  return vendors.filter((v) => v.status === "approved");
};

// Get vendor products (will be used with products data)
export const getVendorProducts = (vendorId) => {
  // This will be used in conjunction with products.js
  // Products will have vendorId field
  return [];
};

// Get vendor orders (will be used with orders data)
export const getVendorOrders = (vendorId) => {
  // This will be used in conjunction with orderStore.js
  // Orders will have vendorItems array
  return [];
};
