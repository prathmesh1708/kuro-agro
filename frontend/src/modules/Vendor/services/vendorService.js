import api from '../../../shared/utils/api';

// ─── AUTH ──────────────────────────────────────────────────────────────────────

/**
 * Register a new vendor (pending approval + OTP email sent)
 * @param {{ name, email, password, phone, storeName, storeDescription }} data
 */
export const registerVendor = (data) => {
    if (data instanceof FormData) {
        return api.post('/vendor/auth/register', data, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    }
    return api.post('/vendor/auth/register', data);
};

/**
 * Verify phone/email OTP after registration
 * @param {string} identifier (phone or email)
 * @param {string} otp
 */
export const verifyVendorOTP = (identifier, otp) => {
    const raw = String(identifier || '').trim();
    const digitsOnly = raw.replace(/\D/g, '');
    const isPhone = digitsOnly.length >= 10 && !raw.includes('@');
    const payload = isPhone
        ? { phone: digitsOnly.slice(-10), otp }
        : { email: raw.toLowerCase(), otp };
    return api.post('/vendor/auth/verify-otp', payload);
};

/**
 * Resend OTP to vendor phone/email
 * @param {string} identifier (phone or email)
 */
export const resendVendorOTP = (identifier) => {
    const raw = String(identifier || '').trim();
    const digitsOnly = raw.replace(/\D/g, '');
    const isPhone = digitsOnly.length >= 10 && !raw.includes('@');
    const payload = isPhone
        ? { phone: digitsOnly.slice(-10) }
        : { email: raw.toLowerCase() };
    return api.post('/vendor/auth/resend-otp', payload);
};

/**
 * Request reset OTP for vendor forgot password flow
 * @param {string} email
 */
export const forgotVendorPassword = (email) =>
    api.post('/vendor/auth/forgot-password', { email });

/**
 * Verify reset OTP
 * @param {string} email
 * @param {string} otp
 */
export const verifyVendorResetOTP = (email, otp) =>
    api.post('/vendor/auth/verify-reset-otp', { email, otp });

/**
 * Reset vendor password after reset OTP verification
 * @param {string} email
 * @param {string} password
 * @param {string} confirmPassword
 */
export const resetVendorPassword = (email, password, confirmPassword) =>
    api.post('/vendor/auth/reset-password', { email, password, confirmPassword });

/**
 * Login vendor — returns { accessToken, refreshToken, vendor }
 * @param {string} email
 * @param {string} password
 */
export const loginVendor = (email, password) =>
    api.post('/vendor/auth/login', { email, password });

/**
 * Get current vendor profile
 */
export const getVendorProfile = () => api.get('/vendor/auth/profile');

/**
 * Update vendor profile (name, phone, storeName, storeDescription, address)
 * @param {{ name?, phone?, storeName?, storeDescription?, address? }} data
 */
export const updateVendorProfile = (data) => api.put('/vendor/auth/profile', data);


// ─── PRODUCTS ──────────────────────────────────────────────────────────────────

/**
 * Get paginated products for the authenticated vendor
 * @param {{ page?, limit?, search?, stock? }} params
 */
export const getVendorProducts = (params = {}) =>
    api.get('/vendor/products', { params });

/**
 * Get single product details for the authenticated vendor
 * @param {string} id - MongoDB _id
 */
export const getVendorProductById = (id) =>
    api.get(`/vendor/products/${id}`);

/**
 * Create a new product
 * @param {object} data
 */
export const createVendorProduct = (data) => api.post('/vendor/products', data);

/**
 * Create a new brand by vendor
 * @param {object} data
 */
export const createVendorBrand = (data) => api.post('/vendor/brands', data);

/**
 * Update an existing product
 * @param {string} id  — MongoDB _id
 * @param {object} data
 */
export const updateVendorProduct = (id, data) =>
    api.put(`/vendor/products/${id}`, data);

export const resubmitVendorProduct = (id) =>
    api.post(`/vendor/products/${id}/resubmit`);

export const getVendorProductGst = (id) =>
    api.get(`/vendor/products/${id}/gst`);

export const getVendorGstSettings = () =>
    api.get('/vendor/gst-settings');

export const updateVendorGstSettings = (data) =>
    api.post('/vendor/gst-settings', data);

export const getCategoryDefaultGst = (categoryId) =>
    api.get(`/vendor/gst-settings/category/${categoryId}`);

export const getEffectiveGstPreview = (categoryId, price, taxIncluded, productId = "") =>
    api.get('/products/gst/effective', {
        params: { productId, categoryId, price, taxIncluded }
    });

/**
 * Delete a product
 * @param {string} id  — MongoDB _id
 */
export const deleteVendorProduct = (id) =>
    api.delete(`/vendor/products/${id}`);

export const deleteVendorProductsBulk = (productIds = null) =>
    api.delete('/vendor/products/bulk-delete-all', { data: { productIds } });

export const updateVendorStock = (productId, payload) => {
    const body = typeof payload === 'object' && payload !== null ? payload : { stockQuantity: payload };
    return api.patch(`/vendor/stock/${productId}`, body);
};

// ─── BULK UPLOAD ─────────────────────────────────────────────────────────────

/**
 * Download vendor bulk product upload Excel template
 */
export const downloadBulkTemplate = () =>
    api.get('/vendor/products/bulk/template', { responseType: 'blob' });

/**
 * Validate Excel file or manual grid JSON array for bulk upload
 * @param {FormData|object} data
 */
export const validateBulkProducts = (data) => {
    if (data instanceof FormData) {
        return api.post('/vendor/products/bulk/validate', data, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    }
    return api.post('/vendor/products/bulk/validate', data);
};

/**
 * Confirm and import validated products
 * @param {Array} products
 */
export const importBulkProducts = (products) =>
    api.post('/vendor/products/bulk/import', { products });

/**
 * Download Excel Error Report for failed rows
 * @param {Array} failedItems
 */
export const downloadBulkErrorReport = (failedItems) =>
    api.post('/vendor/products/bulk/error-report', { failedItems }, { responseType: 'blob' });



// ─── ORDERS ────────────────────────────────────────────────────────────────────

/**
 * Get paginated orders containing this vendor's items
 * @param {{ page?, limit?, status? }} params
 */
export const getVendorOrders = (params = {}) =>
    api.get('/vendor/orders', { params });

/**
 * Get all vendor orders by paging through the vendor orders endpoint.
 * Keeps UI accurate for large datasets.
 * @param {{ limit?: number, status?: string }} params
 */
export const getAllVendorOrders = async (params = {}) => {
    const pageSize = Math.max(Number.parseInt(params.limit, 10) || 100, 1);
    let page = 1;
    let pages = 1;
    let total = 0;
    const allOrders = [];

    do {
        const res = await getVendorOrders({ ...params, page, limit: pageSize });
        const payload = res?.data ?? res;
        const orders = Array.isArray(payload?.orders) ? payload.orders : [];
        allOrders.push(...orders);
        total = Number(payload?.total || allOrders.length);
        pages = Math.max(Number(payload?.pages || 1), 1);
        page += 1;
    } while (page <= pages);

    return {
        orders: allOrders,
        total,
        page: 1,
        pages,
    };
};

/**
 * Get a single order (by orderId or _id) for the authenticated vendor
 * @param {string} id
 */
export const getVendorOrderById = (id) =>
    api.get(`/vendor/orders/${id}`);

/**
 * Update the status of this vendor's items in an order
 * @param {string} orderId  — the order's _id or orderId
 * @param {'pending'|'processing'|'shipped'|'delivered'|'cancelled'} status
 */
export const updateVendorOrderStatus = (orderId, status) =>
    api.patch(`/vendor/orders/${orderId}/status`, { status });

/**
 * Generate a third-party (Shiprocket) shipment for a vendor's order
 * @param {string} orderId
 * @param {{ weight?: number, length?: number, breadth?: number, height?: number, pickup?: object }} [payload]
 */
export const createVendorShipment = (orderId, payload = {}) =>
    api.post(`/vendor/orders/${orderId}/shipment`, payload);

/**
 * Assign courier and schedule pickup for an existing Shiprocket order
 * @param {string} orderId
 * @param {object} [payload]
 */
export const scheduleVendorPickup = (orderId, payload = {}) =>
    api.post(`/vendor/orders/${orderId}/shipment/pickup`, payload);

/**
 * Get shipment details for a vendor order
 * @param {string} orderId
 */
export const getVendorShipment = (orderId) =>
    api.get(`/vendor/orders/${orderId}/shipment`);

/**
 * Get live tracking details for a vendor order shipment
 * @param {string} orderId
 */
export const getVendorShipmentTracking = (orderId) =>
    api.get(`/vendor/orders/${orderId}/shipment/tracking`);

/**
 * Get shipping label PDF URL for a vendor order shipment
 * @param {string} orderId
 */
export const getVendorShipmentLabel = (orderId) =>
    api.get(`/vendor/orders/${orderId}/shipment/label`);

/**
 * Get manifest PDF URL for a vendor order shipment
 * @param {string} orderId
 */
export const getVendorShipmentManifest = (orderId) =>
    api.get(`/vendor/orders/${orderId}/shipment/manifest`);

/**
 * Get invoice PDF URL for a vendor order shipment
 * @param {string} orderId
 */
export const getVendorShipmentInvoice = (orderId) =>
    api.get(`/vendor/orders/${orderId}/shipment/invoice`);

/**
 * Cancel shipment for a vendor order
 * @param {string} orderId
 */
export const cancelVendorShipment = (orderId) =>
    api.post(`/vendor/orders/${orderId}/shipment/cancel`);

/**
 * Get customers for the authenticated vendor
 * @param {{ search?: string }} params
 */
export const getVendorCustomers = (params = {}) =>
    api.get('/vendor/customers', { params });

/**
 * Get one customer detail for the authenticated vendor
 * @param {string} id
 * @param {{ page?: number, limit?: number }} params
 */
export const getVendorCustomerById = (id, params = {}) =>
    api.get(`/vendor/customers/${id}`, { params });

/**
 * Get vendor chat threads
 */
export const getVendorChatThreads = () =>
    api.get('/vendor/chat/threads');

/**
 * Get vendor chat messages by thread id
 * @param {string} id
 */
export const getVendorChatMessages = (id) =>
    api.get(`/vendor/chat/threads/${id}/messages`);

/**
 * Send vendor chat message
 * @param {string} id
 * @param {string} message
 */
export const sendVendorChatMessage = (id, message) =>
    api.post(`/vendor/chat/threads/${id}/messages`, { message });

/**
 * Mark vendor chat as read
 * @param {string} id
 */
export const markVendorChatRead = (id) =>
    api.patch(`/vendor/chat/threads/${id}/read`);

/**
 * Update vendor chat status
 * @param {string} id
 * @param {'active'|'resolved'} status
 */
export const updateVendorChatStatus = (id, status) =>
    api.patch(`/vendor/chat/threads/${id}/status`, { status });

/**
 * Get vendor documents
 */
export const getVendorDocuments = () =>
    api.get('/vendor/documents');

/**
 * Upload vendor document
 * @param {{ name: string, category: string, expiryDate?: string }} data
 * @param {File} file
 */
export const uploadVendorDocument = (data, file) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('category', data.category);
    if (data.expiryDate) formData.append('expiryDate', data.expiryDate);
    formData.append('file', file);
    return api.post('/vendor/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

/**
 * Delete vendor document
 * @param {string} id
 */
export const deleteVendorDocument = (id) =>
    api.delete(`/vendor/documents/${id}`);

/**
 * Get vendor notifications
 * @param {{ page?: number, limit?: number, type?: string, isRead?: string }} params
 */
export const getVendorNotifications = (params = {}) =>
    api.get('/vendor/notifications', { params });

/**
 * Mark a vendor notification as read
 * @param {string} id
 */
export const markVendorNotificationAsRead = (id) =>
    api.put(`/vendor/notifications/${id}/read`);

/**
 * Mark all vendor notifications as read
 */
export const markAllVendorNotificationsAsRead = () =>
    api.put('/vendor/notifications/read-all');

/**
 * Delete vendor notification
 * @param {string} id
 */
export const deleteVendorNotification = (id) =>
    api.delete(`/vendor/notifications/${id}`);

/**
 * Get inventory report for the authenticated vendor
 * @param {{ lowStockOnly?: boolean }} params
 */
export const getVendorInventoryReport = (params = {}) =>
    api.get('/vendor/inventory/reports', { params });

/**
 * Get performance metrics for the authenticated vendor
 */
export const getVendorPerformanceMetrics = () =>
    api.get('/vendor/performance/metrics');

/**
 * Get analytics overview for the authenticated vendor
 * @param {{ period?: 'today'|'week'|'month'|'year' }} params
 */
export const getVendorAnalyticsOverview = (params = {}) =>
    api.get('/vendor/analytics/overview', { params });

/**
 * Get paginated return requests for the authenticated vendor
 * @param {{ page?, limit?, search?, status? }} params
 */
export const getVendorReturnRequests = (params = {}) =>
    api.get('/vendor/return-requests', { params });

/**
 * Get all vendor return requests by paging through the vendor return endpoint.
 * @param {{ limit?: number, search?: string, status?: string }} params
 */
export const getAllVendorReturnRequests = async (params = {}) => {
    const pageSize = Math.max(Number.parseInt(params.limit, 10) || 100, 1);
    let page = 1;
    let pages = 1;
    let total = 0;
    const allRequests = [];

    do {
        const res = await getVendorReturnRequests({ ...params, page, limit: pageSize });
        const payload = res?.data ?? res;
        const pageRequests = Array.isArray(payload?.returnRequests) ? payload.returnRequests : [];
        allRequests.push(...pageRequests);

        const pagination = payload?.pagination || {};
        total = Number(pagination?.total || allRequests.length);
        pages = Math.max(Number(pagination?.pages || 1), 1);
        page += 1;
    } while (page <= pages);

    return {
        returnRequests: allRequests,
        pagination: {
            total,
            page: 1,
            limit: pageSize,
            pages,
        },
    };
};

/**
 * Get a single return request for the authenticated vendor
 * @param {string} id
 */
export const getVendorReturnRequestById = (id) =>
    api.get(`/vendor/return-requests/${id}`);

/**
 * Update return request status for the authenticated vendor
 * @param {string} id
 * @param {{ status?: 'pending'|'approved'|'processing'|'rejected'|'completed', refundStatus?: 'pending'|'processed'|'failed', rejectionReason?: string }} payload
 */
export const updateVendorReturnRequestStatus = (id, payload) =>
    api.patch(`/vendor/return-requests/${id}/status`, payload);

/**
 * Get paginated product reviews for the authenticated vendor
 * @param {{ page?, limit?, rating?, productId? }} params
 */
export const getVendorReviews = (params = {}) =>
    api.get('/vendor/reviews', { params });

/**
 * Get all vendor reviews by paging through the vendor reviews endpoint.
 * @param {{ limit?: number, rating?: number|string, productId?: string }} params
 */
export const getAllVendorReviews = async (params = {}) => {
    const pageSize = Math.max(Number.parseInt(params.limit, 10) || 100, 1);
    let page = 1;
    let pages = 1;
    let total = 0;
    const allReviews = [];

    do {
        const res = await getVendorReviews({ ...params, page, limit: pageSize });
        const payload = res?.data ?? res;
        const pageReviews = Array.isArray(payload?.reviews) ? payload.reviews : [];
        allReviews.push(...pageReviews);

        const pagination = payload?.pagination || {};
        total = Number(pagination?.total || allReviews.length);
        pages = Math.max(Number(pagination?.pages || 1), 1);
        page += 1;
    } while (page <= pages);

    return {
        reviews: allReviews,
        pagination: {
            total,
            page: 1,
            limit: pageSize,
            pages,
        },
    };
};

/**
 * Update vendor review moderation status
 * @param {string} id
 * @param {'approved'|'pending'|'hidden'} status
 */
export const updateVendorReviewStatus = (id, status) =>
    api.patch(`/vendor/reviews/${id}/status`, { status });

/**
 * Add vendor response to a review
 * @param {string} id
 * @param {string} response
 */
export const addVendorReviewResponse = (id, response) =>
    api.patch(`/vendor/reviews/${id}/response`, { response });


/**
 * Get all shipping zones for authenticated vendor
 */
export const getVendorShippingZones = () =>
    api.get('/vendor/shipping/zones');

/**
 * Create shipping zone
 * @param {{ name: string, countries: string[] }} payload
 */
export const createVendorShippingZone = (payload) =>
    api.post('/vendor/shipping/zones', payload);

/**
 * Update shipping zone
 * @param {string} id
 * @param {{ name?: string, countries?: string[] }} payload
 */
export const updateVendorShippingZone = (id, payload) =>
    api.put(`/vendor/shipping/zones/${id}`, payload);

/**
 * Delete shipping zone
 * @param {string} id
 */
export const deleteVendorShippingZone = (id) =>
    api.delete(`/vendor/shipping/zones/${id}`);

/**
 * Get all shipping rates for authenticated vendor
 */
export const getVendorShippingRates = () =>
    api.get('/vendor/shipping/rates');

/**
 * Create shipping rate
 * @param {{ zoneId: string, name: string, rate: number, freeShippingThreshold?: number }} payload
 */
export const createVendorShippingRate = (payload) =>
    api.post('/vendor/shipping/rates', payload);

/**
 * Update shipping rate
 * @param {string} id
 * @param {{ zoneId?: string, name?: string, rate?: number, freeShippingThreshold?: number }} payload
 */
export const updateVendorShippingRate = (id, payload) =>
    api.put(`/vendor/shipping/rates/${id}`, payload);

/**
 * Delete shipping rate
 * @param {string} id
 */
export const deleteVendorShippingRate = (id) =>
    api.delete(`/vendor/shipping/rates/${id}`);


// ─── PICKUP LOCATIONS (WAREHOUSE) ──────────────────────────────────────────────

/**
 * Get all registered pickup warehouse locations for authenticated vendor
 */
export const getVendorPickupLocations = () =>
    api.get('/vendor/pickup-locations');

/**
 * Create a new pickup warehouse location (auto-syncs to Shiprocket)
 * @param {{ name: string, address: string, address_2?: string, city: string, state: string, zipCode: string, country?: string, phone?: string, email?: string, isDefault?: boolean, operatingHours?: object }} data
 */
export const createVendorPickupLocation = (data) =>
    api.post('/vendor/pickup-locations', data);

/**
 * Update an existing pickup warehouse location
 * @param {string} id
 * @param {object} data
 */
export const updateVendorPickupLocation = (id, data) =>
    api.put(`/vendor/pickup-locations/${id}`, data);

/**
 * Delete a pickup warehouse location
 * @param {string} id
 */
export const deleteVendorPickupLocation = (id) =>
    api.delete(`/vendor/pickup-locations/${id}`);

/**
 * Set a pickup location as default
 * @param {string} id
 */
export const setDefaultVendorPickupLocation = (id) =>
    api.patch(`/vendor/pickup-locations/${id}/default`);


// ─── EARNINGS ──────────────────────────────────────────────────────────────────

/**
 * Get earnings summary + commission history
 * Returns { summary: { totalEarnings, pendingEarnings, paidEarnings, totalCommission, totalOrders }, commissions: [...] }
 */
export const getVendorEarnings = () => api.get('/vendor/earnings');


// ─── BANK DETAILS ───────────────────────────────────────────────────────────────

/**
 * Update vendor bank/payment details (stored server-side, select:false)
 * @param {{ accountName?, accountNumber?, bankName?, ifscCode? }} data
 */
export const updateVendorBankDetails = (data) =>
    api.put('/vendor/auth/bank-details', data);

/**
 * Upload a single vendor image using multer + Cloudinary pipeline
 * @param {File} file
 * @param {string} folder
 * @param {string} [publicId]
 */
export const uploadVendorImage = (file, folder = 'vendors/products', publicId) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', folder);
    if (publicId) {
        formData.append('publicId', publicId);
    }
    return api.post('/vendor/uploads/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

/**
 * Upload multiple vendor images using multer + Cloudinary pipeline
 * @param {File[]} files
 * @param {string} folder
 */
export const uploadVendorImages = (files, folder = 'vendors/products') => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    formData.append('folder', folder);
    return api.post('/vendor/uploads/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

/**
 * Get vendor payout summary
 */
export const getVendorPayoutSummary = () => api.get('/vendor/payouts/summary');

/**
 * Get vendor settlements filterable by status
 */
export const getVendorSettlements = (params = {}) => api.get('/vendor/payouts/settlements', { params });

/**
 * Get vendor bank details
 */
export const getVendorBankDetails = () => api.get('/vendor/payouts/bank-details');

/**
 * Update vendor bank details
 */
export const updateVendorBankDetailsNew = (data) => api.put('/vendor/payouts/bank-details', data);
