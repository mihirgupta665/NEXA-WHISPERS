import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    try {
      const res = await api.get('/api/auth/me');
      if (res.data.success) {
        setUser(res.data.data.user);
        if (res.data.data.token) {
          localStorage.setItem('token', res.data.data.token);
        }
      } else {
        setUser(null);
        localStorage.removeItem('token');
      }
    } catch (err) {
      setUser(null);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const register = async (username, phone, password, displayName) => {
    const res = await api.post('/api/auth/register', {
      username,
      phone,
      password,
      display_name: displayName
    });
    return res.data;
  };

  const verifyOtp = async (phone, code) => {
    const res = await api.post('/api/auth/verify-otp', { phone, code });
    if (res.data.success) {
      setUser(res.data.data.user);
      if (res.data.data.token) {
        localStorage.setItem('token', res.data.data.token);
      }
    }
    return res.data;
  };

  const login = async (username, password) => {
    const res = await api.post('/api/auth/login', { username, password });
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error('[Auth Context] Logout API call failed:', err);
    } finally {
      setUser(null);
      localStorage.removeItem('token');
    }
  };

  const updateProfile = async (profileData) => {
    const res = await api.put('/api/users/profile', profileData);
    if (res.data.success) {
      setUser(res.data.data.user);
    }
    return res.data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        register,
        verifyOtp,
        login,
        logout,
        updateProfile,
        checkSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
