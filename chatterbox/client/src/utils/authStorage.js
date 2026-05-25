/**
 * Purpose: Persists authentication session data and inspects JWT expiration in the browser.
 */

const SESSION_STORAGE_KEY = 'chatterbox.session';

/**
 * Retrieves a stored authentication session.
 *
 * @returns {{ token: string, user: object }|null} Stored session or null.
 */
export const getStoredSession = () => {
  try {
    const serializedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return serializedSession ? JSON.parse(serializedSession) : null;
  } catch (_error) {
    return null;
  }
};

/**
 * Persists an authentication session.
 *
 * @param {{ token: string, user: object }} session - Auth session.
 * @returns {void}
 */
export const storeSession = (session) => {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (_error) {
    clearStoredSession();
  }
};

/**
 * Removes the persisted authentication session.
 *
 * @returns {void}
 */
export const clearStoredSession = () => {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (_error) {
    return;
  }
};

/**
 * Decodes a JWT payload without treating it as signature verification.
 *
 * @param {string} token - JWT string.
 * @returns {object|null} Token payload or null for malformed tokens.
 */
export const decodeTokenPayload = (token) => {
  try {
    const encodedPayload = token.split('.')[1];
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch (_error) {
    return null;
  }
};

/**
 * Returns whether a JWT has passed its expiration timestamp.
 *
 * @param {string} token - JWT string.
 * @returns {boolean} True when the token is missing, malformed, or expired.
 */
export const isTokenExpired = (token) => {
  const payload = decodeTokenPayload(token);
  return !payload?.exp || payload.exp * 1000 <= Date.now();
};
