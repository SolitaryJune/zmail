import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE_URL } from '../config';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  getAuthHeader: () => Record<string, string>;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  login: async () => false,
  logout: () => {},
  getAuthHeader: () => ({}),
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 检查 sessionStorage 中是否有已保存的 token
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const login = async (password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (data.success && data.token) {
        sessionStorage.setItem('auth_token', data.token);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('登录失败:', error);
      return false;
    }
  };

  const logout = () => {
    sessionStorage.removeItem('auth_token');
    setIsAuthenticated(false);
  };

  const getAuthHeader = (): Record<string, string> => {
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, getAuthHeader }}>
      {children}
    </AuthContext.Provider>
  );
};
