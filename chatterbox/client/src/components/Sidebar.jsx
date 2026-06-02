/**
 * Purpose: Provides WhatsApp-style direct-chat navigation while keeping room chat accessible.
 */

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Archive, Bell, BellOff, DoorOpen, Hash, LockKeyhole, MessageCircle, Pin, Plus, Search, UserRound, Users, VolumeX, X } from 'lucide-react';

import OnlineIndicator from './OnlineIndicator';
import { formatMessageTime } from '../utils/formatTime';

/**
 * Renders a compact avatar placeholder.
 *
 * @param {{ name: string, isOnline?: boolean }} props - Avatar inputs.
 * @returns {JSX.Element} Avatar node.
 */
const Avatar = ({ avatarUrl = null, isOnline = false, name }) => (
  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-raised text-sm font-bold text-ink">
    {avatarUrl ? <img alt="" className="h-full w-full rounded-full object-cover" src={avatarUrl} /> : name?.slice(0, 1).toUpperCase() || '?'}
    {isOnline && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-panel bg-accent" />}
  </span>
);

/**
 * Renders the chat navigation sidebar.
 *
 * @param {object} props - Sidebar data and actions.
 * @returns {JSX.Element} Chat navigation.
 */
const Sidebar = ({
  activeSection,
  conversations = [],
  currentUser,
  error,
  isLoadingConversations = false,
  isLoadingRooms,
  isMobileOpen,
  isSearchingUsers = false,
  onCloseMobile,
  onCreateRoom,
  onLogout,
  onOpenProfile = () => undefined,
  onRequestNotifications = () => undefined,
  onSearchUsers = () => undefined,
  onSelectConversation = () => undefined,
  onSelectRoom,
  onStartConversation = () => undefined,
  onSwitchSection = () => undefined,
  onUpdateConversationSettings = () => undefined,
  notificationPermission = 'default',
  onlineUsers,
  rooms,
  searchResults = [],
  selectedConversationId,
  selectedRoomId
}) => {
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRooms = useMemo(() => {
    if (!normalizedSearch) {
      return rooms;
    }

    return rooms.filter((room) => room.name.toLowerCase().includes(normalizedSearch));
  }, [normalizedSearch, rooms]);
  const filteredConversations = useMemo(() => {
    if (!normalizedSearch) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const searchable = [
        conversation.participant?.username,
        conversation.participant?.email,
        conversation.lastMessagePreview
      ].join(' ').toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [conversations, normalizedSearch]);
  const activeConversations = filteredConversations.filter((conversation) => !conversation.settings?.archived);
  const archivedConversations = filteredConversations.filter((conversation) => conversation.settings?.archived);

  const renderConversation = (conversation) => (
    <div
      className={clsx(
        'flex w-full items-center gap-2 px-3 py-2 transition hover:bg-raised/70',
        selectedConversationId === conversation.id && 'bg-raised'
      )}
      key={conversation.id}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => {
          onSelectConversation(conversation);
          onCloseMobile();
        }}
        type="button"
      >
        <Avatar avatarUrl={conversation.participant?.avatarUrl} isOnline={conversation.participant?.isOnline} name={conversation.participant?.displayName || conversation.participant?.username} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold text-ink">{conversation.participant?.displayName || conversation.participant?.username}</span>
            {conversation.lastMessageTimestamp && (
              <time className="shrink-0 text-[11px] text-muted" dateTime={conversation.lastMessageTimestamp}>
                {formatMessageTime(conversation.lastMessageTimestamp)}
              </time>
            )}
          </span>
          <span className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted">{conversation.lastMessagePreview || 'No messages yet'}</span>
            {conversation.unreadCount > 0 && (
              <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-canvas">
                {conversation.unreadCount}
              </span>
            )}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 flex-col gap-1">
        <button
          aria-label={conversation.settings?.pinned ? 'Unpin chat' : 'Pin chat'}
          className={clsx('icon-button h-7 w-7', conversation.settings?.pinned && 'text-accent')}
          onClick={() => onUpdateConversationSettings(conversation, { pinned: !conversation.settings?.pinned })}
          type="button"
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
        <button
          aria-label={conversation.settings?.muted ? 'Unmute chat' : 'Mute chat'}
          className={clsx('icon-button h-7 w-7', conversation.settings?.muted && 'text-coral')}
          onClick={() => onUpdateConversationSettings(conversation, { muted: !conversation.settings?.muted })}
          type="button"
        >
          <VolumeX className="h-3.5 w-3.5" />
        </button>
        <button
          aria-label={conversation.settings?.archived ? 'Unarchive chat' : 'Archive chat'}
          className={clsx('icon-button h-7 w-7', conversation.settings?.archived && 'text-accent')}
          onClick={() => onUpdateConversationSettings(conversation, { archived: !conversation.settings?.archived })}
          type="button"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  const handleSearchChange = (event) => {
    const nextSearch = event.target.value;
    setSearch(nextSearch);

    if (activeSection === 'chats') {
      onSearchUsers(nextSearch);
    }
  };

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-20 flex w-full max-w-[380px] flex-col border-r border-stroke bg-panel transition-transform lg:static lg:z-auto lg:w-[360px] lg:translate-x-0',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      <header className="flex h-16 items-center justify-between border-b border-stroke px-4">
        <div>
          <h1 className="text-lg font-semibold text-ink">ChatterBox</h1>
          <p className="text-xs text-muted">v2.5 media messaging</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Enable notifications"
            className={clsx('icon-button', notificationPermission === 'granted' && 'text-accent')}
            onClick={onRequestNotifications}
            type="button"
          >
            {notificationPermission === 'granted' ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </button>
          <button aria-label="Close navigation" className="icon-button lg:hidden" onClick={onCloseMobile} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="border-b border-stroke p-3">
        <div className="grid grid-cols-2 rounded-md bg-canvas p-1">
          <button
            className={clsx('flex h-9 items-center justify-center gap-2 rounded text-sm font-semibold transition', activeSection === 'chats' ? 'bg-raised text-ink' : 'text-muted hover:text-ink')}
            onClick={() => {
              setSearch('');
              onSwitchSection('chats');
            }}
            type="button"
          >
            <MessageCircle className="h-4 w-4" />
            Chats
          </button>
          <button
            className={clsx('flex h-9 items-center justify-center gap-2 rounded text-sm font-semibold transition', activeSection === 'rooms' ? 'bg-raised text-ink' : 'text-muted hover:text-ink')}
            onClick={() => {
              setSearch('');
              onSwitchSection('rooms');
            }}
            type="button"
          >
            <Hash className="h-4 w-4" />
            Rooms
          </button>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
          <input
            aria-label={activeSection === 'chats' ? 'Search chats or users' : 'Search rooms'}
            className="field pl-9"
            onChange={handleSearchChange}
            placeholder={activeSection === 'chats' ? 'Search chats or users' : 'Search rooms'}
            value={search}
          />
        </div>
      </div>

      {activeSection === 'chats' ? (
        <section className="min-h-0 flex-1 overflow-y-auto py-2" aria-label="Conversations">
          {error && <p className="px-4 py-3 text-sm text-coral">{error}</p>}
          {isLoadingConversations && <p className="px-4 py-3 text-sm text-muted">Loading chats...</p>}
          {!isLoadingConversations && filteredConversations.length === 0 && !normalizedSearch && (
            <p className="px-4 py-3 text-sm text-muted">Search for someone to start a chat.</p>
          )}
          {activeConversations.map(renderConversation)}
          {archivedConversations.length > 0 && (
            <div className="mt-3 border-t border-stroke pt-3">
              <h2 className="px-4 pb-2 text-xs font-semibold uppercase text-muted">Archived</h2>
              {archivedConversations.map(renderConversation)}
            </div>
          )}

          {normalizedSearch && (
            <div className="mt-3 border-t border-stroke pt-3">
              <h2 className="px-4 pb-2 text-xs font-semibold uppercase text-muted">People</h2>
              {isSearchingUsers && <p className="px-4 py-3 text-sm text-muted">Searching...</p>}
              {!isSearchingUsers && searchResults.length === 0 && <p className="px-4 py-3 text-sm text-muted">No people found.</p>}
              {searchResults.map((result) => (
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-raised/70"
                  key={result.id}
                  onClick={() => {
                    onStartConversation(result);
                    setSearch('');
                    onCloseMobile();
                  }}
                  type="button"
                >
                  <Avatar avatarUrl={result.avatarUrl} name={result.displayName || result.username} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{result.displayName || result.username}</span>
                    <span className="block truncate text-xs text-muted">{result.email}</span>
                  </span>
                  <Plus className="h-4 w-4 text-muted" />
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="flex min-h-0 flex-1 flex-col py-3">
          <div className="mb-2 flex items-center justify-between px-4">
            <h2 className="text-xs font-semibold uppercase text-muted">Rooms</h2>
            <button aria-label="Create room" className="icon-button h-8 w-8" onClick={onCreateRoom} title="Create room" type="button">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <nav className="min-h-0 overflow-y-auto px-2" aria-label="Rooms">
            {isLoadingRooms && <p className="px-2 py-3 text-sm text-muted">Loading...</p>}
            {!isLoadingRooms && error && <p className="px-2 py-3 text-sm text-coral">{error}</p>}
            {!isLoadingRooms && filteredRooms.length === 0 && <p className="px-2 py-3 text-sm text-muted">No rooms found.</p>}
            {filteredRooms.map((room) => {
              const Icon = room.type === 'private' ? LockKeyhole : Hash;

              return (
                <button
                  className={clsx(
                    'mb-1 flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition',
                    selectedRoomId === room.id ? 'bg-raised text-ink' : 'text-muted hover:bg-raised/70 hover:text-ink'
                  )}
                  key={room.id}
                  onClick={() => {
                    onSelectRoom(room);
                    onCloseMobile();
                  }}
                  type="button"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{room.name}</span>
                </button>
              );
            })}
          </nav>
        </section>
      )}

      <section className="max-h-36 overflow-y-auto border-t border-stroke px-4 py-3">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-muted">
          <Users className="h-3.5 w-3.5" />
          Online - {onlineUsers.length}
        </h2>
        <ul className="space-y-3">
          {onlineUsers.map((onlineUser) => (
            <li className="flex items-center gap-2.5 text-sm text-muted" key={onlineUser.userId}>
              <OnlineIndicator isOnline />
              <span className="truncate">{onlineUser.username}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex h-16 items-center gap-3 border-t border-stroke px-4">
        <OnlineIndicator isOnline />
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={onOpenProfile} type="button">
          <UserRound className="h-4 w-4 shrink-0 text-muted" />
          <span className="truncate text-sm font-medium text-ink">{currentUser.displayName || currentUser.username}</span>
        </button>
        <button aria-label="Log out" className="icon-button" onClick={onLogout} title="Log out" type="button">
          <DoorOpen className="h-5 w-5" />
        </button>
      </footer>
    </aside>
  );
};

export default Sidebar;
