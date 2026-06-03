/**
 * Purpose: Shows active browser sessions and logout controls.
 */

import { useEffect, useState } from 'react';
import { MonitorSmartphone, X } from 'lucide-react';

import api, { getApiErrorMessage } from '../services/api';

const SessionManagementModal = ({ isOpen, onClose }) => {
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState([]);

  const loadSessions = async () => {
    const response = await api.get('/sessions');
    setCurrentSessionId(response.data.data.currentSessionId);
    setSessions(response.data.data.sessions);
  };

  useEffect(() => {
    if (isOpen) {
      loadSessions().catch((loadError) => setError(getApiErrorMessage(loadError, 'Unable to load sessions.')));
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const revokeSession = async (sessionId) => {
    await api.delete(`/sessions/${sessionId}`);
    await loadSessions();
  };

  const revokeAll = async () => {
    await api.delete('/sessions/all', { data: { keepCurrent: true } });
    await loadSessions();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <section className="w-full max-w-lg rounded-md border border-stroke bg-panel p-5 shadow-modal">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><MonitorSmartphone className="h-4 w-4" /> Active sessions</h2>
          <button aria-label="Close sessions" className="icon-button" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && <p className="mb-3 text-sm text-coral">{error}</p>}
        <div className="max-h-80 overflow-y-auto rounded-md border border-stroke">
          {sessions.map((session) => (
            <div className="border-b border-stroke px-3 py-3 last:border-b-0" key={session.sessionId}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{session.userAgent || 'Unknown browser'}</p>
                  <p className="text-xs text-muted">Last seen {new Date(session.lastSeenAt).toLocaleString()}</p>
                  {session.sessionId === currentSessionId && <p className="mt-1 text-xs text-accent">Current session</p>}
                </div>
                <button className="icon-button w-auto px-3" disabled={session.sessionId === currentSessionId} onClick={() => revokeSession(session.sessionId)} type="button">
                  Logout
                </button>
              </div>
            </div>
          ))}
        </div>
        <button className="primary-button mt-4 w-full" onClick={revokeAll} type="button">Logout all other sessions</button>
      </section>
    </div>
  );
};

export default SessionManagementModal;
