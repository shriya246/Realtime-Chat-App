/**
 * Purpose: Verifies message ownership styling, sender display, and queued/delivered state rendering.
 */

import { render, screen } from '@testing-library/react';

import MessageBubble from '../MessageBubble';

const baseMessage = {
  content: 'Hello there',
  id: 'message-1',
  sender: {
    id: 'sender-1',
    username: 'Shriya'
  },
  status: 'delivered',
  timestamp: '2026-05-25T12:00:00.000Z'
};

describe('MessageBubble', () => {
  test('aligns the current user message and displays delivery status', () => {
    const { container } = render(<MessageBubble currentUserId="sender-1" message={baseMessage} />);

    expect(container.firstChild).toHaveClass('justify-end');
    expect(screen.getByLabelText('Delivered')).toBeInTheDocument();
    expect(screen.queryByText('Shriya')).not.toBeInTheDocument();
  });

  test('aligns another user message and displays the sender name', () => {
    const { container } = render(<MessageBubble currentUserId="another-user" message={baseMessage} />);

    expect(container.firstChild).toHaveClass('justify-start');
    expect(screen.getByText('Shriya')).toBeInTheDocument();
    expect(screen.queryByLabelText('Delivered')).not.toBeInTheDocument();
  });

  test('labels an offline queued outgoing message', () => {
    render(
      <MessageBubble
        currentUserId="sender-1"
        message={{ ...baseMessage, isPending: true, status: 'queued' }}
      />
    );

    expect(screen.getByLabelText('Queued for reconnect')).toBeInTheDocument();
  });
});
