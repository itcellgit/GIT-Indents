import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', // Backend base URL
  withCredentials: true, // Necessary to send and receive HttpOnly cookies securely
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
