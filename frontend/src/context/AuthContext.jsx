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

  // Active impersonation session, if any: { active: true, impersonator: { id, name } }.
  // Persisted so a page reload keeps the banner up until /auth/me confirms state.
  const [impersonation, setImpersonation] = useState(() => {
    try {
      const raw = localStorage.getItem('impersonation');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Setup Axios defaults
  useEffect(() => {
    // Set axios default base URL
    axios.defaults.baseURL = API_BASE_URL;
    axios.defaults.withCredentials = true; // Ensure cookies are sent with requests
  }, []);

  // `replace` swaps identity cleanly (used when entering/leaving impersonation)
  // so fields from the previous identity don't bleed through the object merge.
  const login = (userData, { replace = false } = {}) => {
    setUser((prev) => {
      const base = replace ? null : prev;
      const normalizedUser = {
        ...base,
        ...userData,
        roles: Array.isArray(userData?.roles) ? userData.roles : userData?.role ? [userData.role] : (base?.roles || []),
        role: userData?.role || userData?.roles?.[0] || base?.role || null,
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
        // /auth/me is the source of truth for impersonation state — it reads the
        // signed `imp` claim, so a stale localStorage flag is corrected here.
        if (data.impersonating) {
          const record = { active: true, impersonator: data.impersonator || null };
          localStorage.setItem('impersonation', JSON.stringify(record));
          setImpersonation(record);
        } else {
          localStorage.removeItem('impersonation');
          setImpersonation(null);
        }
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

  // Admin assumes a target user's identity. The backend swaps the auth cookie
  // for a short-lived impersonation token; we swap the cached identity + bearer
  // token to match and raise the banner.
  const startImpersonation = async (userId) => {
    const { data } = await api.post(`/auth/impersonate/${userId}`);
    const record = { active: true, impersonator: data.impersonator || null };
    localStorage.setItem('impersonation', JSON.stringify(record));
    setImpersonation(record);
    login(data, { replace: true });
    return data;
  };

  // Terminate impersonation and revert to the original admin session. The proof
  // of "who to revert to" lives in the signed token, not here.
  const stopImpersonation = async () => {
    try {
      const { data } = await api.post('/auth/impersonate/stop');
      localStorage.removeItem('impersonation');
      setImpersonation(null);
      login(data, { replace: true });
      return data;
    } catch (err) {
      // Original admin no longer valid (deleted/disabled/demoted) — hard reset.
      if (err.response?.status === 403 || err.response?.status === 401) {
        localStorage.clear();
        setImpersonation(null);
        setUser(null);
      }
      throw err;
    }
  };

  const logout = async () => {
    try {
      await axios.post('/auth/logout');
    } catch (err) {
      console.error('Error logging out on backend:', err);
    } finally {
      setUser(null);
      setImpersonation(null);
      localStorage.clear(); // Clear all auth and session data
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, switchRole, refreshUser, impersonation, startImpersonation, stopImpersonation }}>
      {children}
    </AuthContext.Provider>
  );
};
