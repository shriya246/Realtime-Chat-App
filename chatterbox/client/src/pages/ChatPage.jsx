/**
 * Purpose: Coordinates direct conversations, room retrieval, selected chat state, and real-time components.
 */

import { useCallback, useEffect, useState } from 'react';

import AdminDashboardPanel from '../components/AdminDashboardPanel';
import CallOverlay from '../components/CallOverlay';
import ChannelsPanel from '../components/ChannelsPanel';
import ChatWindow from '../components/ChatWindow';
import CreateRoomModal from '../components/CreateRoomModal';
import DirectChatWindow from '../components/DirectChatWindow';
import GroupDetailsModal from '../components/GroupDetailsModal';
import PrivacySettingsModal from '../components/PrivacySettingsModal';
import ProfileModal from '../components/ProfileModal';
import SessionManagementModal from '../components/SessionManagementModal';
import Sidebar from '../components/Sidebar';
import StatusPanel from '../components/StatusPanel';
import { useAuth } from '../context/AuthContext';
import useDirectMessages from '../hooks/useDirectMessages';
import useMessages from '../hooks/useMessages';
import useOnlineUsers from '../hooks/useOnlineUsers';
import useSocket from '../hooks/useSocket';
import useWebRtcCall from '../hooks/useWebRtcCall';
import api, { getApiErrorMessage } from '../services/api';

/**
 * Renders the authenticated chat workspace.
 *
 * @returns {JSX.Element} Main application page.
 */
const ChatPage = () => {
  const { logout, updateUser, user } = useAuth();
  const { connectionStatus, socket } = useSocket();
  const onlineUsers = useOnlineUsers();
  const [activeSection, setActiveSection] = useState('chats');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [conversationError, setConversationError] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [roomError, setRoomError] = useState('');
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isChannelsOpen, setIsChannelsOpen] = useState(false);
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const messageState = useMessages(selectedRoom?.id || null);
  const upsertConversation = useCallback((conversation) => {
    setConversations((currentConversations) => {
      const existingIndex = currentConversations.findIndex((entry) => entry.id === conversation.id);

      if (existingIndex >= 0) {
        const nextConversations = [...currentConversations];
        nextConversations[existingIndex] = conversation;
        return nextConversations.sort((first, second) => {
          if (first.settings?.pinned !== second.settings?.pinned) {
            return first.settings?.pinned ? -1 : 1;
          }

          return new Date(second.lastMessageTimestamp || second.updatedAt || 0) -
            new Date(first.lastMessageTimestamp || first.updatedAt || 0);
        });
      }

      return [conversation, ...currentConversations];
    });
    setSelectedConversation((currentConversation) =>
      currentConversation?.id === conversation.id ? conversation : currentConversation
    );
  }, []);
  const directMessageState = useDirectMessages(selectedConversation, upsertConversation);
  const callState = useWebRtcCall(socket);

  /**
   * Fetches rooms currently visible to the authenticated user.
   *
   * @returns {Promise<void>} Resolves after room retrieval.
   */
  const loadRooms = useCallback(async () => {
    try {
      setIsLoadingRooms(true);
      setRoomError('');
      const response = await api.get('/rooms');
      const availableRooms = response.data.data.rooms;

      setRooms(availableRooms);
      setSelectedRoom((currentRoom) => {
        if (currentRoom) {
          return availableRooms.find((room) => room.id === currentRoom.id) || availableRooms[0] || null;
        }

        return availableRooms[0] || null;
      });
    } catch (error) {
      setRoomError(getApiErrorMessage(error, 'Unable to load rooms.'));
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  /**
   * Fetches direct conversations for the authenticated user.
   *
   * @returns {Promise<void>} Resolves after conversation retrieval.
   */
  const loadConversations = useCallback(async () => {
    try {
      setIsLoadingConversations(true);
      setConversationError('');
      const response = await api.get('/conversations');
      const availableConversations = response.data.data.conversations;

      setConversations(availableConversations);
      setSelectedConversation((currentConversation) => {
        if (currentConversation) {
          return availableConversations.find((conversation) => conversation.id === currentConversation.id) || currentConversation;
        }

        return availableConversations[0] || null;
      });
    } catch (error) {
      setConversationError(getApiErrorMessage(error, 'Unable to load conversations.'));
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
    loadConversations();
  }, [loadConversations, loadRooms]);

  useEffect(() => {
    if (!isGroupDetailsOpen || !selectedRoom?.id) {
      return;
    }

    api.get(`/rooms/${selectedRoom.id}`)
      .then((response) => setSelectedRoom(response.data.data.room))
      .catch((error) => setRoomError(getApiErrorMessage(error, 'Unable to load group details.')));
  }, [isGroupDetailsOpen, selectedRoom?.id]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleConversationUpdated = (payload) => {
      if (payload.conversation) {
        upsertConversation(payload.conversation);
      }
    };
    const handleNewDirectMessage = (message) => {
      if (message.sender?.id === user.id || notificationPermission !== 'granted') {
        return;
      }

      const conversation = conversations.find((entry) => entry.id === message.conversationId);
      const isViewingConversation = selectedConversation?.id === message.conversationId && !document.hidden;

      if (conversation?.settings?.muted || isViewingConversation) {
        return;
      }

      new Notification(conversation?.participant?.displayName || conversation?.participant?.username || 'New message', {
        body: message.content,
        tag: message.conversationId
      });
    };

    socket.on('conversation:updated', handleConversationUpdated);
    socket.on('direct_message:new', handleNewDirectMessage);
    socket.on('media_message:new', handleNewDirectMessage);

    return () => {
      socket.off('conversation:updated', handleConversationUpdated);
      socket.off('direct_message:new', handleNewDirectMessage);
      socket.off('media_message:new', handleNewDirectMessage);
    };
  }, [conversations, notificationPermission, selectedConversation?.id, socket, upsertConversation, user.id]);

  useEffect(() => {
    const onlineUserIds = new Set(onlineUsers.map((onlineUser) => onlineUser.userId));

    setConversations((currentConversations) =>
      currentConversations.map((conversation) => ({
        ...conversation,
        participant: {
          ...conversation.participant,
          isOnline: onlineUserIds.has(conversation.participant?.id)
        }
      }))
    );
    setSelectedConversation((currentConversation) =>
      currentConversation
        ? {
            ...currentConversation,
            participant: {
              ...currentConversation.participant,
              isOnline: onlineUserIds.has(currentConversation.participant?.id)
            }
          }
        : currentConversation
    );
  }, [onlineUsers]);

  /**
   * Searches users for starting direct conversations.
   *
   * @param {string} search - Search string.
   * @returns {Promise<void>} Resolves after user search.
   */
  const handleSearchUsers = async (search) => {
    const trimmedSearch = search.trim();

    if (!trimmedSearch) {
      setUserSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    try {
      setIsSearchingUsers(true);
      const response = await api.get('/users', { params: { search: trimmedSearch } });
      const existingParticipantIds = new Set(conversations.map((conversation) => conversation.participant?.id));
      setUserSearchResults(
        response.data.data.users.filter(
          (result) => result.id !== user.id && !existingParticipantIds.has(result.id)
        )
      );
    } catch (error) {
      setConversationError(getApiErrorMessage(error, 'Unable to search users.'));
    } finally {
      setIsSearchingUsers(false);
    }
  };

  /**
   * Creates or opens a direct conversation with a searched user.
   *
   * @param {object} targetUser - User search result.
   * @returns {Promise<void>} Resolves after selection.
   */
  const handleStartConversation = async (targetUser) => {
    try {
      setConversationError('');
      const response = await api.post('/conversations/direct', { targetUserId: targetUser.id });
      const conversation = response.data.data.conversation;

      upsertConversation(conversation);
      setSelectedConversation(conversation);
      setSelectedRoom(null);
      setActiveSection('chats');
    } catch (error) {
      setConversationError(getApiErrorMessage(error, 'Unable to start conversation.'));
    }
  };

  /**
   * Creates and selects a new room.
   *
   * @param {{ name: string, type: string }} roomValues - New room payload.
   * @returns {Promise<void>} Resolves after room creation.
   */
  const handleCreateRoom = async (roomValues) => {
    try {
      setIsCreatingRoom(true);
      setRoomError('');
      const response = await api.post('/rooms', roomValues);
      const createdRoom = response.data.data.room;

      setRooms((currentRooms) => [createdRoom, ...currentRooms]);
      setSelectedRoom(createdRoom);
      setSelectedConversation(null);
      setActiveSection('rooms');
      setIsCreateRoomOpen(false);
    } catch (error) {
      setRoomError(getApiErrorMessage(error, 'Unable to create room.'));
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleRequestNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const handleUpdateConversationSettings = async (conversation, updates) => {
    try {
      const response = await api.patch(`/conversations/${conversation.id}/settings`, updates);
      upsertConversation(response.data.data.conversation);
    } catch (error) {
      setConversationError(getApiErrorMessage(error, 'Unable to update chat settings.'));
    }
  };

  const handleUnlockConversation = async (secret) => {
    try {
      const response = await api.post(`/conversations/${selectedConversation.id}/unlock`, {
        password: secret,
        pin: secret
      });
      upsertConversation(response.data.data.conversation);
      return true;
    } catch (error) {
      setConversationError(getApiErrorMessage(error, 'Unable to unlock chat.'));
      return false;
    }
  };

  const handleToggleDisappearing = async (mode) => {
    try {
      const response = await api.patch(`/conversations/${selectedConversation.id}/disappearing`, {
        disappearingMode: mode
      });
      upsertConversation(response.data.data.conversation);
    } catch (error) {
      setConversationError(getApiErrorMessage(error, 'Unable to update disappearing messages.'));
    }
  };

  const handleToggleEncryption = async (enabled) => {
    try {
      const response = await api.patch(`/conversations/${selectedConversation.id}/encryption`, { enabled });
      upsertConversation(response.data.data.conversation);
    } catch (error) {
      setConversationError(getApiErrorMessage(error, 'Unable to update encrypted demo mode.'));
    }
  };

  const handleBlockUser = async (targetUser) => {
    if (!targetUser?.id) {
      return;
    }

    try {
      await api.post(`/users/${targetUser.id}/block`);
      setConversations((currentConversations) => currentConversations.filter((conversation) => conversation.participant?.id !== targetUser.id));
      setSelectedConversation(null);
      setIsMobileNavigationOpen(true);
    } catch (error) {
      setConversationError(getApiErrorMessage(error, 'Unable to block user.'));
    }
  };

  const handleReport = async (payload) => {
    try {
      await api.post('/reports', payload);
      setConversationError('');
    } catch (error) {
      setConversationError(getApiErrorMessage(error, 'Unable to create report.'));
    }
  };

  const handleSavePrivacy = async (settings) => {
    try {
      const response = await api.patch('/users/me/privacy', settings);
      updateUser(response.data.data.user);
      setIsPrivacyOpen(false);
    } catch (error) {
      setConversationError(getApiErrorMessage(error, 'Unable to update privacy settings.'));
    }
  };

  const handleSaveGroup = async (updates) => {
    try {
      const response = await api.patch(`/rooms/${selectedRoom.id}`, updates);
      setSelectedRoom(response.data.data.room);
      setRooms((currentRooms) => currentRooms.map((room) => (room.id === selectedRoom.id ? response.data.data.room : room)));
    } catch (error) {
      setRoomError(getApiErrorMessage(error, 'Unable to update group.'));
    }
  };

  const handleSaveProfile = async ({ about, avatarFile, displayName }) => {
    try {
      setIsSavingProfile(true);
      let avatarAttachmentId = user.avatarAttachmentId || null;

      if (avatarFile) {
        const uploadResponse = await api.post('/attachments?purpose=avatar', avatarFile, {
          headers: {
            'Content-Type': avatarFile.type || 'application/octet-stream',
            'X-File-Name': encodeURIComponent(avatarFile.name)
          }
        });
        avatarAttachmentId = uploadResponse.data.data.attachment.id;
      }

      const response = await api.patch('/users/me', { about, avatarAttachmentId, displayName });
      updateUser(response.data.data.user);
      setIsProfileOpen(false);
    } catch (error) {
      setConversationError(getApiErrorMessage(error, 'Unable to update profile.'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      {isMobileNavigationOpen && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-10 bg-black/55 lg:hidden"
          onClick={() => setIsMobileNavigationOpen(false)}
          type="button"
        />
      )}
      <Sidebar
        activeSection={activeSection}
        conversations={conversations}
        currentUser={user}
        error={!isCreateRoomOpen ? (activeSection === 'rooms' ? roomError : conversationError) : ''}
        isLoadingConversations={isLoadingConversations}
        isLoadingRooms={isLoadingRooms}
        isMobileOpen={isMobileNavigationOpen}
        isSearchingUsers={isSearchingUsers}
        onCloseMobile={() => setIsMobileNavigationOpen(false)}
        onCreateRoom={() => {
          setRoomError('');
          setIsCreateRoomOpen(true);
        }}
        onLogout={logout}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenStatus={() => setIsStatusOpen(true)}
        onOpenChannels={() => setIsChannelsOpen(true)}
        onOpenSessions={() => setIsSessionsOpen(true)}
        onOpenDashboard={() => setIsDashboardOpen(true)}
        onRequestNotifications={handleRequestNotifications}
        onSearchUsers={handleSearchUsers}
        onSelectConversation={(conversation) => {
          setSelectedConversation(conversation);
          setSelectedRoom(null);
          setActiveSection('chats');
        }}
        onSelectRoom={(room) => {
          setSelectedRoom(room);
          setSelectedConversation(null);
          setActiveSection('rooms');
        }}
        onStartConversation={handleStartConversation}
        onSwitchSection={setActiveSection}
        onUpdateConversationSettings={handleUpdateConversationSettings}
        notificationPermission={notificationPermission}
        onlineUsers={onlineUsers}
        rooms={rooms}
        searchResults={userSearchResults}
        selectedConversationId={selectedConversation?.id}
        selectedRoomId={selectedRoom?.id}
      />
      {selectedConversation ? (
        <DirectChatWindow
          connectionStatus={connectionStatus}
          conversation={selectedConversation}
          currentUser={user}
          deleteMessage={directMessageState.deleteMessage}
          editMessage={directMessageState.editMessage}
          error={directMessageState.error || conversationError}
          isLoading={directMessageState.isLoading}
          messages={directMessageState.messages}
          onBack={() => {
            setSelectedConversation(null);
            setIsMobileNavigationOpen(true);
          }}
          onBlockUser={handleBlockUser}
          onLockChat={() => handleUpdateConversationSettings(selectedConversation, { locked: true })}
          onReport={handleReport}
          onStartVideoCall={(conversation) => callState.startCall(conversation, 'video')}
          onStartVoiceCall={(conversation) => callState.startCall(conversation, 'audio')}
          onToggleDisappearing={handleToggleDisappearing}
          onToggleEncryption={handleToggleEncryption}
          onUnlockChat={handleUnlockConversation}
          reactToMessage={directMessageState.reactToMessage}
          retryMessage={directMessageState.retryMessage}
          searchMessages={directMessageState.searchMessages}
          sendMessage={directMessageState.sendMessage}
          uploadAttachment={directMessageState.uploadAttachment}
        />
      ) : (
        <ChatWindow
          connectionStatus={connectionStatus}
          currentUser={user}
          emitTyping={messageState.emitTyping}
          error={messageState.error}
          isLoading={messageState.isLoading}
          messages={messageState.messages}
          onOpenGroupDetails={() => setIsGroupDetailsOpen(true)}
          onOpenNavigation={() => setIsMobileNavigationOpen(true)}
          room={selectedRoom}
          sendMessage={messageState.sendMessage}
          typingUsers={messageState.typingUsers}
        />
      )}
      <CreateRoomModal
        error={roomError}
        isOpen={isCreateRoomOpen}
        isSubmitting={isCreatingRoom}
        onClose={() => setIsCreateRoomOpen(false)}
        onCreate={handleCreateRoom}
      />
      <ProfileModal
        currentUser={user}
        error={conversationError}
        isOpen={isProfileOpen}
        isSaving={isSavingProfile}
        onClose={() => setIsProfileOpen(false)}
        onSave={handleSaveProfile}
      />
      <PrivacySettingsModal
        currentUser={user}
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
        onSave={handleSavePrivacy}
      />
      <GroupDetailsModal
        currentUser={user}
        isOpen={isGroupDetailsOpen}
        onClose={() => setIsGroupDetailsOpen(false)}
        onSave={handleSaveGroup}
        room={selectedRoom}
      />
      <StatusPanel
        currentUser={user}
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
      />
      <ChannelsPanel
        isOpen={isChannelsOpen}
        onClose={() => setIsChannelsOpen(false)}
      />
      <SessionManagementModal
        isOpen={isSessionsOpen}
        onClose={() => setIsSessionsOpen(false)}
      />
      <AdminDashboardPanel
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
      />
      <CallOverlay {...callState} />
    </div>
  );
};

export default ChatPage;
