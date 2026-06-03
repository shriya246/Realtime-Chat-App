/**
 * Purpose: Shows the status/story tray and creation form.
 */

import { useEffect, useState } from 'react';
import { Image, X } from 'lucide-react';

import api, { getApiErrorMessage } from '../services/api';

const StatusPanel = ({ currentUser, isOpen, onClose }) => {
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [statuses, setStatuses] = useState([]);

  const loadStatuses = async () => {
    const response = await api.get('/statuses');
    setStatuses(response.data.data.statuses);
  };

  useEffect(() => {
    if (isOpen) {
      loadStatuses().catch((loadError) => setError(getApiErrorMessage(loadError, 'Unable to load statuses.')));
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const createStatus = async (event) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      setError('');
      let attachmentId = null;

      if (attachmentFile) {
        const uploadResponse = await api.post('/attachments?purpose=status', attachmentFile, {
          headers: {
            'Content-Type': attachmentFile.type || 'application/octet-stream',
            'X-File-Name': encodeURIComponent(attachmentFile.name)
          }
        });
        attachmentId = uploadResponse.data.data.attachment.id;
      }

      await api.post('/statuses', {
        attachmentId,
        content,
        type: attachmentFile?.type?.startsWith('video/') ? 'video' : attachmentId ? 'image' : 'text'
      });
      setContent('');
      setAttachmentFile(null);
      await loadStatuses();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, 'Unable to create status.'));
    } finally {
      setIsSaving(false);
    }
  };

  const openStatus = async (status) => {
    setSelectedStatus(status);
    try {
      const response = await api.post(`/statuses/${status.id}/view`);
      setSelectedStatus(response.data.data.status);
    } catch (viewError) {
      setError(getApiErrorMessage(viewError, 'Unable to open status.'));
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md border border-stroke bg-panel p-5 shadow-modal">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Status</h2>
          <button aria-label="Close status" className="icon-button" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="mb-3 rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}

        <form className="mb-5 rounded-md border border-stroke bg-canvas p-3" onSubmit={createStatus}>
          <textarea
            aria-label="Status text"
            className="field min-h-20 py-2"
            onChange={(event) => setContent(event.target.value)}
            placeholder="Share a 24-hour update"
            value={content}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
              <Image className="h-4 w-4" />
              <span>{attachmentFile ? attachmentFile.name : 'Add image/video'}</span>
              <input
                accept="image/*,video/*"
                className="hidden"
                onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
                type="file"
              />
            </label>
            <button className="primary-button" disabled={isSaving || (!content.trim() && !attachmentFile)} type="submit">
              Post status
            </button>
          </div>
        </form>

        <div className="grid gap-3 sm:grid-cols-2">
          {statuses.map((status) => (
            <button className="rounded-md border border-stroke bg-canvas p-3 text-left hover:bg-raised" key={status.id} onClick={() => openStatus(status)} type="button">
              <p className="text-sm font-semibold text-ink">{status.owner?.displayName || status.owner?.username || 'Status'}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{status.content || status.type}</p>
              {status.owner?.id === currentUser.id && <p className="mt-2 text-xs text-accent">{status.viewers?.length || 0} views</p>}
            </button>
          ))}
        </div>

        {selectedStatus && (
          <div className="mt-5 rounded-md border border-stroke bg-canvas p-4">
            <p className="text-sm font-semibold text-ink">{selectedStatus.owner?.displayName || selectedStatus.owner?.username}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{selectedStatus.content}</p>
            {selectedStatus.attachments?.[0]?.url && selectedStatus.type === 'image' && (
              <img alt="Status media" className="mt-3 max-h-80 rounded-md object-contain" src={selectedStatus.attachments[0].url} />
            )}
            {selectedStatus.attachments?.[0]?.url && selectedStatus.type === 'video' && (
              <video aria-label="Status video" className="mt-3 max-h-80 rounded-md" controls src={selectedStatus.attachments[0].url} />
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default StatusPanel;
