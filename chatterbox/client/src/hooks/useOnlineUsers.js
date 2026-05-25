/**
 * Purpose: Converts Socket.io presence events into a live online-user collection.
 */

import { useEffect, useMemo, useState } from 'react';

import useSocket from './useSocket';

/**
 * Tracks online users emitted by the real-time service.
 *
 * @returns {Array<object>} Sorted online-user payloads.
 */
const useOnlineUsers = () => {
  const { socket } = useSocket();
  const [onlineUsersById, setOnlineUsersById] = useState(new Map());

  useEffect(() => {
    if (!socket) {
      setOnlineUsersById(new Map());
      return undefined;
    }

    /**
     * Replaces all online users after initial socket connection.
     *
     * @param {Array<object>} onlineUsers - Initial presence records.
     * @returns {void}
     */
    const handleOnlineUsers = (onlineUsers) => {
      setOnlineUsersById(new Map(onlineUsers.map((user) => [user.userId, user])));
    };

    /**
     * Adds or refreshes one online user.
     *
     * @param {object} onlineUser - User presence payload.
     * @returns {void}
     */
    const handleUserOnline = (onlineUser) => {
      setOnlineUsersById((currentUsers) => {
        const nextUsers = new Map(currentUsers);
        nextUsers.set(onlineUser.userId, onlineUser);
        return nextUsers;
      });
    };

    /**
     * Removes one offline user.
     *
     * @param {{ userId: string }} offlineUser - Offline presence payload.
     * @returns {void}
     */
    const handleUserOffline = (offlineUser) => {
      setOnlineUsersById((currentUsers) => {
        const nextUsers = new Map(currentUsers);
        nextUsers.delete(offlineUser.userId);
        return nextUsers;
      });
    };

    socket.on('online_users', handleOnlineUsers);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);

    return () => {
      socket.off('online_users', handleOnlineUsers);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
    };
  }, [socket]);

  return useMemo(
    () => Array.from(onlineUsersById.values()).sort((first, second) => first.username.localeCompare(second.username)),
    [onlineUsersById]
  );
};

export default useOnlineUsers;
