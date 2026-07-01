import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

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
    axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    axios.defaults.withCredentials = true; // Ensure cookies are sent with requests
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
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
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
