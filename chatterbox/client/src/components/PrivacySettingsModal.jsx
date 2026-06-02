/**
 * Purpose: Edits app-level privacy settings for the current user.
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const visibilityOptions = ['everyone', 'contacts', 'nobody'];

const PrivacySettingsModal = ({ currentUser, isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState(currentUser.privacySettings || {});

  useEffect(() => {
    setSettings(currentUser.privacySettings || {});
  }, [currentUser.privacySettings, isOpen]);

  if (!isOpen) {
    return null;
  }

  const update = (field, value) => setSettings((current) => ({ ...current, [field]: value }));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <form
        className="w-full max-w-md rounded-md border border-stroke bg-panel p-5 shadow-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(settings);
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Privacy settings</h2>
          <button aria-label="Close privacy settings" className="icon-button" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        {[
          ['lastSeenVisibility', 'Last seen'],
          ['onlineVisibility', 'Online'],
          ['profilePhotoVisibility', 'Profile photo'],
          ['aboutVisibility', 'About']
        ].map(([field, label]) => (
          <label className="mb-3 block" key={field}>
            <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
            <select className="field" onChange={(event) => update(field, event.target.value)} value={settings[field] || 'everyone'}>
              {visibilityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ))}

        <label className="mb-4 flex items-center gap-2 text-sm text-ink">
          <input
            checked={settings.readReceipts !== false}
            onChange={(event) => update('readReceipts', event.target.checked)}
            type="checkbox"
          />
          Read receipts
        </label>

        <div className="flex justify-end gap-2">
          <button className="icon-button w-auto px-4" onClick={onClose} type="button">Cancel</button>
          <button className="primary-button" type="submit">Save privacy</button>
        </div>
      </form>
    </div>
  );
};

export default PrivacySettingsModal;
