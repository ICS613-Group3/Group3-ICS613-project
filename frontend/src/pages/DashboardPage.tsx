import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { mockNotifications, mockReservations, mockTools } from '../data/mockData';

/**
 * DashboardPage
 *
 * This page is the main landing page after a member logs in.
 *
 * Current R1 demo purpose:
 * - Show quick summary counts.
 * - Let the user go to Browse Tools.
 * - Let the user go to Reservations.
 * - Let the user go to Notifications.
 *
 * Task 4 notification behavior:
 * - Unread notification count updates when NotificationsPage marks items read.
 *
 * Note:
 * The temporary "Review Demo" card was removed from the dashboard.
 * The review workflow should be reached from returned reservations / Review Tools.
 */
function DashboardPage() {
  // localStorage key used by NotificationsPage for frontend-only read state.
  const notificationReadStateKey = 'mockNotificationReadState';

  /**
   * getStoredNotificationReadState
   *
   * Reads notification read state from localStorage.
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
   * getUnreadNotificationCount
   *
   * Counts unread notifications using mock data plus localStorage override.
   */
  function getUnreadNotificationCount() {
    const storedReadState = getStoredNotificationReadState();

    return mockNotifications.filter((notification) => {
      const isRead = storedReadState[notification.id] ?? notification.read;
      return !isRead;
    }).length;
  }

  // Count the number of mock tools so the dashboard can show a quick summary.
  const totalTools = mockTools.length;

  // Count the number of reservations shown in mock data.
  const totalReservations = mockReservations.length;

  // Count unread notifications for the notification card.
  const [unreadNotifications, setUnreadNotifications] = useState(
    getUnreadNotificationCount,
  );

  /**
   * Keep unread notification count synced with NotificationsPage.
   */
  useEffect(() => {
    const syncUnreadNotifications = () => {
      setUnreadNotifications(getUnreadNotificationCount());
    };

    // Listen for same-tab notification updates.
    window.addEventListener('mock-notifications-change', syncUnreadNotifications);

    // Listen for localStorage changes from another tab.
    window.addEventListener('storage', syncUnreadNotifications);

    // Update once when dashboard loads.
    syncUnreadNotifications();

    // Clean up listeners when dashboard unmounts.
    return () => {
      window.removeEventListener(
        'mock-notifications-change',
        syncUnreadNotifications,
      );
      window.removeEventListener('storage', syncUnreadNotifications);
    };
  }, []);

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">R1 Workflow</p>
          <h1>Member Dashboard</h1>
          <p className="page-description">
            This dashboard gives members quick access to their tools,
            reservations, and notifications for the Neighborhood Tool Sharing
            workflow.
          </p>
        </div>
      </div>

      {/* Summary cards give the user a quick overview of the current mock data. */}
      <div className="dashboard-summary-grid">
        <article className="summary-card">
          <span className="summary-number">{totalTools}</span>
          <span className="summary-label">Mock Tools</span>
        </article>

        <article className="summary-card">
          <span className="summary-number">{totalReservations}</span>
          <span className="summary-label">Mock Reservations</span>
        </article>

        <article className="summary-card notification-unread-summary">
          <span className="summary-number">{unreadNotifications}</span>
          <span className="summary-label">Unread Notifications</span>
        </article>
      </div>

      {/* These cards are clickable so the dashboard acts like a real navigation hub. */}
      <div className="dashboard-card-grid">
        <Link className="dashboard-card-link" to="/tools">
          <article className="dashboard-card">
            <h2>My Tools</h2>
            <p>
              View available tools, browse listings, create new tool listings,
              and open tool detail pages.
            </p>
            <span className="card-action">View tools</span>
          </article>
        </Link>

        <Link className="dashboard-card-link" to="/reservations">
          <article className="dashboard-card">
            <h2>My Reservations</h2>
            <p>
              View borrower and owner reservation workflows with status badges
              such as REQUESTED, APPROVED, PICKED_UP, and RETURNED.
            </p>
            <span className="card-action">View reservations</span>
          </article>
        </Link>

        <Link className="dashboard-card-link" to="/notifications">
          <article className="dashboard-card">
            <h2>Notifications</h2>
            <p>
              Review reservation updates, approval notices, pickup changes, and
              return reminders.
            </p>
            <span className="card-action">
              View notifications
              {unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ''}
            </span>
          </article>
        </Link>
      </div>
    </section>
  );
}

export default DashboardPage;