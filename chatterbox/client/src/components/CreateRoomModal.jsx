/**
 * Purpose: Collects room name and visibility for creation through the protected room API.
 */

import { useEffect, useState } from 'react';
import { Globe2, LockKeyhole, X } from 'lucide-react';
import clsx from 'clsx';

/**
 * Presents a room-creation dialog.
 *
 * @param {{ isOpen: boolean, isSubmitting: boolean, error: string, onClose: Function, onCreate: Function }} props - Modal actions and state.
 * @returns {JSX.Element|null} Room dialog or null.
 */
const CreateRoomModal = ({ error, isOpen, isSubmitting, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('public');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setType('public');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  /**
   * Submits valid room form values.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} event - Form submit event.
   * @returns {Promise<void>} Resolves after creation request.
   */
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (name.trim()) {
      await onCreate({ name: name.trim(), type });
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4" role="presentation">
      <form
        aria-modal="true"
        aria-label="Create room"
        className="w-full max-w-sm rounded-md border border-stroke bg-panel p-5 shadow-modal"
        onSubmit={handleSubmit}
        role="dialog"
      >
        <header className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Create room</h2>
          <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </header>

        <label className="block text-sm font-medium text-muted" htmlFor="room-name">
          Name
        </label>
        <input
          autoFocus
          className="field mt-2"
          id="room-name"
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          placeholder="Design team"
          required
          value={name}
        />

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium text-muted">Visibility</legend>
          <div className="grid grid-cols-2 rounded-md border border-stroke bg-canvas p-1">
            {[
              { icon: Globe2, label: 'Public', value: 'public' },
              { icon: LockKeyhole, label: 'Private', value: 'private' }
            ].map(({ icon: Icon, label, value }) => (
              <button
                aria-pressed={type === value}
                className={clsx(
                  'flex h-10 items-center justify-center gap-2 rounded-md text-sm transition',
                  type === value ? 'bg-raised text-ink' : 'text-muted hover:text-ink'
                )}
                key={value}
                onClick={() => setType(value)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="mt-4 text-sm text-coral">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button className="h-11 rounded-md px-4 text-sm text-muted transition hover:bg-raised hover:text-ink" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={isSubmitting || !name.trim()} type="submit">
            {isSubmitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateRoomModal;
