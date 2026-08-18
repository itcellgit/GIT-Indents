import axios from 'axios';

// Derive the backend origin from wherever the page was actually loaded from,
// instead of a build-time constant. A hardcoded host (e.g. VITE_API_URL=
// http://localhost:5000/api, or a single specific LAN IP) only ever works for
// whichever machine matches that exact value at build time — every other
// machine's browser resolves "localhost" to itself, not the server, and gets
// no login/API calls at all. This works for both access paths the backend
// actually serves: the HTTPS domain (indents.git.edu) is reverse-proxied to
// the backend at the same origin, while plain-HTTP access (LAN IP or
// localhost, for local dev) hits the backend directly on port 5000.
const inferBackendOrigin = () => {
  if (typeof window === 'undefined') return 'http://10.22.0.151:5000';
  const { protocol, hostname } = window.location;
  if (protocol === 'https:') return `${protocol}//${hostname}`;
  return `${protocol}//${hostname}:5000`;
};

// VITE_API_URL / VITE_BACKEND_URL remain an explicit override for cases that
// genuinely need to point somewhere else (e.g. a dev frontend against a
// shared remote backend) — see frontend/.env / .env.production.
export const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || inferBackendOrigin();
export const API_BASE_URL = import.meta.env.VITE_API_URL || `${BACKEND_BASE_URL}/api`;

const api = axios.create({
  baseURL: API_BASE_URL, // Backend base URL
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
