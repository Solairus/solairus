import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthService, type BackendUser, type AuthResponse } from '@/services/auth/auth-service';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  token: string | null;
  user: BackendUser | null;
  silentAuth: (walletAddress: string) => Promise<AuthResponse | null>;
  refreshSession: () => Promise<BackendUser | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => AuthService.getToken());
  const [user, setUser] = useState<BackendUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!token && !!user;

  const refreshSession = useCallback(async (): Promise<BackendUser | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const sessionUser = await AuthService.getSession();
      setUser(sessionUser);
      return sessionUser;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to refresh session';
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const silentAuth = useCallback(async (walletAddress: string): Promise<AuthResponse | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await AuthService.authenticateWallet(walletAddress);
      setToken(res.token);
      setUser(res.user);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Authentication failed';
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    AuthService.logout();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    // Attempt to restore session on mount if token exists
    if (AuthService.getToken()) {
      refreshSession();
    }
  }, [refreshSession]);

  const value = useMemo<AuthState>(() => ({
    isAuthenticated,
    isLoading,
    error,
    token,
    user,
    silentAuth,
    refreshSession,
    logout,
  }), [isAuthenticated, isLoading, error, token, user, silentAuth, refreshSession, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthContextProvider');
  return ctx;
}