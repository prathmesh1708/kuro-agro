import api from '../../../shared/utils/api';

export const getSanchalakDashboard = () => api.get('/sanchalak/dashboard');

export const getKendraFarmers = (params = {}) => api.get('/sanchalak/farmers', { params });

export const getKendraFarmer = (id) => api.get(`/sanchalak/farmers/${id}`);

export const getKendraSurveyors = () => api.get('/sanchalak/surveyors');

export const getSanchalakCommission = () => api.get('/sanchalak/commission');

export const getKendraSurveyor = (id) => api.get(`/sanchalak/surveyors/${id}`);
