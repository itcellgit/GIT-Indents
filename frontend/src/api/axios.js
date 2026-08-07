import axios from 'axios';

const getApiBaseUrl = () => {
  return 'http://10.22.0.159:5000/api';
};

const api = axios.create({
  baseURL: getApiBaseUrl(), // Backend base URL
  withCredentials: true, // Necessary to send and receive HttpOnly cookies securely
  timeout: 30000, // Fail loudly instead of letting a stalled request hang forever
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

let activeRequests = 0;

const showLoader = () => {
  if (activeRequests === 0) {
    window.dispatchEvent(new Event('api-request-start'));
  }
  activeRequests++;
};

const hideLoader = () => {
  activeRequests--;
  if (activeRequests <= 0) {
    activeRequests = 0;
    window.dispatchEvent(new Event('api-request-end'));
  }
};

api.interceptors.request.use(config => {
  // Show loader for non-GET requests (e.g., POST, PUT, DELETE) where emails might be sent
  if (config.method !== 'get') {
    showLoader();
    config.metadata = { useLoader: true };
  }

  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }

  const token = localStorage.getItem('token');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  return config;
}, error => {
  return Promise.reject(error);
});

api.interceptors.response.use(response => {
  if (response.config.metadata?.useLoader) {
    hideLoader();
  }
  return response;
}, error => {
  if (error.config?.metadata?.useLoader) {
    hideLoader();
  }
  return Promise.reject(error);
});

export default api;
