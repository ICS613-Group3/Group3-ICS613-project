import { Link } from 'react-router-dom';

/**
 * NotificationsPage
 *
 * Current R1 behavior:
 * - Placeholder/mock notification page.
 * - Prevents Dashboard notification card from going to a 404 page.
 * - Shows sample notification items for frontend demo only.
 *
 * Future backend behavior:
 * - Replace mock notification data with GET /api/v1/notifications.
 * - Add mark-as-read behavior using POST /api/v1/notifications/{id}/read.
 */
function NotificationsPage() {
  /**
   * Mock notification list for R1 frontend demo.
   *
   * These are temporary frontend-only notifications.
   * Ivan/backend integration can replace this array with API data later.
   */
  const mockNotifications = [
    {
      id: 'notification-1',
      title: 'Reservation request approved',
      message: 'Your request for the Cordless Drill was approved.',
      status: 'Unread',
      createdAt: '2026-06-30',
    },
    {
      id: 'notification-2',
      title: 'Tool returned',
      message: 'Pressure Washer was marked as returned and is ready for review.',
      status: 'Unread',
      createdAt: '2026-06-29',
    },
    {
      id: 'notification-3',
      title: 'New reservation request',
      message: 'Nick Fairhart requested to borrow your Garden Shovel.',
      status: 'Read',
      createdAt: '2026-06-27',
    },
  ];

  return (
    <section className="page-section">
      {/* Page header */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Notification Center</p>
          <h1>Notifications</h1>
          <p className="page-description">
            Review recent reservation updates, status changes, and demo alerts.
          </p>
        </div>

        {/* Back link for easy demo navigation */}
        <Link className="secondary-link" to="/dashboard">
          Back to Dashboard
        </Link>
      </div>

      {/* Notification list */}
      <div className="review-history-grid">
        {mockNotifications.map((notification) => (
          <article className="review-history-card" key={notification.id}>
            {/* Notification title and status */}
            <div>
              <p className="eyebrow">{notification.status}</p>
              <h2>{notification.title}</h2>
            </div>

            {/* Notification message */}
            <p className="review-history-comment">{notification.message}</p>

            {/* Notification date */}
            <p className="auth-helper-text">
              Date: {notification.createdAt}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default NotificationsPage;
