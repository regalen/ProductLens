import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import axios from 'axios';

axios.defaults.withCredentials = true;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await axios.get('/api/auth/me');
      setUser(res.data);
    } catch (e) {
      setUser(null);
    }
  };

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          setUser(null);
        }
        return Promise.reject(error);
      }
    );

    refreshUser().finally(() => setLoading(false));

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await axios.post('/api/auth/login', { username, password });
    setUser(res.data);
  };

  const changePassword = async (newPassword: string) => {
    await axios.post('/api/auth/change-password', { newPassword });
    if (user) {
      setUser({ ...user, mustChangePassword: false });
    }
  };

  const logout = async () => {
    await axios.post('/api/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, changePassword, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
