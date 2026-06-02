/**
 * Purpose: Configures authenticated Axios requests and shared API error behavior.
 */

import axios from 'axios';

import { getStoredSession } from '../utils/authStorage';

const DEFAULT_API_URL = 'http://localhost:5000/api';

let unauthorizedHandler = null;

/**
 * Resolves the REST API base URL from Vite build configuration.
 *
 * @returns {string} API base URL.
 */
export const getApiBaseUrl = () =>
  typeof __CHATTERBOX_API_URL__ !== 'undefined' ? __CHATTERBOX_API_URL__ : DEFAULT_API_URL;

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((configuration) => {
  const session = getStoredSession();

  if (session?.token) {
    configuration.headers.Authorization = `Bearer ${session.token}`;
  }

  return configuration;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof unauthorizedHandler === 'function') {
      unauthorizedHandler();
    }

    return Promise.reject(error);
  }
);

/**
 * Registers an application callback for unauthorized server responses.
 *
 * @param {Function|null} handler - Callback or null to unregister.
 * @returns {void}
 */
export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

/**
 * Extracts a readable message from a failed API request.
 *
 * @param {object} error - Axios error.
 * @param {string} fallbackMessage - Message used when no server message exists.
 * @returns {string} Safe user-facing message.
 */
export const getApiErrorMessage = (error, fallbackMessage) =>
  error.response?.data?.error?.message || fallbackMessage;

export default api;
