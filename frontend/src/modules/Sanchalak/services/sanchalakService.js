import api from '../../../shared/utils/api';

export const getSanchalakDashboard = () => api.get('/sanchalak/dashboard');

export const getKendraFarmers = (params = {}) => api.get('/sanchalak/farmers', { params });

export const getKendraFarmer = (id) => api.get(`/sanchalak/farmers/${id}`);

export const getKendraSurveyors = () => api.get('/sanchalak/surveyors');

export const getSanchalakCommission = () => api.get('/sanchalak/commission');

export const getKendraSurveyor = (id) => api.get(`/sanchalak/surveyors/${id}`);

// ─── Produce trade ────────────────────────────────────────────────────────────
export const getPurchaseRequests = (params = {}) => api.get('/sanchalak/purchase-requests', { params });

export const getPurchaseRequest = (id) => api.get(`/sanchalak/purchase-requests/${id}`);

export const decidePurchaseRequest = (id, payload) => api.patch(`/sanchalak/purchase-requests/${id}/decision`, payload);

export const updatePurchasePayment = (id, payload) => api.patch(`/sanchalak/purchase-requests/${id}/payment`, payload);

export const getKendraStock = () => api.get('/sanchalak/stock');

export const getStockByKisan = () => api.get('/sanchalak/stock/by-kisan');

export const createSaleToAdmin = (payload) => api.post('/sanchalak/sale-requests', payload);

export const getSalesToAdmin = (params = {}) => api.get('/sanchalak/sale-requests', { params });

export const getSaleToAdmin = (id) => api.get(`/sanchalak/sale-requests/${id}`);

export const cancelSaleToAdmin = (id, reason = '') => api.patch(`/sanchalak/sale-requests/${id}/cancel`, { reason });

export const getSanchalakProduce = () => api.get('/sanchalak/produce');
