/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setUnauthorizedHandler } from '../services/apiClient';
import * as authApi from '../services/authApi';
import { ApiError, type SessionResponse } from '../types/nexus';

export interface AuthContextValue {
  session: SessionResponse;
  isBootstrapping: boolean;
  backendOffline: boolean;
  authError: string | null;
  login: (username: string, password: string) => Promise<SessionResponse>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<SessionResponse | null>;
}

const ANONYMOUS_SESSION: SessionResponse = {
  csrfToken: null,
  username: null,
  displayName: null,
  role: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isOfflineError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 502 ||
      error.status === 503 ||
      error.status === 504 ||
      error.backendOffline === true)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionResponse>(ANONYMOUS_SESSION);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [backendOffline, setBackendOffline] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshSession = useCallback(async (): Promise<SessionResponse | null> => {
    try {
      const next = await authApi.getSession();
      setSession(next);
      setBackendOffline(false);
      setAuthError(null);
      return next;
    } catch (error) {
      if (isOfflineError(error)) {
        setBackendOffline(true);
      }
      setSession(ANONYMOUS_SESSION);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    authApi
      .getSession()
      .then((next) => {
        if (!active) return;
        setSession(next);
        setBackendOffline(false);
      })
      .catch((error) => {
        if (!active) return;
        if (isOfflineError(error)) {
          setBackendOffline(true);
        }
        setSession(ANONYMOUS_SESSION);
      })
      .finally(() => {
        if (active) {
          setIsBootstrapping(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession(ANONYMOUS_SESSION);
      void refreshSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [refreshSession]);

  const login = useCallback(async (username: string, password: string): Promise<SessionResponse> => {
    setAuthError(null);
    try {
      const next = await authApi.login(username, password);
      setSession(next);
      setBackendOffline(false);
      return next;
    } catch (error) {
      if (isOfflineError(error)) {
        setBackendOffline(true);
      }
      const message =
        error instanceof ApiError
          ? error.message
          : 'Sign in failed. Check your credentials and try again.';
      setAuthError(message);
      throw error;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setAuthError(null);
    try {
      const next = await authApi.logout();
      setSession(next);
      setBackendOffline(false);
    } catch (error) {
      setSession(ANONYMOUS_SESSION);
      if (isOfflineError(error)) {
        setBackendOffline(true);
      }
      throw error;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isBootstrapping,
        backendOffline,
        authError,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
