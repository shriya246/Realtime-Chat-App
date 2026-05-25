/**
 * Purpose: Creates and tears down the authenticated Socket.io connection for the signed-in user.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

import { useAuth } from './AuthContext';

const SocketContext = createContext(null);
const DEFAULT_SOCKET_URL = 'http://localhost:5000';
const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 8000;

/**
 * Resolves the Socket.io service URL from build-time configuration.
 *
 * @returns {string} Socket server URL.
 */
const getSocketUrl = () =>
  typeof __CHATTERBOX_SOCKET_URL__ !== 'undefined' ? __CHATTERBOX_SOCKET_URL__ : DEFAULT_SOCKET_URL;

/**
 * Provides a lifecycle-managed authenticated Socket.io connection.
 *
 * @param {{ children: import('react').ReactNode }} props - Child application elements.
 * @returns {JSX.Element} Socket context provider.
 */
export const SocketProvider = ({ children }) => {
  const { isAuthenticated, logout, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setSocket(null);
      setConnectionStatus('disconnected');
      return undefined;
    }

    const connectedSocket = io(getSocketUrl(), {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: INITIAL_RECONNECT_DELAY_MS,
      reconnectionDelayMax: MAX_RECONNECT_DELAY_MS,
      randomizationFactor: 0.3
    });

    setSocket(connectedSocket);
    setConnectionStatus('connecting');
    setConnectionError('');

    connectedSocket.on('connect', () => {
      setConnectionStatus('connected');
      setConnectionError('');
    });

    connectedSocket.on('disconnect', (reason) => {
      setConnectionStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting');
    });

    const handleReconnectAttempt = () => {
      setConnectionStatus('reconnecting');
    };

    connectedSocket.io.on('reconnect_attempt', handleReconnectAttempt);

    connectedSocket.on('connect_error', (error) => {
      setConnectionStatus('error');
      setConnectionError(error.message || 'Real-time connection failed.');

      if (error.data?.code === 'AUTHENTICATION_ERROR') {
        logout();
      }
    });

    return () => {
      connectedSocket.io.off('reconnect_attempt', handleReconnectAttempt);
      connectedSocket.disconnect();
      setSocket(null);
      setConnectionStatus('disconnected');
    };
  }, [isAuthenticated, logout, token]);

  const value = useMemo(
    () => ({
      connectionError,
      connectionStatus,
      isConnected: connectionStatus === 'connected',
      socket
    }),
    [connectionError, connectionStatus, socket]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

/**
 * Returns the active socket context.
 *
 * @returns {object} Socket instance and connection state.
 */
export const useSocketContext = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error('useSocketContext must be used within SocketProvider.');
  }

  return context;
};
