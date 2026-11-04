import axios from 'axios';

const TOKEN_KEY = 'mg_token';
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 120000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Only treat 401 as "session expired" when we actually sent a session.
// (A wrong password on the login form is also a 401 and must show its message.)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const sentToken = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && sentToken && !error.config.url.startsWith('/auth/login')) {
      tokenStore.clear();
      if (!['/login', '/register'].includes(window.location.pathname)) window.location.assign('/login?expired=1');
    }
    return Promise.reject(error);
  },
);

export const errorMessage = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.message || (err?.code === 'ECONNABORTED' ? 'The server took too long to respond.' : err?.message) || fallback;

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verifyOtp: (data) => api.post('/auth/verify-otp', data),
  resendOtp: (email) => api.post('/auth/resend-otp', { email }),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  me: () => api.get('/auth/me'),
};

export const verifyService = {
  single: (email) => api.post('/verify/single', { email }),
  bulkUpload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/verify/bulk', form);
  },
  getBulkStatus: (jobId) => api.get(`/verify/bulk/${jobId}`),
  getJobs: () => api.get('/verify/jobs'),
  getHistory: (params) => api.get('/verify/history', { params }),
  exportResults: (params) => api.get('/verify/export', { params, responseType: 'blob' }),
};

export const analyticsService = {
  getStats: () => api.get('/analytics/stats'),
  getChartData: (days) => api.get('/analytics/chart', { params: { days } }),
  getBulkJobs: () => api.get('/verify/jobs'),
};

export const accountService = {
  updateProfile: (name) => api.put('/user/profile', { name }),
  createApiKey: () => api.post('/user/api-key'),
  revokeApiKey: () => api.delete('/user/api-key'),
  systemStatus: () => api.get('/system/status'),
};

export async function downloadBlob(promise, filename) {
  const res = await promise;
  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default api;
