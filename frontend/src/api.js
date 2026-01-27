import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const auth = {
  login: (password) => api.post('/auth/login', { password }),
  verify: () => api.get('/auth/verify')
};

export const analytics = {
  getByClient: (params) => api.get('/analytics/by-client', { params }),
  getByProject: (params) => api.get('/analytics/by-project', { params }),
  getByUser: (params) => api.get('/analytics/by-user', { params }),
  getSummary: (params) => api.get('/analytics/summary', { params }),
  getClients: () => api.get('/analytics/clients'),
  getProjectsWithUsers: (params) => api.get('/analytics/projects-with-users', { params })
};

export default api;
