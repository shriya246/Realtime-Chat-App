/**
 * Purpose: Owns the authenticated browser session and exposes login, registration, and logout actions.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import api, { getApiErrorMessage, setUnauthorizedHandler } from '../services/api';
import { clearStoredSession, getStoredSession, isTokenExpired, storeSession } from '../utils/authStorage';

const AuthContext = createContext(null);

/**
 * Provides user authentication state to the ChatterBox client.
 *
 * @param {{ children: import('react').ReactNode }} props - Child application elements.
 * @returns {JSX.Element} Auth provider.
 */
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => getStoredSession());
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Clears session state locally without making a network request.
   *
   * @returns {void}
   */
  const clearSession = useCallback(() => {
    clearStoredSession();
    setSession(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [clearSession]);

  useEffect(() => {
    /**
     * Hydrates the user session using a persisted token.
     *
     * @returns {Promise<void>} Resolves after initialization.
     */
    const initializeSession = async () => {
      try {
        if (!session?.token || isTokenExpired(session.token)) {
          clearSession();
          return;
        }

        const response = await api.get('/auth/me');
        const updatedSession = {
          token: session.token,
          user: response.data.data.user
        };

        storeSession(updatedSession);
        setSession(updatedSession);
      } catch (_error) {
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    initializeSession();
  }, [clearSession]);

  /**
   * Logs an existing user into the client.
   *
   * @param {{ email: string, password: string }} credentials - Login values.
   * @returns {Promise<object>} Authenticated user.
   */
  const login = useCallback(async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const authenticatedSession = response.data.data;
      storeSession(authenticatedSession);
      setSession(authenticatedSession);
      return authenticatedSession.user;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Unable to log in. Please try again.'));
    }
  }, []);

  /**
   * Creates and authenticates a new user account.
   *
   * @param {{ username: string, email: string, password: string }} registration - Registration fields.
   * @returns {Promise<object>} Registered user.
   */
  const register = useCallback(async (registration) => {
    try {
      const response = await api.post('/auth/register', registration);
      const authenticatedSession = response.data.data;
      storeSession(authenticatedSession);
      setSession(authenticatedSession);
      return authenticatedSession.user;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Unable to create your account. Please try again.'));
    }
  }, []);

  /**
   * Revokes the active token where possible and always clears local auth state.
   *
   * @returns {Promise<void>} Resolves after session cleanup.
   */
  const logout = useCallback(async () => {
    try {
      if (session?.token && !isTokenExpired(session.token)) {
        await api.post('/auth/logout');
      }
    } catch (_error) {
      // Local session cleanup in finally still signs the user out if the server is unavailable.
    } finally {
      clearSession();
    }
  }, [clearSession, session?.token]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(session?.token && session?.user),
      isLoading,
      login,
      logout,
      register,
      token: session?.token || null,
      user: session?.user || null
    }),
    [isLoading, login, logout, register, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Returns the current authentication context.
 *
 * @returns {object} Authentication state and actions.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
};
