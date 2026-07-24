import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';

import { notificationsApi } from '../api/notifications';
import type { NotificationResponse } from '../types/api';
import { formatHstDateTime } from '../utils/hstDateTime';

type NotificationFilter = 'all' | 'unread' | 'read';

/**
 * Return a readable API error message.
 */
function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

/**
 * Safely read a string from a notification payload.
 */
function getPayloadString(
  payload: Record<string, unknown> | null,
  key: string,
) {
  const value = payload?.[key];

  return typeof value === 'string' && value.trim()
    ? value
    : null;
}

/**
 * Build the display category and destination for a notification.
 *
 * Issue #51:
 * A RESERVATION_RETURNED notification with a reservation_id links directly
 * to the review form for that returned reservation.
 */
function getNotificationPresentation(
  notification: NotificationResponse,
) {
  const reservationId = getPayloadString(
    notification.payload,
    'reservation_id',
  );

  if (
    notification.type === 'RESERVATION_RETURNED' &&
    reservationId
  ) {
    return {
      category: 'Review Available',
      linkTo: `/reservations/${reservationId}/review`,
      linkLabel: 'Leave or manage review',
    };
  }

  if (notification.type === 'RESERVATION_OVERDUE') {
    return {
      category: 'Return Reminder',
      linkTo: reservationId
        ? `/reservations/${reservationId}`
        : '/reservations',
      linkLabel: reservationId
        ? 'Open reservation'
        : 'View reservations',
    };
  }

  if (
    notification.type === 'RESERVATION_REQUESTED' ||
    notification.type === 'RESERVATION_APPROVED' ||
    notification.type === 'RESERVATION_DENIED' ||
    notification.type === 'RESERVATION_CANCELLED' ||
    notification.type === 'RESERVATION_PICKED_UP'
  ) {
    return {
      category: 'Reservation Update',
      linkTo: reservationId
        ? `/reservations/${reservationId}`
        : '/reservations',
      linkLabel: reservationId
        ? 'Open reservation'
        : 'View reservations',
    };
  }

  if (
    notification.type === 'TOOL_DEACTIVATED' ||
    notification.type === 'TOOL_REACTIVATED'
  ) {
    const toolId = getPayloadString(
      notification.payload,
      'tool_id',
    );

    return {
      category: 'Tool Update',
      linkTo: toolId ? `/tools/${toolId}` : '/tools',
      linkLabel: toolId ? 'Open tool' : 'View tools',
    };
  }

  return {
    category: 'Account or System',
    linkTo: '/notifications',
    linkLabel: 'View notification',
  };
}

/**
 * Create a CSS-safe notification category class.
 */
function getNotificationTypeClass(category: string) {
  return `notification-type-badge notification-type-${category
    .toLowerCase()
    .replaceAll(' ', '-')}`;
}

/**
 * Issue #51 notification integration:
 *
 * - Loads notifications from the real backend.
 * - Routes RESERVATION_RETURNED notifications to the review form.
 * - Persists read state through the real mark-read endpoint.
 *
 * The backend remains responsible for creating and scheduling notifications.
 */
function NotificationsPage() {
  const [notifications, setNotifications] =
    useState<NotificationResponse[]>([]);

  const [filter, setFilter] =
    useState<NotificationFilter>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const [
    markingNotificationId,
    setMarkingNotificationId,
  ] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  /**
   * Load both read and unread notifications.
   */
  const loadNotifications = useCallback(
    async (showRefreshingState = false) => {
      if (showRefreshingState) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage('');

      try {
        const response = await notificationsApi.list({
          include_read: true,
          page: 1,
          page_size: 100,
        });

        setNotifications(response.items);
      } catch (error) {
        setErrorMessage(
          getErrorMessage(
            error,
            'Unable to load notifications.',
          ),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const notificationCounts = useMemo(() => {
    const unread = notifications.filter(
      (notification) => notification.read_at === null,
    ).length;

    return {
      total: notifications.length,
      unread,
      read: notifications.length - unread,
    };
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter(
        (notification) => notification.read_at === null,
      );
    }

    if (filter === 'read') {
      return notifications.filter(
        (notification) => notification.read_at !== null,
      );
    }

    return notifications;
  }, [filter, notifications]);

  /**
   * Mark one notification as read through the backend API.
   */
  async function handleMarkAsRead(notificationId: string) {
    setMarkingNotificationId(notificationId);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const updatedNotification =
        await notificationsApi.markRead(notificationId);

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === updatedNotification.id
            ? updatedNotification
            : notification,
        ),
      );

      setStatusMessage('Notification marked as read.');
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          'Unable to mark the notification as read.',
        ),
      );
    } finally {
      setMarkingNotificationId(null);
    }
  }

  /**
   * The backend does not expose a read-all endpoint.
   *
   * Mark every currently unread notification through the supported
   * individual mark-read endpoint.
   */
  async function handleMarkAllAsRead() {
    const unreadNotifications = notifications.filter(
      (notification) => notification.read_at === null,
    );

    if (unreadNotifications.length === 0) {
      return;
    }

    setIsMarkingAll(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const updatedNotifications = await Promise.all(
        unreadNotifications.map((notification) =>
          notificationsApi.markRead(notification.id),
        ),
      );

      const updatedById = new Map(
        updatedNotifications.map((notification) => [
          notification.id,
          notification,
        ]),
      );

      setNotifications((currentNotifications) =>
        currentNotifications.map(
          (notification) =>
            updatedById.get(notification.id) ?? notification,
        ),
      );

      setStatusMessage('All notifications marked as read.');
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          'Unable to mark all notifications as read.',
        ),
      );
    } finally {
      setIsMarkingAll(false);
    }
  }

  if (isLoading) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Notification Center</p>
          <h1>Loading Notifications</h1>
          <p>Loading your latest notification activity...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Notification Center</p>
          <h1>Notifications</h1>

          <p className="page-description">
            Review reservation updates and open returned reservations
            directly when a rating and review are available.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => void loadNotifications(true)}
            disabled={isRefreshing || isMarkingAll}
          >
            {isRefreshing
              ? 'Refreshing...'
              : 'Refresh Notifications'}
          </button>

          <Link className="secondary-link" to="/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="notification-summary-grid">
        <article className="summary-card">
          <span className="summary-number">
            {notificationCounts.total}
          </span>
          <span className="summary-label">
            Total Notifications
          </span>
        </article>

        <article className="summary-card notification-unread-summary">
          <span className="summary-number">
            {notificationCounts.unread}
          </span>
          <span className="summary-label">Unread</span>
        </article>

        <article className="summary-card">
          <span className="summary-number">
            {notificationCounts.read}
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
            All ({notificationCounts.total})
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
            Unread ({notificationCounts.unread})
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
            Read ({notificationCounts.read})
          </button>
        </div>

        <div className="notification-action-group">
          <button
            type="button"
            className="secondary-button"
            onClick={handleMarkAllAsRead}
            disabled={
              notificationCounts.unread === 0 ||
              isMarkingAll ||
              markingNotificationId !== null
            }
          >
            {isMarkingAll
              ? 'Marking All...'
              : 'Mark All as Read'}
          </button>
        </div>
      </section>

      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {statusMessage && (
        <p className="form-success" role="status">
          {statusMessage}
        </p>
      )}

      <div className="notification-list">
        {filteredNotifications.map((notification) => {
          const presentation =
            getNotificationPresentation(notification);

          const isRead = notification.read_at !== null;

          return (
            <article
              className={
                isRead
                  ? 'notification-card notification-card-read'
                  : 'notification-card notification-card-unread'
              }
              key={notification.id}
            >
              <div className="notification-card-header">
                <div>
                  <span
                    className={getNotificationTypeClass(
                      presentation.category,
                    )}
                  >
                    {presentation.category}
                  </span>

                  <h2>{notification.title}</h2>
                </div>

                <span
                  className={
                    isRead
                      ? 'notification-read-status read'
                      : 'notification-read-status unread'
                  }
                >
                  {isRead ? 'Read' : 'Unread'}
                </span>
              </div>

              <p className="notification-message">
                {notification.body}
              </p>

              <div className="notification-footer">
                <span className="auth-helper-text">
                  Created:{' '}
                  {formatHstDateTime(notification.created_at)}
                </span>

                <div className="notification-card-actions">
                  <Link
                    className="secondary-link"
                    to={presentation.linkTo}
                  >
                    {presentation.linkLabel}
                  </Link>

                  {!isRead && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        void handleMarkAsRead(notification.id)
                      }
                      disabled={
                        markingNotificationId === notification.id ||
                        isMarkingAll
                      }
                    >
                      {markingNotificationId === notification.id
                        ? 'Marking...'
                        : 'Mark as Read'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {filteredNotifications.length === 0 && (
        <section className="empty-state-card">
          <h2>No notifications found</h2>

          <p>
            There are no notifications matching the selected filter.
          </p>
        </section>
      )}

      <p className="demo-note">
        Issue #51 note: the frontend opens the review form when the backend
        supplies a RESERVATION_RETURNED notification with a reservation ID.
        Scheduling a separate reminder three days after return remains a
        backend responsibility.
      </p>
    </section>
  );
}

export default NotificationsPage;
