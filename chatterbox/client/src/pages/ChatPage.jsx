/**
 * Purpose: Coordinates protected room retrieval, selected conversation state, and real-time chat components.
 */

import { useCallback, useEffect, useState } from 'react';

import ChatWindow from '../components/ChatWindow';
import CreateRoomModal from '../components/CreateRoomModal';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import useMessages from '../hooks/useMessages';
import useOnlineUsers from '../hooks/useOnlineUsers';
import useSocket from '../hooks/useSocket';
import api, { getApiErrorMessage } from '../services/api';

/**
 * Renders the authenticated chat workspace.
 *
 * @returns {JSX.Element} Main application page.
 */
const ChatPage = () => {
  const { logout, user } = useAuth();
  const { connectionStatus } = useSocket();
  const onlineUsers = useOnlineUsers();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [roomError, setRoomError] = useState('');
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const messageState = useMessages(selectedRoom?.id || null);

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

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

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
      setIsCreateRoomOpen(false);
    } catch (error) {
      setRoomError(getApiErrorMessage(error, 'Unable to create room.'));
    } finally {
      setIsCreatingRoom(false);
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
        currentUser={user}
        error={!isCreateRoomOpen ? roomError : ''}
        isLoadingRooms={isLoadingRooms}
        isMobileOpen={isMobileNavigationOpen}
        onCloseMobile={() => setIsMobileNavigationOpen(false)}
        onCreateRoom={() => {
          setRoomError('');
          setIsCreateRoomOpen(true);
        }}
        onLogout={logout}
        onSelectRoom={setSelectedRoom}
        onlineUsers={onlineUsers}
        rooms={rooms}
        selectedRoomId={selectedRoom?.id}
      />
      <ChatWindow
        connectionStatus={connectionStatus}
        currentUser={user}
        emitTyping={messageState.emitTyping}
        error={messageState.error}
        isLoading={messageState.isLoading}
        messages={messageState.messages}
        onOpenNavigation={() => setIsMobileNavigationOpen(true)}
        room={selectedRoom}
        sendMessage={messageState.sendMessage}
        typingUsers={messageState.typingUsers}
      />
      <CreateRoomModal
        error={roomError}
        isOpen={isCreateRoomOpen}
        isSubmitting={isCreatingRoom}
        onClose={() => setIsCreateRoomOpen(false)}
        onCreate={handleCreateRoom}
      />
    </div>
  );
};

export default ChatPage;
