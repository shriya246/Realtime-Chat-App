/**
 * Purpose: Edits the current user's profile and avatar.
 */

import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Renders profile edit controls.
 *
 * @param {object} props - Modal data and actions.
 * @returns {JSX.Element|null} Profile modal.
 */
const ProfileModal = ({ currentUser, error = '', isOpen, isSaving, onClose, onSave }) => {
  const [about, setAbout] = useState(currentUser.about || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [displayName, setDisplayName] = useState(currentUser.displayName || '');

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({ about, avatarFile, displayName });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <form className="w-full max-w-md rounded-md border border-stroke bg-panel p-5 shadow-modal" onSubmit={handleSubmit}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Profile</h2>
          <button aria-label="Close profile" className="icon-button" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3">
          {currentUser.avatarUrl ? (
            <img alt="Profile avatar" className="h-14 w-14 rounded-full object-cover" src={currentUser.avatarUrl} />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-bold text-canvas">
              {(displayName || currentUser.username)?.slice(0, 1).toUpperCase()}
            </span>
          )}
          <label className="primary-button h-10 cursor-pointer">
            Avatar
            <input
              aria-label="Avatar upload"
              accept="image/*"
              className="hidden"
              onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
              type="file"
            />
          </label>
          {avatarFile && <span className="min-w-0 truncate text-xs text-muted">{avatarFile.name}</span>}
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-muted">Display name</span>
          <input className="field" maxLength={60} onChange={(event) => setDisplayName(event.target.value)} value={displayName} />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-muted">About</span>
          <textarea className="field min-h-24 py-2" maxLength={160} onChange={(event) => setAbout(event.target.value)} value={about} />
        </label>

        {error && <p className="mb-3 text-sm text-coral">{error}</p>}

        <div className="flex justify-end gap-2">
          <button className="icon-button w-auto px-4" onClick={onClose} type="button">Cancel</button>
          <button className="primary-button" disabled={isSaving} type="submit">
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileModal;
