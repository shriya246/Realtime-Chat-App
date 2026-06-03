/**
 * Purpose: Displays local admin observability metrics.
 */

import { useEffect, useState } from 'react';
import { Activity, X } from 'lucide-react';

import api, { getApiErrorMessage } from '../services/api';

const AdminDashboardPanel = ({ isOpen, onClose }) => {
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    api.get('/admin/dashboard')
      .then((response) => setMetrics(response.data.data.metrics))
      .catch((loadError) => setError(getApiErrorMessage(loadError, 'Unable to load dashboard.')));
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const cards = metrics ? [
    ['Total users', metrics.totalUsers],
    ['Active users', metrics.activeUsers],
    ['Total messages', metrics.totalMessages],
    ['Active conversations', metrics.activeConversations],
    ['Open reports', metrics.reportedMessages],
    ['Redis', metrics.systemHealth.redis]
  ] : [];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border border-stroke bg-panel p-5 shadow-modal">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><Activity className="h-4 w-4" /> Admin dashboard</h2>
          <button aria-label="Close dashboard" className="icon-button" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && <p className="mb-3 rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
        {metrics && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {cards.map(([label, value]) => (
                <div className="rounded-md border border-stroke bg-canvas p-3" key={label}>
                  <p className="text-xs uppercase text-muted">{label}</p>
                  <p className="mt-2 text-xl font-semibold text-ink">{value}</p>
                </div>
              ))}
            </div>
            <section className="mt-5 rounded-md border border-stroke bg-canvas p-3">
              <h3 className="mb-2 text-sm font-semibold text-ink">Messages per day</h3>
              <div className="space-y-2">
                {metrics.messagesPerDay.map((row) => (
                  <div className="grid grid-cols-[90px_1fr_40px] items-center gap-2 text-xs" key={row.day}>
                    <span className="text-muted">{row.day}</span>
                    <span className="h-2 rounded bg-raised">
                      <span className="block h-2 rounded bg-accent" style={{ width: `${Math.min(row.count * 10, 100)}%` }} />
                    </span>
                    <span className="text-right text-ink">{row.count}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </div>
  );
};

export default AdminDashboardPanel;
