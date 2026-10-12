import api from '../../../shared/utils/api';

export const getSurveyorDashboard = () => api.get('/surveyor/dashboard');

export const getMyFarmers = (params = {}) => api.get('/surveyor/farmers', { params });

export const getMyFarmer = (id) => api.get(`/surveyor/farmers/${id}`);

export const registerFarmer = (data) => api.post('/surveyor/farmers', data);

export const resubmitFarmer = (id, data) => api.put(`/surveyor/farmers/${id}`, data);

export const getSurveyorCommission = () => api.get('/surveyor/commission');
