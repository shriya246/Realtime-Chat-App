/**
 * Purpose: Maintains room history, live messages, optimistic sends, and typing states for one selected room.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import useSocket from './useSocket';

const MAX_QUEUED_MESSAGES = 100;

/**
 * Produces a browser-unique optimistic message identifier.
 *
 * @returns {string} Client message identifier.
 */
const createClientMessageId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Manages real-time state for a selected room.
 *
 * @param {string|null} roomId - Selected room identifier.
 * @returns {object} Room-message state and actions.
 */
const useMessages = (roomId) => {
  const { user } = useAuth();
  const { isConnected, socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const typingTimeoutRef = useRef(null);
  const queuedMessagesRef = useRef([]);

  useEffect(() => {
    setMessages([]);
    setTypingUsers(new Map());
    setError('');

    if (!socket || !roomId) {
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);

    /**
     * Joins the active room and receives an explicit failure if access is denied.
     *
     * @returns {void}
     */
    const joinRoom = () => {
      socket.emit('join_room', { roomId }, (response) => {
        if (!response.success) {
          setError(response.error.message);
          setIsLoading(false);
          return;
        }

        const queuedMessages = queuedMessagesRef.current.filter((message) => message.roomId === roomId);
        queuedMessagesRef.current = queuedMessagesRef.current.filter((message) => message.roomId !== roomId);

        queuedMessages.forEach((queuedMessage) => {
          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.clientMessageId === queuedMessage.clientMessageId
                ? { ...message, status: 'sent' }
                : message
            )
          );
          socket.emit('send_message', queuedMessage, (sendResponse) => {
            if (!sendResponse.success) {
              setMessages((currentMessages) =>
                currentMessages.map((message) =>
                  message.clientMessageId === queuedMessage.clientMessageId
                    ? { ...message, isPending: false, status: 'failed' }
                    : message
                )
              );
              setError(sendResponse.error.message);
            }
          });
        });
      });
    };

    /**
     * Applies room history returned by the server.
     *
     * @param {{ roomId: string, messages: Array<object> }} payload - History payload.
     * @returns {void}
     */
    const handleMessageHistory = (payload) => {
      if (payload.roomId === roomId) {
        setMessages((currentMessages) => {
          const pendingMessages = currentMessages.filter((message) => message.isPending);
          return [...payload.messages, ...pendingMessages];
        });
        setIsLoading(false);
      }
    };

    /**
     * Adds delivered messages or replaces the matching optimistic message.
     *
     * @param {object} message - Delivered message payload.
     * @returns {void}
     */
    const handleReceiveMessage = (message) => {
      if (message.roomId !== roomId) {
        return;
      }

      setMessages((currentMessages) => {
        const optimisticIndex = message.clientMessageId
          ? currentMessages.findIndex((entry) => entry.clientMessageId === message.clientMessageId)
          : -1;

        if (optimisticIndex >= 0) {
          const nextMessages = [...currentMessages];
          nextMessages[optimisticIndex] = message;
          return nextMessages;
        }

        if (currentMessages.some((entry) => entry.id === message.id)) {
          return currentMessages;
        }

        return [...currentMessages, message];
      });
    };

    /**
     * Tracks another participant's active typing status.
     *
     * @param {object} typingState - Typing payload.
     * @returns {void}
     */
    const handleTypingIndicator = (typingState) => {
      if (typingState.roomId !== roomId || typingState.userId === user?.id) {
        return;
      }

      setTypingUsers((currentUsers) => {
        const nextUsers = new Map(currentUsers);

        if (typingState.isTyping) {
          nextUsers.set(typingState.userId, typingState);
        } else {
          nextUsers.delete(typingState.userId);
        }

        return nextUsers;
      });
    };

    /**
     * Displays server event failures relevant to this live conversation.
     *
     * @param {{ message: string }} socketError - Error payload.
     * @returns {void}
     */
    const handleSocketError = (socketError) => {
      setError(socketError.message);
    };

    socket.on('message_history', handleMessageHistory);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('typing_indicator', handleTypingIndicator);
    socket.on('socket_error', handleSocketError);
    socket.on('connect', joinRoom);

    if (socket.connected) {
      joinRoom();
    }

    return () => {
      socket.emit('leave_room', { roomId });
      socket.off('message_history', handleMessageHistory);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('typing_indicator', handleTypingIndicator);
      socket.off('socket_error', handleSocketError);
      socket.off('connect', joinRoom);
    };
  }, [roomId, socket, user?.id]);

  /**
   * Optimistically sends a text message into the active room.
   *
   * @param {string} content - User-entered text.
   * @returns {boolean} True when queued for server delivery.
   */
  const sendMessage = useCallback(
    (content) => {
      const trimmedContent = content.trim();

      if (!roomId || !user || !trimmedContent) {
        return false;
      }

      const clientMessageId = createClientMessageId();
      const optimisticMessage = {
        clientMessageId,
        content: trimmedContent,
        id: clientMessageId,
        isPending: true,
        roomId,
        sender: user,
        status: isConnected ? 'sent' : 'queued',
        timestamp: new Date().toISOString(),
        type: 'text'
      };

      setMessages((currentMessages) => [...currentMessages, optimisticMessage]);
      setError('');

      const messagePayload = {
        clientMessageId,
        content: trimmedContent,
        roomId
      };

      if (!socket || !isConnected) {
        const nextQueue = [...queuedMessagesRef.current, messagePayload];
        const droppedMessages = nextQueue.slice(0, Math.max(0, nextQueue.length - MAX_QUEUED_MESSAGES));
        queuedMessagesRef.current = nextQueue.slice(-MAX_QUEUED_MESSAGES);

        if (droppedMessages.length > 0) {
          const droppedIds = new Set(droppedMessages.map((message) => message.clientMessageId));
          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              droppedIds.has(message.clientMessageId)
                ? { ...message, isPending: false, status: 'failed' }
                : message
            )
          );
          setError('Some queued messages could not be retained while offline.');
        }

        return true;
      }

      socket.emit(
        'send_message',
        messagePayload,
        (response) => {
          if (!response.success) {
            setMessages((currentMessages) =>
              currentMessages.map((message) =>
                message.clientMessageId === clientMessageId
                  ? { ...message, isPending: false, status: 'failed' }
                  : message
              )
            );
            setError(response.error.message);
          }
        }
      );

      return true;
    },
    [isConnected, roomId, socket, user]
  );

  /**
   * Emits a typing state and automatically clears the current user's signal.
   *
   * @param {boolean} isTyping - Current typing status.
   * @returns {void}
   */
  const emitTyping = useCallback(
    (isTyping) => {
      if (!socket || !roomId || !isConnected) {
        return;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      socket.emit('user_typing', { roomId, isTyping });

      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          socket.emit('user_typing', { roomId, isTyping: false });
        }, 2000);
      }
    },
    [isConnected, roomId, socket]
  );

  useEffect(
    () => () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    },
    []
  );

  return {
    clearError: () => setError(''),
    emitTyping,
    error,
    isLoading,
    messages,
    sendMessage,
    typingUsers: useMemo(() => Array.from(typingUsers.values()), [typingUsers])
  };
};

export default useMessages;
