import { useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { mockNotifications } from '../data/mockData';

/**
 * NotificationFilter
 *
 * Controls which notifications are visible on the page.
 */
type NotificationFilter = 'all' | 'unread' | 'read';

/**
 * NotificationType
 *
 * Gives each mock notification a readable frontend category.
 * The backend can later send these values directly.
 */
type NotificationType =
  | 'Reservation Update'
  | 'Owner Action'
  | 'Pickup Reminder'
  | 'Return Reminder';

/**
 * NotificationRecord
 *
 * Frontend-friendly notification structure.
 * It extends the simple mock data with title, type, route link, and read state.
 */
interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  linkTo: string;
  linkLabel: string;
}

/**
 * localStorage key for frontend-only notification read state.
 *
 * Purpose:
 * - Keeps mark-as-read behavior visible during the demo.
 * - Lets AppLayout and DashboardPage update unread counts.
 */
const notificationReadStateKey = 'mockNotificationReadState';

/**
 * notificationDetails
 *
 * Adds richer display details to the current mock notification data.
 * This avoids changing the backend-facing mockData.ts shape right now.
 */
const notificationDetails: Record<
  string,
  Omit<NotificationRecord, 'id' | 'message' | 'read' | 'createdAt'>
> = {
  'notification-1': {
    title: 'New reservation request',
    type: 'Owner Action',
    linkTo: '/reservations/reservation-1',
    linkLabel: 'Open reservation',
  },
  'notification-2': {
    title: 'Reservation approved',
    type: 'Reservation Update',
    linkTo: '/reservations/reservation-2',
    linkLabel: 'View approved reservation',
  },
  'notification-3': {
    title: 'Pickup confirmed',
    type: 'Pickup Reminder',
    linkTo: '/reservations/reservation-3',
    linkLabel: 'View pickup status',
  },
};

/**
 * getStoredNotificationReadState
 *
 * Reads frontend-only notification read state from localStorage.
 * Returns an empty object if nothing was saved or JSON is invalid.
 */
function getStoredNotificationReadState() {
  const storedValue = localStorage.getItem(notificationReadStateKey);

  if (!storedValue) {
    return {} as Record<string, boolean>;
  }

  try {
    return JSON.parse(storedValue) as Record<string, boolean>;
  } catch {
    return {} as Record<string, boolean>;
  }
}

/**
 * saveNotificationReadState
 *
 * Saves read/unread state to localStorage and notifies other components.
 * AppLayout and DashboardPage listen for this event to update their badge/count.
 */
function saveNotificationReadState(notifications: NotificationRecord[]) {
  const nextReadState = notifications.reduce<Record<string, boolean>>(
    (readState, notification) => {
      readState[notification.id] = notification.read;
      return readState;
    },
    {},
  );

  localStorage.setItem(
    notificationReadStateKey,
    JSON.stringify(nextReadState),
  );

  window.dispatchEvent(new Event('mock-notifications-change'));
}

/**
 * buildInitialNotifications
 *
 * Combines mockData.ts notifications with richer frontend metadata.
 * It also applies any saved read/unread state from localStorage.
 */
function buildInitialNotifications(): NotificationRecord[] {
  const storedReadState = getStoredNotificationReadState();

  return mockNotifications.map((notification) => {
    const details = notificationDetails[notification.id] ?? {
      title: 'Notification',
      type: 'Reservation Update' as NotificationType,
      linkTo: '/notifications',
      linkLabel: 'View notification',
    };

    return {
      id: notification.id,
      title: details.title,
      message: notification.message,
      type: details.type,
      read: storedReadState[notification.id] ?? notification.read,
      createdAt: notification.createdAt,
      linkTo: details.linkTo,
      linkLabel: details.linkLabel,
    };
  });
}

/**
 * getNotificationTypeClass
 *
 * Builds a type-specific badge class for notification categories.
 */
function getNotificationTypeClass(type: NotificationType) {
  return `notification-type-badge notification-type-${type
    .toLowerCase()
    .replaceAll(' ', '-')}`;
}

/**
 * NotificationsPage
 *
 * Improved notification center for Task 4.
 *
 * Frontend responsibilities:
 * - Show notification summary counts.
 * - Show All / Unread / Read filters.
 * - Show notification type badges.
 * - Mark one notification as read.
 * - Mark all notifications as read.
 * - Reset demo state for testing.
 *
 * Important:
 * - This is frontend-only mock behavior.
 * - Backend notification model, polling, and persistence can be connected later.
 */
function NotificationsPage() {
  // Store the current frontend notification list.
  const [notifications, setNotifications] = useState<NotificationRecord[]>(
    buildInitialNotifications,
  );

  // Store current filter tab.
  const [filter, setFilter] = useState<NotificationFilter>('all');

  // Store success/status message after user actions.
  const [statusMessage, setStatusMessage] = useState('');

  /**
   * Calculate notification counts for summary cards and filter buttons.
   */
  const notificationCounts = useMemo(() => {
    const unread = notifications.filter((notification) => !notification.read)
      .length;
    const read = notifications.filter((notification) => notification.read)
      .length;

    return {
      total: notifications.length,
      unread,
      read,
    };
  }, [notifications]);

  /**
   * Filter notifications by selected tab.
   */
  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((notification) => !notification.read);
    }

    if (filter === 'read') {
      return notifications.filter((notification) => notification.read);
    }

    return notifications;
  }, [filter, notifications]);

  /**
   * Update notifications state and persist read/unread changes.
   */
  function updateNotifications(nextNotifications: NotificationRecord[]) {
    setNotifications(nextNotifications);
    saveNotificationReadState(nextNotifications);
  }

  /**
   * Mark one notification as read.
   */
  function handleMarkAsRead(notificationId: string) {
    const nextNotifications = notifications.map((notification) =>
      notification.id === notificationId
        ? { ...notification, read: true }
        : notification,
    );

    updateNotifications(nextNotifications);
    setStatusMessage('Notification marked as read.');
  }

  /**
   * Mark all notifications as read.
   */
  function handleMarkAllAsRead() {
    const nextNotifications = notifications.map((notification) => ({
      ...notification,
      read: true,
    }));

    updateNotifications(nextNotifications);
    setStatusMessage('All notifications marked as read.');
  }

  /**
   * Reset notification demo state back to mockData.ts defaults.
   * This is helpful when testing the demo repeatedly.
   */
  function handleResetDemoNotifications() {
    localStorage.removeItem(notificationReadStateKey);

    const resetNotifications = mockNotifications.map((notification) => {
      const details = notificationDetails[notification.id] ?? {
        title: 'Notification',
        type: 'Reservation Update' as NotificationType,
        linkTo: '/notifications',
        linkLabel: 'View notification',
      };

      return {
        id: notification.id,
        title: details.title,
        message: notification.message,
        type: details.type,
        read: notification.read,
        createdAt: notification.createdAt,
        linkTo: details.linkTo,
        linkLabel: details.linkLabel,
      };
    });

    setNotifications(resetNotifications);
    window.dispatchEvent(new Event('mock-notifications-change'));
    setFilter('all');
    setStatusMessage('Notification demo state was reset.');
  }

  return (
    <section className="page-section">
      {/* Page header */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Notification Center</p>
          <h1>Notifications</h1>
          <p className="page-description">
            Review reservation updates, owner actions, pickup reminders, and
            frontend demo alerts.
          </p>
        </div>

        {/* Back link for easy demo navigation */}
        <Link className="secondary-link" to="/dashboard">
          Back to Dashboard
        </Link>
      </div>

      {/* Summary cards for notification counts. */}
      <div className="notification-summary-grid">
        <article className="summary-card">
          <span className="summary-number">{notificationCounts.total}</span>
          <span className="summary-label">Total Notifications</span>
        </article>

        <article className="summary-card notification-unread-summary">
          <span className="summary-number">{notificationCounts.unread}</span>
          <span className="summary-label">Unread</span>
        </article>

        <article className="summary-card">
          <span className="summary-number">{notificationCounts.read}</span>
          <span className="summary-label">Read</span>
        </article>
      </div>

      {/* Toolbar with filters and bulk action buttons. */}
      <section className="notification-toolbar">
        <div className="notification-filter-group" aria-label="Notification filters">
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
            disabled={notificationCounts.unread === 0}
          >
            Mark All as Read
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={handleResetDemoNotifications}
          >
            Reset Demo
          </button>
        </div>
      </section>

      {/* Action status message. */}
      {statusMessage && <p className="form-success">{statusMessage}</p>}

      {/* Notification list. */}
      <div className="notification-list">
        {filteredNotifications.map((notification) => (
          <article
            className={
              notification.read
                ? 'notification-card notification-card-read'
                : 'notification-card notification-card-unread'
            }
            key={notification.id}
          >
            {/* Notification card header. */}
            <div className="notification-card-header">
              <div>
                <span className={getNotificationTypeClass(notification.type)}>
                  {notification.type}
                </span>

                <h2>{notification.title}</h2>
              </div>

              <span
                className={
                  notification.read
                    ? 'notification-read-status read'
                    : 'notification-read-status unread'
                }
              >
                {notification.read ? 'Read' : 'Unread'}
              </span>
            </div>

            {/* Notification message. */}
            <p className="notification-message">{notification.message}</p>

            {/* Notification metadata and actions. */}
            <div className="notification-footer">
              <span className="auth-helper-text">
                Created: {notification.createdAt}
              </span>

              <div className="notification-card-actions">
                <Link className="secondary-link" to={notification.linkTo}>
                  {notification.linkLabel}
                </Link>

                {!notification.read && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    Mark as Read
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Empty state when a filter has no results. */}
      {filteredNotifications.length === 0 && (
        <section className="empty-state-card">
          <h2>No notifications found</h2>
          <p>Try switching to a different filter.</p>
        </section>
      )}

      {/* Demo note documents frontend-only behavior. */}
      <p className="demo-note">
        Demo note: notification read/unread changes are saved in localStorage for
        the frontend demo only. Backend notification delivery, polling, and
        persistence can be connected later.
      </p>
    </section>
  );
}

export default NotificationsPage;