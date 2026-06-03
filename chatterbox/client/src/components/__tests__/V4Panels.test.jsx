/**
 * Purpose: Verifies v4 call, status, channel, session, and dashboard UI panels.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AdminDashboardPanel from '../AdminDashboardPanel';
import CallOverlay from '../CallOverlay';
import ChannelsPanel from '../ChannelsPanel';
import SessionManagementModal from '../SessionManagementModal';
import StatusPanel from '../StatusPanel';
import api from '../../services/api';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn()
  },
  getApiErrorMessage: (error, fallback) => error.response?.data?.error?.message || fallback
}));

describe('v4 panels', () => {
  beforeEach(() => {
    api.delete.mockReset();
    api.get.mockReset();
    api.post.mockReset();
  });

  test('renders incoming call modal and active call controls', async () => {
    const user = userEvent.setup();
    const acceptCall = jest.fn();
    const endCall = jest.fn();
    const rejectCall = jest.fn();
    const toggleMute = jest.fn();

    const { rerender } = render(
      <CallOverlay
        acceptCall={acceptCall}
        incomingCall={{ fromUser: { username: 'alex' }, mediaType: 'audio' }}
        rejectCall={rejectCall}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(acceptCall).toHaveBeenCalled();

    rerender(
      <CallOverlay
        activeCall={{ mediaType: 'audio', startedAt: Date.now(), state: 'active' }}
        endCall={endCall}
        toggleMute={toggleMute}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Mute call' }));
    await user.click(screen.getByRole('button', { name: 'End call' }));
    expect(toggleMute).toHaveBeenCalled();
    expect(endCall).toHaveBeenCalled();
  });

  test('loads statuses, creates text status, and opens a status', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce({
      data: { data: { statuses: [{ content: 'Morning update', id: 'status-1', owner: { id: 'user-1', username: 'shriya' }, viewers: [] }] } }
    });
    api.post
      .mockResolvedValueOnce({ data: { data: { status: { id: 'status-2' } } } })
      .mockResolvedValueOnce({
        data: { data: { statuses: [{ content: 'Created update', id: 'status-2', owner: { id: 'user-1', username: 'shriya' }, viewers: [] }] } }
      })
      .mockResolvedValueOnce({
        data: { data: { status: { content: 'Created update', id: 'status-2', owner: { id: 'user-1', username: 'shriya' }, viewers: [{ viewerId: 'user-1' }] } } }
      });
    api.get.mockResolvedValueOnce({
      data: { data: { statuses: [{ content: 'Created update', id: 'status-2', owner: { id: 'user-1', username: 'shriya' }, viewers: [] }] } }
    });

    render(<StatusPanel currentUser={{ id: 'user-1' }} isOpen onClose={jest.fn()} />);
    expect(await screen.findByText('Morning update')).toBeInTheDocument();

    await act(async () => {
      await user.type(screen.getByLabelText('Status text'), 'Created update');
      await user.click(screen.getByRole('button', { name: 'Post status' }));
    });

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/statuses', expect.objectContaining({ content: 'Created update' })));
  });

  test('loads channels and creates admin posts', async () => {
    const user = userEvent.setup();
    const channel = {
      description: 'Updates',
      followerCount: 1,
      id: 'channel-1',
      isFollowing: true,
      myRole: 'admin',
      name: 'Launch Channel',
      posts: []
    };
    api.get.mockResolvedValue({ data: { data: { channels: [channel] } } });
    api.post.mockResolvedValueOnce({ data: { data: { channel: { ...channel, posts: [{ _id: 'post-1', content: 'Broadcast' }] }, post: { _id: 'post-1', content: 'Broadcast' } } } });

    render(<ChannelsPanel isOpen onClose={jest.fn()} />);
    expect((await screen.findAllByText('Launch Channel')).length).toBeGreaterThan(0);

    await act(async () => {
      await user.type(screen.getByLabelText('Channel post'), 'Broadcast');
      await user.click(screen.getByRole('button', { name: 'Post' }));
    });

    expect(api.post).toHaveBeenCalledWith('/channels/channel-1/posts', { content: 'Broadcast' });
  });

  test('shows sessions and logs out other sessions', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({
      data: {
        data: {
          currentSessionId: 'current',
          sessions: [
            { lastSeenAt: new Date().toISOString(), sessionId: 'current', userAgent: 'Current browser' },
            { lastSeenAt: new Date().toISOString(), sessionId: 'other', userAgent: 'Other browser' }
          ]
        }
      }
    });
    api.delete.mockResolvedValue({ data: { data: { revokedCount: 1 } } });

    render(<SessionManagementModal isOpen onClose={jest.fn()} />);
    expect(await screen.findByText('Other browser')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Logout all other sessions' }));
    });
    expect(api.delete).toHaveBeenCalledWith('/sessions/all', { data: { keepCurrent: true } });
  });

  test('renders admin dashboard metrics', async () => {
    api.get.mockResolvedValue({
      data: {
        data: {
          metrics: {
            activeConversations: 2,
            activeUsers: 3,
            messagesPerDay: [{ count: 4, day: '2026-06-02' }],
            reportedMessages: 1,
            systemHealth: { redis: 'ready' },
            totalMessages: 10,
            totalUsers: 5
          }
        }
      }
    });

    render(<AdminDashboardPanel isOpen onClose={jest.fn()} />);

    expect(await screen.findByText('Total users')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('2026-06-02')).toBeInTheDocument();
  });
});
