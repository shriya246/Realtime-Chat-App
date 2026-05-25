/**
 * Purpose: Exposes Socket.io connection state to application components.
 */

import { useSocketContext } from '../context/SocketContext';

/**
 * Returns the authenticated Socket.io connection and status.
 *
 * @returns {object} Socket connection context.
 */
const useSocket = () => useSocketContext();

export default useSocket;
