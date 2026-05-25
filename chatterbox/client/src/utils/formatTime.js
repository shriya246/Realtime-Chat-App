/**
 * Purpose: Formats chat timestamps for concise display and accessible labels.
 */

/**
 * Formats a message timestamp as the local time.
 *
 * @param {string|Date} timestamp - Message timestamp.
 * @returns {string} Local compact time label.
 */
export const formatMessageTime = (timestamp) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(timestamp));

/**
 * Formats a full timestamp for title text and assistive technology.
 *
 * @param {string|Date} timestamp - Timestamp to format.
 * @returns {string} Local date and time.
 */
export const formatFullDateTime = (timestamp) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp));
