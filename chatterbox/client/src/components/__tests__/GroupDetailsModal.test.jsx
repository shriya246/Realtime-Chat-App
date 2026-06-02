/**
 * Purpose: Verifies v3 group details and admin settings UI.
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import GroupDetailsModal from '../GroupDetailsModal';

describe('GroupDetailsModal', () => {
  test('renders members and saves admin-managed group settings', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();

    render(
      <GroupDetailsModal
        currentUser={{ id: 'user-1', username: 'owner' }}
        isOpen
        onClose={jest.fn()}
        onSave={onSave}
        room={{
          description: 'Launch planning',
          members: [
            { id: 'user-1', role: 'owner', username: 'owner' },
            { id: 'user-2', role: 'member', username: 'alex' }
          ],
          name: 'Launch crew',
          settings: {
            disappearingMode: 'off',
            joinApprovalRequired: false,
            newMembersCanSeeRecentHistory: true,
            whoCanEditInfo: 'admins',
            whoCanSendMessages: 'everyone'
          }
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Group details' })).toBeInTheDocument();
    expect(screen.getByText('alex')).toBeInTheDocument();

    await act(async () => {
      await user.clear(screen.getByDisplayValue('Launch crew'));
      await user.type(screen.getByLabelText(/Group name/i), 'Core team');
      await user.selectOptions(screen.getByLabelText(/Who can send messages/i), 'admins');
      await user.click(screen.getByLabelText('Join approval'));
      await user.click(screen.getByRole('button', { name: 'Save group' }));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Core team',
        settings: expect.objectContaining({
          joinApprovalRequired: true,
          whoCanSendMessages: 'admins'
        })
      })
    );
  });
});
