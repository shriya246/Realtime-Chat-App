/**
 * Purpose: Verifies v2 conversation-list rendering and user-search start-chat behavior.
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Sidebar from '../Sidebar';

const defaultProps = {
  activeSection: 'chats',
  conversations: [
    {
      id: 'conversation-1',
      lastMessagePreview: 'Latest direct message',
      lastMessageTimestamp: '2026-05-25T12:00:00.000Z',
      participant: {
        email: 'alex@example.com',
        id: 'user-2',
        isOnline: true,
        username: 'alex'
      },
      unreadCount: 3
    }
  ],
  currentUser: { id: 'user-1', username: 'shriya' },
  error: '',
  isLoadingConversations: false,
  isLoadingRooms: false,
  isMobileOpen: true,
  isSearchingUsers: false,
  onCloseMobile: jest.fn(),
  onCreateRoom: jest.fn(),
  onLogout: jest.fn(),
  onSearchUsers: jest.fn(),
  onSelectConversation: jest.fn(),
  onSelectRoom: jest.fn(),
  onStartConversation: jest.fn(),
  onSwitchSection: jest.fn(),
  onlineUsers: [],
  rooms: [],
  searchResults: [],
  selectedConversationId: null,
  selectedRoomId: null
};

describe('Sidebar', () => {
  beforeEach(() => {
    Object.values(defaultProps).forEach((value) => {
      if (typeof value === 'function') {
        value.mockClear();
      }
    });
  });

  test('renders WhatsApp-style conversation rows with preview and unread count', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText('alex')).toBeInTheDocument();
    expect(screen.getByText('Latest direct message')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /chats/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rooms/i })).toBeInTheDocument();
  });

  test('searches people and starts a direct chat from results', async () => {
    const user = userEvent.setup();
    const onSearchUsers = jest.fn();
    const onStartConversation = jest.fn();

    render(
      <Sidebar
        {...defaultProps}
        conversations={[]}
        onSearchUsers={onSearchUsers}
        onStartConversation={onStartConversation}
        searchResults={[{ email: 'mira@example.com', id: 'user-3', username: 'mira' }]}
      />
    );

    await act(async () => {
      await user.type(screen.getByLabelText('Search chats or users'), 'mira');
      await user.click(screen.getByText('mira'));
    });

    expect(onSearchUsers).toHaveBeenCalled();
    expect(onStartConversation).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-3' }));
  });

  test('requests notification permission from the sidebar control', async () => {
    const user = userEvent.setup();
    const onRequestNotifications = jest.fn();

    render(<Sidebar {...defaultProps} onRequestNotifications={onRequestNotifications} />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Enable notifications' }));
    });

    expect(onRequestNotifications).toHaveBeenCalledTimes(1);
  });

  test('supports pinned muted archived controls and archived grouping', async () => {
    const user = userEvent.setup();
    const onUpdateConversationSettings = jest.fn();
    const conversations = [
      {
        ...defaultProps.conversations[0],
        settings: { archived: false, muted: false, pinned: false }
      },
      {
        id: 'conversation-2',
        lastMessagePreview: 'Packed away',
        participant: {
          email: 'mira@example.com',
          id: 'user-3',
          username: 'mira'
        },
        settings: { archived: true, muted: true, pinned: true },
        unreadCount: 0
      }
    ];

    render(
      <Sidebar
        {...defaultProps}
        conversations={conversations}
        onUpdateConversationSettings={onUpdateConversationSettings}
      />
    );

    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('mira')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Pin chat' }));
      await user.click(screen.getByRole('button', { name: 'Mute chat' }));
      await user.click(screen.getByRole('button', { name: 'Archive chat' }));
      await user.click(screen.getByRole('button', { name: 'Unarchive chat' }));
    });

    expect(onUpdateConversationSettings).toHaveBeenCalledWith(conversations[0], { pinned: true });
    expect(onUpdateConversationSettings).toHaveBeenCalledWith(conversations[0], { muted: true });
    expect(onUpdateConversationSettings).toHaveBeenCalledWith(conversations[0], { archived: true });
    expect(onUpdateConversationSettings).toHaveBeenCalledWith(conversations[1], { archived: false });
  });
});
