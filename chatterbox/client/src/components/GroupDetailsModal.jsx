/**
 * Purpose: Shows and edits WhatsApp-style group details and admin settings.
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const GroupDetailsModal = ({ currentUser, isOpen, onClose, onSave, room }) => {
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [settings, setSettings] = useState({});

  useEffect(() => {
    setDescription(room?.description || '');
    setName(room?.name || '');
    setSettings(room?.settings || {});
  }, [room, isOpen]);

  if (!isOpen || !room) {
    return null;
  }

  const members = room.members || [];
  const myMember = members.find((member) => member.id === currentUser.id);
  const canEdit = myMember?.role === 'owner' || myMember?.role === 'admin';
  const updateSetting = (field, value) => setSettings((current) => ({ ...current, [field]: value }));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <form
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-md border border-stroke bg-panel p-5 shadow-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ description, name, settings });
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Group details</h2>
          <button aria-label="Close group details" className="icon-button" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-muted">Group name</span>
          <input className="field" disabled={!canEdit} maxLength={80} onChange={(event) => setName(event.target.value)} value={name} />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-muted">Description</span>
          <textarea className="field min-h-20 py-2" disabled={!canEdit} maxLength={240} onChange={(event) => setDescription(event.target.value)} value={description} />
        </label>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">Who can send messages</span>
            <select className="field" disabled={!canEdit} onChange={(event) => updateSetting('whoCanSendMessages', event.target.value)} value={settings.whoCanSendMessages || 'everyone'}>
              <option value="everyone">Everyone</option>
              <option value="admins">Admins only</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">Who can edit group info</span>
            <select className="field" disabled={!canEdit} onChange={(event) => updateSetting('whoCanEditInfo', event.target.value)} value={settings.whoCanEditInfo || 'admins'}>
              <option value="everyone">Everyone</option>
              <option value="admins">Admins only</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">Disappearing messages</span>
            <select className="field" disabled={!canEdit} onChange={(event) => updateSetting('disappearingMode', event.target.value)} value={settings.disappearingMode || 'off'}>
              <option value="off">Off</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
              <option value="90d">90 days</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm text-ink">
            <input
              checked={settings.joinApprovalRequired || false}
              disabled={!canEdit}
              onChange={(event) => updateSetting('joinApprovalRequired', event.target.checked)}
              type="checkbox"
            />
            Join approval
          </label>
          <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
            <input
              checked={settings.newMembersCanSeeRecentHistory !== false}
              disabled={!canEdit}
              onChange={(event) => updateSetting('newMembersCanSeeRecentHistory', event.target.checked)}
              type="checkbox"
            />
            New members can see last 50 messages
          </label>
        </div>

        <section className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted">Members</h3>
          <ul className="max-h-36 overflow-y-auto rounded-md border border-stroke">
            {members.map((member) => (
              <li className="flex items-center justify-between border-b border-stroke px-3 py-2 text-sm last:border-b-0" key={member.id}>
                <span className="truncate">{member.displayName || member.username || member.id}</span>
                <span className="rounded bg-canvas px-2 py-0.5 text-xs text-muted">{member.role || 'member'}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex justify-end gap-2">
          <button className="icon-button w-auto px-4" onClick={onClose} type="button">Cancel</button>
          <button className="primary-button" disabled={!canEdit} type="submit">Save group</button>
        </div>
      </form>
    </div>
  );
};

export default GroupDetailsModal;
