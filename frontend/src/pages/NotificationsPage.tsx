import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiRequestError } from '../api/client';
import { notificationsApi } from '../api/notifications';
import type { NotificationResponse } from '../types/api';
import { formatHstDateTime } from '../utils/hstDateTime';

interface NotificationDestination {
  to: string;
  label: string;
}

/**
 * Safely retrieves a reservation ID from a notification payload.
 */
function getReservationId(notification: NotificationResponse) {
  const value = notification.payload?.reservation_id;

  return typeof value === 'string' && value.trim()
    ? value
    : null;
}

/**
 * Determines where a notification action should send the member.
 *
 * Issue #51:
 * Returned-reservation notifications open the review form directly.
 * Other reservation notifications continue to open reservation details.
 */
function getNotificationDestination(
  notification: NotificationResponse,
): NotificationDestination | null {
  const reservationId = getReservationId(notification);

  if (!reservationId) {
    return null;
  }

  if (notification.type === 'RESERVATION_RETURNED') {
    return {
      to: `/reservations/${reservationId}/review`,
      label: 'Leave or manage review',
    };
  }

  return {
    to: `/reservations/${reservationId}`,
    label: 'View Reservation',
  };
}

function NotificationsPage() {
  const [notifications, setNotifications] =
    useState<NotificationResponse[]>([]);

  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const [filter, setFilter] =
    useState<'all' | 'unread' | 'read'>('all');

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await notificationsApi.list();

      setNotifications(data.items);
      setUnreadCount(data.unread_count);
      setTotal(data.total);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load notifications',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (
    notificationId: string,
  ) => {
    setStatusMessage('');

    try {
      await notificationsApi.markRead(notificationId);

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                read_at: new Date().toISOString(),
              }
            : notification,
        ),
      );

      setUnreadCount((currentCount) =>
        Math.max(0, currentCount - 1),
      );

      setStatusMessage('Notification marked as read.');
      window.dispatchEvent(new Event('auth-change'));
    } catch (err) {
      setStatusMessage(
        err instanceof ApiRequestError
          ? err.detail
          : 'Failed to mark as read',
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    setStatusMessage('');

    try {
      await notificationsApi.markAllRead();

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          read_at:
            notification.read_at ||
            new Date().toISOString(),
        })),
      );

      setUnreadCount(0);
      setStatusMessage('All notifications marked as read.');
      window.dispatchEvent(new Event('auth-change'));
    } catch (err) {
      setStatusMessage(
        err instanceof ApiRequestError
          ? err.detail
          : 'Failed to mark all as read',
      );
    }
  };

  const readCount = Math.max(0, total - unreadCount);

  const filteredNotifications = notifications.filter(
    (notification) => {
      if (filter === 'unread') {
        return !notification.read_at;
      }

      if (filter === 'read') {
        return Boolean(notification.read_at);
      }

      return true;
    },
  );

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Notification Center</p>
          <h1>Notifications</h1>

          <p className="page-description">
            Review reservation updates, owner actions, and
            system alerts. Returned reservations link directly
            to the review form.
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
          <span className="summary-number">
            {unreadCount}
          </span>
          <span className="summary-label">Unread</span>
        </article>

        <article className="summary-card">
          <span className="summary-number">
            {readCount}
          </span>
          <span className="summary-label">Read</span>
        </article>
      </div>

      <section className="notification-toolbar">
        <div
          className="notification-filter-group"
          aria-label="Notification filters"
        >
          <button
            type="button"
            className={
              filter === 'all'
                ? 'notification-filter-button active'
                : 'notification-filter-button'
            }
            onClick={() => setFilter('all')}
          >
            All ({total})
          </button>

          <button
            type="button"
            className={
              filter === 'unread'
                ? 'notification-filter-button active'
                : 'notification-filter-button'
            }
            onClick={() => setFilter('unread')}
          >
            Unread ({unreadCount})
          </button>

          <button
            type="button"
            className={
              filter === 'read'
                ? 'notification-filter-button active'
                : 'notification-filter-button'
            }
            onClick={() => setFilter('read')}
          >
            Read ({readCount})
          </button>
        </div>

        <div className="notification-action-group">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleMarkAllAsRead()}
            disabled={unreadCount === 0}
          >
            Mark All as Read
          </button>
        </div>
      </section>

      {statusMessage && (
        <p className="success-message">
          {statusMessage}
        </p>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {isLoading && <p>Loading notifications...</p>}

      <div className="notification-list">
        {filteredNotifications.map((notification) => {
          const destination =
            getNotificationDestination(notification);

          return (
            <article
              key={notification.id}
              className={
                notification.read_at
                  ? 'notification-card notification-card-read'
                  : 'notification-card notification-card-unread'
              }
            >
              <div className="notification-card-header">
                <div>
                  <span className="notification-type-badge">
                    {notification.type}
                  </span>

                  <h2>{notification.title}</h2>
                </div>

                <span
                  className={
                    notification.read_at
                      ? 'notification-read-status read'
                      : 'notification-read-status unread'
                  }
                >
                  {notification.read_at
                    ? 'Read'
                    : 'Unread'}
                </span>
              </div>

              <p className="notification-message">
                {notification.body}
              </p>

              <div className="notification-footer">
                <span className="auth-helper-text">
                  Created:{' '}
                  {formatHstDateTime(
                    notification.created_at,
                  )}
                </span>

                <div className="notification-card-actions">
                  {destination && (
                    <Link
                      className="secondary-link"
                      to={destination.to}
                    >
                      {destination.label}
                    </Link>
                  )}

                  {!notification.read_at && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        void handleMarkAsRead(
                          notification.id,
                        )
                      }
                    >
                      Mark as Read
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!isLoading &&
        filteredNotifications.length === 0 && (
          <section className="empty-state-card">
            <h2>No notifications found</h2>
            <p>Try switching to a different filter.</p>
          </section>
        )}
    </section>
  );
}

export default NotificationsPage;