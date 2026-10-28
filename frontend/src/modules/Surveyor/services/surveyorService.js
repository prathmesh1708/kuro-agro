import api from '../../../shared/utils/api';

export const getSurveyorDashboard = () => api.get('/surveyor/dashboard');

export const getMyFarmers = (params = {}) => api.get('/surveyor/farmers', { params });

export const getMyFarmer = (id) => api.get(`/surveyor/farmers/${id}`);

export const registerFarmer = (data) => api.post('/surveyor/farmers', data);

export const resubmitFarmer = (id, data) => api.put(`/surveyor/farmers/${id}`, data);

export const getCropOptions = () => api.get('/surveyor/produce');

export const getSurveyorCommission = () => api.get('/surveyor/commission');

// ─── Seed distribution ────────────────────────────────────────────────────────

export const getSeedDispatches = (params = {}) => api.get('/surveyor/seed-dispatches', { params });

export const getSeedDispatch = (id) => api.get(`/surveyor/seed-dispatches/${id}`);

export const decideSeedDispatch = (id, payload) => api.patch(`/surveyor/seed-dispatches/${id}/decision`, payload);

export const getSeedStock = () => api.get('/surveyor/seed-stock');

export const getMyKisans = () => api.get('/surveyor/my-kisans');

export const createSeedIssue = (payload) => api.post('/surveyor/seed-issues', payload);

export const getSeedIssues = (params = {}) => api.get('/surveyor/seed-issues', { params });

export const getSeedIssue = (id) => api.get(`/surveyor/seed-issues/${id}`);

export const cancelSeedIssue = (id, reason = '') => api.patch(`/surveyor/seed-issues/${id}/cancel`, { reason });

export const confirmSeedPayment = (id, payload) => api.patch(`/surveyor/seed-issues/${id}/confirm-payment`, payload);

export const getSeedAccount = () => api.get('/surveyor/seed-account');

export const createSeedRemittance = (payload) => api.post('/surveyor/seed-remittances', payload);

export const getSeedRemittances = (params = {}) => api.get('/surveyor/seed-remittances', { params });
