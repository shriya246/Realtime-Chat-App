/**
 * Purpose: Verifies v2.5 profile editing and avatar rendering behavior.
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ProfileModal from '../ProfileModal';

describe('ProfileModal', () => {
  test('renders the current avatar and saves profile changes with a new avatar file', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    const avatarFile = new File(['avatar-bytes'], 'avatar.png', { type: 'image/png' });

    render(
      <ProfileModal
        currentUser={{
          about: 'Original about',
          avatarUrl: '/api/attachments/avatar/content',
          displayName: 'Shriya',
          username: 'shriya'
        }}
        isOpen
        isSaving={false}
        onClose={jest.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getByAltText('Profile avatar')).toHaveAttribute('src', '/api/attachments/avatar/content');

    await act(async () => {
      await user.clear(screen.getByLabelText('Display name'));
      await user.type(screen.getByLabelText('Display name'), 'Shriya Patel');
      await user.clear(screen.getByLabelText('About'));
      await user.type(screen.getByLabelText('About'), 'Building local-first chat.');
      await user.upload(screen.getByLabelText('Avatar upload'), avatarFile);
      await user.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(screen.getByText('avatar.png')).toBeInTheDocument();
    expect(onSave).toHaveBeenCalledWith({
      about: 'Building local-first chat.',
      avatarFile,
      displayName: 'Shriya Patel'
    });
  });
});
