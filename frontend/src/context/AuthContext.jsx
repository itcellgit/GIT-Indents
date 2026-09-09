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
    setUser((prev) => {
      const normalizedUser = {
        ...prev,
        ...userData,
        roles: Array.isArray(userData?.roles) ? userData.roles : userData?.role ? [userData.role] : (prev?.roles || []),
        role: userData?.role || userData?.roles?.[0] || prev?.role || null,
      };

      localStorage.setItem('user', JSON.stringify(normalizedUser));
      return normalizedUser;
    });
    if (userData?.token) {
      localStorage.setItem('token', userData.token);
    }
  };

  // On load, refresh the cached user from the server so a role granted/revoked
  // since the last login is reflected immediately (e.g. the role switcher shows
  // up once a user has 2+ roles) without forcing a manual re-login.
  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      if (data?.id) {
        login(data);
      }
      return data;
    } catch (err) {
      if (err.response?.status === 401) {
        setUser(null);
        localStorage.clear();
      }
      return null;
    }
  };

  useEffect(() => {
    if (localStorage.getItem('user') || localStorage.getItem('token')) {
      refreshUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <AuthContext.Provider value={{ user, login, logout, loading, switchRole, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
