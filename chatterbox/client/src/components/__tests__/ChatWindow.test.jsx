/**
 * Purpose: Verifies selected-room message rendering, typing feedback, and message composition actions.
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ChatWindow from '../ChatWindow';

const defaultProps = {
  connectionStatus: 'connected',
  currentUser: { id: 'current-user', username: 'shriya' },
  emitTyping: jest.fn(),
  error: '',
  isLoading: false,
  messages: [
    {
      content: 'Welcome to General',
      id: 'message-1',
      roomId: 'room-1',
      sender: { id: 'other-user', username: 'Alex' },
      status: 'delivered',
      timestamp: '2026-05-25T12:00:00.000Z'
    }
  ],
  onOpenNavigation: jest.fn(),
  room: { id: 'room-1', memberCount: 2, name: 'General', type: 'public' },
  sendMessage: jest.fn().mockReturnValue(true),
  typingUsers: [{ userId: 'other-user', username: 'Alex' }]
};

describe('ChatWindow', () => {
  beforeEach(() => {
    defaultProps.emitTyping.mockClear();
    defaultProps.sendMessage.mockClear();
  });

  test('renders selected room messages and typing feedback', () => {
    render(<ChatWindow {...defaultProps} />);

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Welcome to General')).toBeInTheDocument();
    expect(screen.getByText('Alex is typing...')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  test('emits typing and submits a composed message', async () => {
    const user = userEvent.setup();
    render(<ChatWindow {...defaultProps} />);

    await act(async () => {
      await user.type(screen.getByLabelText('Message'), 'New message');
      await user.click(screen.getByRole('button', { name: 'Send message' }));
    });

    expect(defaultProps.emitTyping).toHaveBeenCalledWith(true);
    expect(defaultProps.sendMessage).toHaveBeenCalledWith('New message');
    expect(screen.getByLabelText('Message')).toHaveValue('');
  });
});
