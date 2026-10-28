import api from '../../../shared/utils/api';

export const getKisanDashboard = () => api.get('/kisan/dashboard');

export const getProduceList = () => api.get('/kisan/produce');

export const createSaleRequest = (payload) => api.post('/kisan/sale-requests', payload);

export const getSaleRequests = (params = {}) => api.get('/kisan/sale-requests', { params });

export const getSaleRequest = (id) => api.get(`/kisan/sale-requests/${id}`);

export const cancelSaleRequest = (id, reason = '') => api.patch(`/kisan/sale-requests/${id}/cancel`, { reason });

// ─── Seed sent by the surveyor ────────────────────────────────────────────────

export const getSeedIssues = (params = {}) => api.get('/kisan/seed-issues', { params });

export const getSeedIssue = (id) => api.get(`/kisan/seed-issues/${id}`);

export const decideSeedIssue = (id, payload) => api.patch(`/kisan/seed-issues/${id}/decision`, payload);

export const updateSeedPayment = (id, payload) => api.patch(`/kisan/seed-issues/${id}/payment`, payload);
