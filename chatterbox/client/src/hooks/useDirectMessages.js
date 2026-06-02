/**
 * Purpose: Maintains direct-message history, live updates, optimistic sends, read receipts, and message actions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import api, { getApiErrorMessage } from '../services/api';
import useSocket from './useSocket';

/**
 * Produces a browser-unique optimistic message identifier.
 *
 * @returns {string} Client message identifier.
 */
const createClientMessageId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `direct-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Replaces or appends a message in chronological state.
 *
 * @param {Array<object>} messages - Current messages.
 * @param {object} nextMessage - New message payload.
 * @returns {Array<object>} Updated messages.
 */
const upsertMessage = (messages, nextMessage) => {
  const optimisticIndex = nextMessage.clientMessageId
    ? messages.findIndex((message) => message.clientMessageId === nextMessage.clientMessageId)
    : -1;

  if (optimisticIndex >= 0) {
    const nextMessages = [...messages];
    nextMessages[optimisticIndex] = nextMessage;
    return nextMessages;
  }

  const existingIndex = messages.findIndex((message) => message.id === nextMessage.id);

  if (existingIndex >= 0) {
    const nextMessages = [...messages];
    nextMessages[existingIndex] = nextMessage;
    return nextMessages;
  }

  return [...messages, nextMessage];
};

/**
 * Manages state and socket actions for one selected direct conversation.
 *
 * @param {string|null} conversationId - Selected conversation id.
 * @param {Function} onConversationUpdated - Conversation-list update callback.
 * @returns {object} Direct-message state and actions.
 */
const useDirectMessages = (conversationId, onConversationUpdated = () => undefined) => {
  const { user } = useAuth();
  const { isConnected, socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const pendingByClientId = useRef(new Map());

  const markAsRead = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    if (socket && isConnected) {
      socket.emit('message:read', { conversationId });
      return;
    }

    try {
      await api.post(`/conversations/${conversationId}/read`);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to mark messages as read.'));
    }
  }, [conversationId, isConnected, socket]);

  useEffect(() => {
    setMessages([]);
    setError('');

    if (!conversationId) {
      setIsLoading(false);
      return undefined;
    }

    let isActive = true;

    const loadHistory = async () => {
      try {
        setIsLoading(true);
        const response = await api.get(`/conversations/${conversationId}/messages`);

        if (isActive) {
          setMessages(response.data.data.messages);
          setIsLoading(false);
          markAsRead();
        }
      } catch (requestError) {
        if (isActive) {
          setError(getApiErrorMessage(requestError, 'Unable to load this conversation.'));
          setIsLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      isActive = false;
    };
  }, [conversationId, markAsRead]);

  useEffect(() => {
    if (!socket || !conversationId) {
      return undefined;
    }

    const joinConversation = () => {
      socket.emit('conversation:join', { conversationId }, (response) => {
        if (!response.success) {
          setError(response.error.message);
        }
      });
    };

    const handleNewMessage = (message) => {
      if (message.conversationId !== conversationId) {
        return;
      }

      pendingByClientId.current.delete(message.clientMessageId);
      setMessages((currentMessages) => upsertMessage(currentMessages, message));

      if (message.sender?.id !== user?.id) {
        markAsRead();
      }
    };

    const handleMessageRead = (receipt) => {
      if (receipt.conversationId !== conversationId || !receipt.messageIds?.length) {
        return;
      }

      const readMessageIds = new Set(receipt.messageIds);
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          readMessageIds.has(message.id) && message.sender?.id === user?.id
            ? { ...message, status: 'read' }
            : message
        )
      );
    };

    const handleReactionUpdate = (payload) => {
      if (payload.conversationId !== conversationId) {
        return;
      }

      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === payload.messageId ? { ...message, reactions: payload.reactions } : message
        )
      );
    };

    const handleMessageUpdate = (payload) => {
      const message = payload.message;

      if (message?.conversationId !== conversationId) {
        return;
      }

      setMessages((currentMessages) => upsertMessage(currentMessages, message));
    };

    const handleConversationUpdated = (payload) => {
      if (payload.conversation?.id === conversationId) {
        onConversationUpdated(payload.conversation);
      }
    };

    const handleSocketError = (socketError) => {
      setError(socketError.message);
    };

    socket.on('direct_message:new', handleNewMessage);
    socket.on('media_message:new', handleNewMessage);
    socket.on('message:read', handleMessageRead);
    socket.on('message:reaction:update', handleReactionUpdate);
    socket.on('message:edit', handleMessageUpdate);
    socket.on('message:delete', handleMessageUpdate);
    socket.on('conversation:updated', handleConversationUpdated);
    socket.on('socket_error', handleSocketError);
    socket.on('connect', joinConversation);

    if (socket.connected) {
      joinConversation();
    }

    return () => {
      socket.emit('conversation:leave', { conversationId });
      socket.off('direct_message:new', handleNewMessage);
      socket.off('media_message:new', handleNewMessage);
      socket.off('message:read', handleMessageRead);
      socket.off('message:reaction:update', handleReactionUpdate);
      socket.off('message:edit', handleMessageUpdate);
      socket.off('message:delete', handleMessageUpdate);
      socket.off('conversation:updated', handleConversationUpdated);
      socket.off('socket_error', handleSocketError);
      socket.off('connect', joinConversation);
    };
  }, [conversationId, markAsRead, onConversationUpdated, socket, user?.id]);

  const sendMessage = useCallback(
    (content, replyToMessageId = null, attachment = null) => {
      const trimmedContent = content.trim();

      if (!conversationId || !user || (!trimmedContent && !attachment)) {
        return false;
      }

      const clientMessageId = createClientMessageId();
      const messageType = attachment?.kind && attachment.kind !== 'avatar' ? attachment.kind : 'text';
      const optimisticMessage = {
        clientMessageId,
        attachments: attachment ? [attachment] : [],
        content: trimmedContent || attachment?.originalFilename || 'Attachment',
        conversationId,
        id: clientMessageId,
        isPending: true,
        replyTo: replyToMessageId
          ? messages.find((message) => message.id === replyToMessageId) || null
          : null,
        sender: user,
        status: isConnected ? 'sending' : 'failed',
        timestamp: new Date().toISOString(),
        type: messageType
      };
      const payload = {
        attachmentId: attachment?.id || null,
        clientMessageId,
        content: optimisticMessage.content,
        conversationId,
        replyToMessageId
      };

      pendingByClientId.current.set(clientMessageId, payload);
      setMessages((currentMessages) => [...currentMessages, optimisticMessage]);
      setError('');

      if (!socket || !isConnected) {
        return true;
      }

      socket.emit('direct_message:send', payload, (response) => {
        if (!response.success) {
          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.clientMessageId === clientMessageId
                ? { ...message, isPending: false, status: 'failed' }
                : message
            )
          );
          setError(response.error.message);
          return;
        }

        pendingByClientId.current.delete(clientMessageId);
        setMessages((currentMessages) => upsertMessage(currentMessages, response.data.message));
      });

      return true;
    },
    [conversationId, isConnected, messages, socket, user]
  );

  const retryMessage = useCallback(
    (message) => {
      if (!message || !message.content || !message.clientMessageId) {
        return false;
      }

      setMessages((currentMessages) =>
        currentMessages.filter((currentMessage) => currentMessage.clientMessageId !== message.clientMessageId)
      );
      return sendMessage(message.content, message.replyTo?.id || null, message.attachments?.[0] || null);
    },
    [sendMessage]
  );

  const uploadAttachment = useCallback(
    async (file, onProgress = () => undefined, purpose = 'message') => {
      if (!conversationId && purpose === 'message') {
        throw new Error('Select a conversation before uploading.');
      }

      const response = await api.post(
        `/attachments?purpose=${purpose}${purpose === 'message' ? `&conversationId=${conversationId}` : ''}`,
        file,
        {
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'X-File-Name': encodeURIComponent(file.name || 'attachment')
          },
          onUploadProgress(progressEvent) {
            if (progressEvent.total) {
              onProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
            }
          }
        }
      );

      return response.data.data.attachment;
    },
    [conversationId]
  );

  const reactToMessage = useCallback(
    (messageId, emoji) => {
      if (!socket || !isConnected) {
        setError('Reconnect before reacting to a message.');
        return;
      }

      socket.emit('message:reaction:update', { messageId, emoji }, (response) => {
        if (!response.success) {
          setError(response.error.message);
        }
      });
    },
    [isConnected, socket]
  );

  const editMessage = useCallback(
    (messageId, content) => {
      if (!socket || !isConnected) {
        setError('Reconnect before editing a message.');
        return;
      }

      socket.emit('message:edit', { messageId, content }, (response) => {
        if (!response.success) {
          setError(response.error.message);
        }
      });
    },
    [isConnected, socket]
  );

  const deleteMessage = useCallback(
    (messageId) => {
      if (!socket || !isConnected) {
        setError('Reconnect before deleting a message.');
        return;
      }

      socket.emit('message:delete', { messageId }, (response) => {
        if (!response.success) {
          setError(response.error.message);
        }
      });
    },
    [isConnected, socket]
  );

  const searchMessages = useCallback(
    async (query) => {
      const trimmedQuery = query.trim();

      if (!conversationId || !trimmedQuery) {
        return [];
      }

      const response = await api.get(`/conversations/${conversationId}/search`, {
        params: { q: trimmedQuery }
      });

      return response.data.data.results;
    },
    [conversationId]
  );

  return useMemo(
    () => ({
      deleteMessage,
      editMessage,
      error,
      isLoading,
      messages,
      reactToMessage,
      retryMessage,
      searchMessages,
      sendMessage,
      uploadAttachment
    }),
    [deleteMessage, editMessage, error, isLoading, messages, reactToMessage, retryMessage, searchMessages, sendMessage, uploadAttachment]
  );
};

export default useDirectMessages;
