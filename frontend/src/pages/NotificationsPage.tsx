import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ApiError,
  notificationsApi,
  type Notification,
} from '../api/client';

/**
 * NotificationsPage
 *
 * Real backend list via ``GET /notifications`` and mark-read via
 * ``POST /notifications/{id}/read``. Clicking a notification body
 * tries to deep-link to the relevant reservation (if the payload
 * contains ``reservation_id``) — otherwise it just marks it read.
 */
function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await notificationsApi.list({ unread_only: unreadOnly });
      setItems(res.items);
      setUnreadCount(res.unread_count);
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to load notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      // Optimistic update: clear read_at locally and drop from unread view.
      setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (unreadOnly) {
        setItems((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to mark notification read.');
    }
  };

  const reservationIdFromPayload = (n: Notification): string | null => {
    if (!n.payload || typeof n.payload !== 'object') return null;
    const candidate = (n.payload as Record<string, unknown>).reservation_id;
    return typeof candidate === 'string' ? candidate : null;
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Notifications</p>
          <h1>Notifications</h1>
          <p className="page-description">
            Reservation updates, approval notices, and other system events.
            {unreadCount > 0 && ` ${unreadCount} unread.`}
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
          />
          Show unread only
        </label>
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : errorMessage ? (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      ) : items.length === 0 ? (
        <div className="empty-state-card">
          <p className="eyebrow">No Notifications</p>
          <h2>You're all caught up.</h2>
          <p>New activity will appear here.</p>
        </div>
      ) : (
        <div className="notification-list">
          {items.map((n) => {
            const reservationId = reservationIdFromPayload(n);
            const isUnread = n.read_at === null;
            return (
              <article
                className={`notification-card${isUnread ? ' unread' : ''}`}
                key={n.id}
              >
                <div className="notification-card-body">
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                  <p className="notification-meta">
                    {new Date(n.created_at).toLocaleString()} — {n.type}
                  </p>
                </div>
                <div className="notification-actions">
                  {reservationId && (
                    <Link
                      className="secondary-link"
                      to={`/reservations/${reservationId}`}
                    >
                      View
                    </Link>
                  )}
                  {isUnread && (
                    <button
                      type="button"
                      className="action-button approve-button"
                      onClick={() => handleMarkRead(n.id)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default NotificationsPage;
