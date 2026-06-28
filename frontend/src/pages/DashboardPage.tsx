import { Link } from 'react-router-dom';
import { mockNotifications, mockReservations, mockTools } from '../data/mockData';

/**
 * DashboardPage
 *
 * This page is the main landing page after a member logs in.
 * For now, it uses mock data so the R1 frontend demo looks realistic
 * before the backend API is fully connected.
 */
function DashboardPage() {
  // Count the number of mock tools so the dashboard can show a quick summary.
  const totalTools = mockTools.length;

  // Count the number of reservations shown in mock data.
  const totalReservations = mockReservations.length;

  // Count unread notifications for the notification card.
  const unreadNotifications = mockNotifications.filter(
    (notification) => !notification.read,
  ).length;

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

        <article className="summary-card">
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
              View available tools, browse listings, and later manage tools you
              own.
            </p>
            <span className="card-action">View tools ?</span>
          </article>
        </Link>

        <Link className="dashboard-card-link" to="/reservations">
          <article className="dashboard-card">
            <h2>My Reservations</h2>
            <p>
              View borrower and owner reservation workflows with status badges
              such as REQUESTED, APPROVED, PICKED_UP, and RETURNED.
            </p>
            <span className="card-action">View reservations ?</span>
          </article>
        </Link>

        <Link className="dashboard-card-link" to="/notifications">
          <article className="dashboard-card">
            <h2>Notifications</h2>
            <p>
              Review reservation updates, approval notices, pickup changes, and
              return reminders.
            </p>
            <span className="card-action">View notifications ?</span>
          </article>
        </Link>
      </div>
    </section>
  );
}

export default DashboardPage;
