/**
 * Purpose: Verifies direct chat rendering, optimistic status, replies, sending, and reactions.
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DirectChatWindow from '../DirectChatWindow';

const baseConversation = {
  id: 'conversation-1',
  participant: {
    id: 'user-2',
    isOnline: true,
    username: 'alex'
  }
};

const baseMessage = {
  content: 'Can you reply?',
  conversationId: 'conversation-1',
  id: 'message-1',
  reactions: [],
  sender: {
    id: 'user-2',
    username: 'alex'
  },
  status: 'delivered',
  timestamp: '2026-05-25T12:00:00.000Z',
  type: 'text'
};

const defaultProps = {
  connectionStatus: 'connected',
  conversation: baseConversation,
  currentUser: { id: 'user-1', username: 'shriya' },
  deleteMessage: jest.fn(),
  editMessage: jest.fn(),
  error: '',
  isLoading: false,
  messages: [baseMessage],
  onBack: jest.fn(),
  reactToMessage: jest.fn(),
  retryMessage: jest.fn(),
  sendMessage: jest.fn().mockReturnValue(true)
};

describe('DirectChatWindow', () => {
  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:attachment-preview');
    URL.revokeObjectURL = jest.fn();
    defaultProps.deleteMessage.mockClear();
    defaultProps.editMessage.mockClear();
    defaultProps.onBack.mockClear();
    defaultProps.reactToMessage.mockClear();
    defaultProps.retryMessage.mockClear();
    defaultProps.sendMessage.mockClear();
  });

  test('opens a direct chat and displays optimistic sending state', () => {
    render(
      <DirectChatWindow
        {...defaultProps}
        messages={[
          baseMessage,
          {
            content: 'On the way',
            conversationId: 'conversation-1',
            id: 'client-1',
            isPending: true,
            sender: { id: 'user-1', username: 'shriya' },
            status: 'sending',
            timestamp: '2026-05-25T12:01:00.000Z',
            type: 'text'
          }
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: 'alex' })).toBeInTheDocument();
    expect(screen.getByText('Can you reply?')).toBeInTheDocument();
    expect(screen.getByLabelText('Sending')).toBeInTheDocument();
  });

  test('sends a direct message from the composer', async () => {
    const user = userEvent.setup();
    render(<DirectChatWindow {...defaultProps} />);

    await act(async () => {
      await user.type(screen.getByLabelText('Direct message'), 'Hello Alex');
      await user.click(screen.getByRole('button', { name: 'Send direct message' }));
    });

    expect(defaultProps.sendMessage).toHaveBeenCalledWith('Hello Alex', null, null);
    expect(screen.getByLabelText('Direct message')).toHaveValue('');
  });

  test('shows reply preview and sends with reply target', async () => {
    const user = userEvent.setup();
    render(<DirectChatWindow {...defaultProps} />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Can you reply/ }));
    });

    await act(async () => {
      await user.click(await screen.findByRole('button', { name: 'Reply' }));
      await user.type(screen.getByLabelText('Direct message'), 'Replying now');
      await user.click(screen.getByRole('button', { name: 'Send direct message' }));
    });

    expect(screen.queryByText(/Replying to alex/i)).not.toBeInTheDocument();
    expect(defaultProps.sendMessage).toHaveBeenCalledWith('Replying now', 'message-1', null);
  });

  test('calls reaction handler from the message action bar', async () => {
    const user = userEvent.setup();
    render(<DirectChatWindow {...defaultProps} />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Can you reply/ }));
    });

    await act(async () => {
      await user.click(await screen.findByRole('button', { name: 'React 👍' }));
    });

    expect(defaultProps.reactToMessage).toHaveBeenCalledWith('message-1', '👍');
  });

  test('previews and uploads an image attachment before sending', async () => {
    const user = userEvent.setup();
    const uploadAttachment = jest.fn().mockResolvedValue({
      id: 'attachment-1',
      kind: 'image',
      originalFilename: 'photo.png',
      url: '/api/attachments/attachment-1/content'
    });
    const imageFile = new File(['image-bytes'], 'photo.png', { type: 'image/png' });

    render(<DirectChatWindow {...defaultProps} uploadAttachment={uploadAttachment} />);

    await act(async () => {
      await user.upload(screen.getByLabelText('Attachment picker'), imageFile);
    });

    expect(screen.getByAltText('Attachment preview')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Send direct message' }));
    });

    expect(uploadAttachment).toHaveBeenCalledWith(imageFile, expect.any(Function));
    expect(defaultProps.sendMessage).toHaveBeenCalledWith('', null, expect.objectContaining({ id: 'attachment-1' }));
  });

  test('shows voice recorder fallback when MediaRecorder is unavailable', async () => {
    const user = userEvent.setup();
    const originalMediaRecorder = global.MediaRecorder;

    delete global.MediaRecorder;
    render(<DirectChatWindow {...defaultProps} />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Record voice note' }));
    });

    expect(screen.getByText('Voice recording is not available in this browser.')).toBeInTheDocument();
    global.MediaRecorder = originalMediaRecorder;
  });
});
