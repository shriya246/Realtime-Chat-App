/**
 * Purpose: Provides room navigation, presence listing, current-user identity, and chat actions.
 */

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { DoorOpen, Hash, LockKeyhole, Plus, Search, X } from 'lucide-react';

import OnlineIndicator from './OnlineIndicator';

/**
 * Renders the navigation sidebar for available rooms and online users.
 *
 * @param {object} props - Sidebar data and actions.
 * @returns {JSX.Element} Chat navigation.
 */
const Sidebar = ({
  currentUser,
  error,
  isLoadingRooms,
  isMobileOpen,
  onCloseMobile,
  onCreateRoom,
  onLogout,
  onSelectRoom,
  onlineUsers,
  rooms,
  selectedRoomId
}) => {
  const [search, setSearch] = useState('');
  const filteredRooms = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return rooms;
    }

    return rooms.filter((room) => room.name.toLowerCase().includes(normalizedSearch));
  }, [rooms, search]);

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-20 flex w-[292px] flex-col border-r border-stroke bg-panel transition-transform lg:static lg:z-auto lg:translate-x-0',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <header className="flex h-16 items-center justify-between border-b border-stroke px-4">
        <div>
          <h1 className="text-lg font-semibold text-ink">ChatterBox</h1>
          <p className="text-xs text-muted">Shriya Patel</p>
        </div>
        <button aria-label="Close navigation" className="icon-button lg:hidden" onClick={onCloseMobile} type="button">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="border-b border-stroke p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
          <input
            aria-label="Search rooms"
            className="field pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search rooms"
            value={search}
          />
        </div>
      </div>

      <section className="flex min-h-0 flex-1 flex-col border-b border-stroke py-3">
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

      <section className="max-h-48 overflow-y-auto border-b border-stroke px-4 py-3">
        <h2 className="mb-3 text-xs font-semibold uppercase text-muted">Online - {onlineUsers.length}</h2>
        <ul className="space-y-3">
          {onlineUsers.map((onlineUser) => (
            <li className="flex items-center gap-2.5 text-sm text-muted" key={onlineUser.userId}>
              <OnlineIndicator isOnline />
              <span className="truncate">{onlineUser.username}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex h-16 items-center gap-3 px-4">
        <OnlineIndicator isOnline />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{currentUser.username}</span>
        <button aria-label="Log out" className="icon-button" onClick={onLogout} title="Log out" type="button">
          <DoorOpen className="h-5 w-5" />
        </button>
      </footer>
    </aside>
  );
};

export default Sidebar;
