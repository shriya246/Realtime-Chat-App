/**
 * Purpose: Provides the active room header, live message stream, typing state, and composer.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Hash, LockKeyhole, Menu, SendHorizontal, Users } from 'lucide-react';

import MessageBubble from './MessageBubble';

/**
 * Renders a selected real-time room and its message composer.
 *
 * @param {object} props - Room state, messages, and actions.
 * @returns {JSX.Element} Conversation workspace.
 */
const ChatWindow = ({
  connectionStatus,
  currentUser,
  emitTyping,
  error,
  isLoading,
  messages,
  onOpenNavigation,
  room,
  sendMessage,
  typingUsers
}) => {
  const [content, setContent] = useState('');
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setContent('');
  }, [room?.id]);

  /**
   * Sends the drafted message when valid.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} event - Message submit event.
   * @returns {void}
   */
  const handleSend = (event) => {
    event.preventDefault();

    if (sendMessage(content)) {
      setContent('');
      emitTyping(false);
    }
  };

  /**
   * Updates content and typing state.
   *
   * @param {import('react').ChangeEvent<HTMLInputElement>} event - Input change event.
   * @returns {void}
   */
  const handleChange = (event) => {
    const nextContent = event.target.value;
    setContent(nextContent);
    emitTyping(Boolean(nextContent.trim()));
  };

  if (!room) {
    return (
      <main className="flex min-w-0 flex-1 flex-col bg-canvas">
        <div className="flex h-16 items-center border-b border-stroke px-4 lg:hidden">
          <button aria-label="Open navigation" className="icon-button" onClick={onOpenNavigation} type="button">
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-3 font-semibold text-ink">ChatterBox</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-sm text-muted">Select a room to begin.</div>
      </main>
    );
  }

  const RoomIcon = room.type === 'private' ? LockKeyhole : Hash;
  const typingLabel =
    typingUsers.length === 1
      ? `${typingUsers[0].username} is typing...`
      : typingUsers.length > 1
        ? `${typingUsers.length} people are typing...`
        : '';

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-stroke px-4 sm:px-5">
        <button aria-label="Open navigation" className="icon-button lg:hidden" onClick={onOpenNavigation} type="button">
          <Menu className="h-5 w-5" />
        </button>
        <RoomIcon className="h-5 w-5 text-muted" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-ink">{room.name}</h2>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Users className="h-3.5 w-3.5" />
            {room.memberCount} member{room.memberCount === 1 ? '' : 's'}
          </p>
        </div>
        <span className="hidden rounded-md border border-stroke bg-panel px-2.5 py-1 text-xs text-muted sm:inline-flex">
          {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'reconnecting' ? 'Reconnecting' : 'Offline'}
        </span>
      </header>

      {error && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-md border border-coral/35 bg-coral/10 px-3 py-2 text-sm text-coral sm:mx-5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5" aria-label="Messages">
        {isLoading && <p className="pt-8 text-center text-sm text-muted">Loading messages...</p>}
        {!isLoading && messages.length === 0 && <p className="pt-8 text-center text-sm text-muted">No messages yet.</p>}
        {messages.map((message) => (
          <MessageBubble currentUserId={currentUser.id} key={message.id} message={message} />
        ))}
        <div ref={messageEndRef} />
      </section>

      <div className="h-6 shrink-0 px-4 text-xs text-muted sm:px-5" aria-live="polite">
        {typingLabel}
      </div>

      <form className="flex shrink-0 items-end gap-3 border-t border-stroke bg-panel p-4 sm:px-5" onSubmit={handleSend}>
        <input
          aria-label="Message"
          className="field flex-1"
          maxLength={2000}
          onChange={handleChange}
          placeholder={`Message #${room.name}`}
          value={content}
        />
        <button aria-label="Send message" className="primary-button w-11 px-0" disabled={!content.trim()} title="Send message" type="submit">
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </main>
  );
};

export default ChatWindow;
