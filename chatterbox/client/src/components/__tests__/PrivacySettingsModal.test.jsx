/**
 * Purpose: Verifies app-level v3 privacy settings UI.
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PrivacySettingsModal from '../PrivacySettingsModal';

describe('PrivacySettingsModal', () => {
  test('updates visibility controls and read receipts', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();

    render(
      <PrivacySettingsModal
        currentUser={{
          id: 'user-1',
          privacySettings: {
            aboutVisibility: 'everyone',
            lastSeenVisibility: 'everyone',
            onlineVisibility: 'everyone',
            profilePhotoVisibility: 'everyone',
            readReceipts: true
          }
        }}
        isOpen
        onClose={jest.fn()}
        onSave={onSave}
      />
    );

    await act(async () => {
      await user.selectOptions(screen.getByLabelText('Last seen'), 'nobody');
      await user.selectOptions(screen.getByLabelText('Profile photo'), 'contacts');
      await user.click(screen.getByLabelText('Read receipts'));
      await user.click(screen.getByRole('button', { name: 'Save privacy' }));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSeenVisibility: 'nobody',
        profilePhotoVisibility: 'contacts',
        readReceipts: false
      })
    );
  });
});
