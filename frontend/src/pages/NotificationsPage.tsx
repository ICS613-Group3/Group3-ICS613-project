import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '../api/notifications';
import { ApiRequestError } from '../api/client';
import type { NotificationResponse } from '../types/api';

function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const fetchNotifications = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await notificationsApi.list();
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    setStatusMessage('');
    try {
      await notificationsApi.markRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      setStatusMessage('Notification marked as read.');
      window.dispatchEvent(new Event('auth-change'));
    } catch (err) {
      setStatusMessage(err instanceof ApiRequestError ? err.detail : 'Failed to mark as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    setStatusMessage('');
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnreadCount(0);
      setStatusMessage('All notifications marked as read.');
      window.dispatchEvent(new Event('auth-change'));
    } catch (err) {
      setStatusMessage(err instanceof ApiRequestError ? err.detail : 'Failed to mark all as read');
    }
  };

  const readCount = total - unreadCount;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read_at;
    if (filter === 'read') return !!n.read_at;
    return true;
  });

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Notification Center</p>
          <h1>Notifications</h1>
          <p className="page-description">
            Review reservation updates, owner actions, and system alerts.
          </p>
        </div>
        <Link className="secondary-link" to="/dashboard">
          Back to Dashboard
        </Link>
      </div>

      <div className="notification-summary-grid">
        <article className="summary-card">
          <span className="summary-number">{total}</span>
          <span className="summary-label">Total</span>
        </article>
        <article className="summary-card notification-unread-summary">
          <span className="summary-number">{unreadCount}</span>
          <span className="summary-label">Unread</span>
        </article>
        <article className="summary-card">
          <span className="summary-number">{readCount}</span>
          <span className="summary-label">Read</span>
        </article>
      </div>

      <section className="notification-toolbar">
        <div className="notification-filter-group" aria-label="Notification filters">
          <button type="button" className={filter === 'all' ? 'notification-filter-button active' : 'notification-filter-button'} onClick={() => setFilter('all')}>All ({total})</button>
          <button type="button" className={filter === 'unread' ? 'notification-filter-button active' : 'notification-filter-button'} onClick={() => setFilter('unread')}>Unread ({unreadCount})</button>
          <button type="button" className={filter === 'read' ? 'notification-filter-button active' : 'notification-filter-button'} onClick={() => setFilter('read')}>Read ({readCount})</button>
        </div>
        <div className="notification-action-group">
          <button type="button" className="secondary-button" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
            Mark All as Read
          </button>
        </div>
      </section>

      {statusMessage && <p className="success-message">{statusMessage}</p>}
      {error && <p className="form-error">{error}</p>}
      {isLoading && <p>Loading notifications...</p>}

      <div className="notification-list">
        {filteredNotifications.map((n) => (
          <article key={n.id} className={n.read_at ? 'notification-card notification-card-read' : 'notification-card notification-card-unread'}>
            <div className="notification-card-header">
              <div>
                <span className="notification-type-badge">{n.type}</span>
                <h2>{n.title}</h2>
              </div>
              <span className={n.read_at ? 'notification-read-status read' : 'notification-read-status unread'}>
                {n.read_at ? 'Read' : 'Unread'}
              </span>
            </div>
            <p className="notification-message">{n.body}</p>
            <div className="notification-footer">
              <span className="auth-helper-text">Created: {new Date(n.created_at).toLocaleString()}</span>
              <div className="notification-card-actions">
                {n.payload && typeof n.payload === 'object' && 'reservation_id' in n.payload && (
                  <Link className="secondary-link" to={`/reservations/${String((n.payload as Record<string,unknown>).reservation_id)}`}>
                    View Reservation
                  </Link>
                )}
                {!n.read_at && (
                  <button type="button" className="secondary-button" onClick={() => handleMarkAsRead(n.id)}>
                    Mark as Read
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {!isLoading && filteredNotifications.length === 0 && (
        <section className="empty-state-card">
          <h2>No notifications found</h2>
          <p>Try switching to a different filter.</p>
        </section>
      )}
    </section>
  );
}

export default NotificationsPage;
