import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import api, { API_BASE_URL } from '../api/axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Check if user info is stored in local storage from a previous session
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  
  const [loading, setLoading] = useState(false);

  // Setup Axios defaults
  useEffect(() => {
    // Set axios default base URL
    axios.defaults.baseURL = API_BASE_URL;
    axios.defaults.withCredentials = true; // Ensure cookies are sent with requests
  }, []);

  const login = (userData) => {
    const normalizedUser = {
      ...userData,
      roles: Array.isArray(userData?.roles) ? userData.roles : userData?.role ? [userData.role] : [],
      role: userData?.role || userData?.roles?.[0] || null,
    };

    setUser(normalizedUser);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    if (userData?.token) {
      localStorage.setItem('token', userData.token);
    }
  };

  const switchRole = async (role) => {
    const response = await api.post('/auth/switch-role', { role });
    if (response.data) {
      login(response.data);
    }
    return response.data;
  };

  const logout = async () => {
    try {
      await axios.post('/auth/logout');
    } catch (err) {
      console.error('Error logging out on backend:', err);
    } finally {
      setUser(null);
      localStorage.clear(); // Clear all auth and session data
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};
