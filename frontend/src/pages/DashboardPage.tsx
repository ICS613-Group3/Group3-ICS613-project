import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { toolsApi } from '../api/tools';
import { reservationsApi } from '../api/reservations';
import { notificationsApi } from '../api/notifications';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

function DashboardPage() {
  const { user } = useAuth();
  const [totalTools, setTotalTools] = useState(0);
  const [totalReservations, setTotalReservations] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [toolsData, resData, notifData] = await Promise.all([
          toolsApi.list({ page_size: 1 }),
          reservationsApi.list({ page_size: 1 }),
          notificationsApi.list({ page_size: 1 }),
        ]);

        setTotalTools(toolsData.total);
        setTotalReservations(resData.total);
        setUnreadNotifications(notifData.unread_count);
      } catch {
        // Silently handle — dashboard still renders.
      } finally {
        setIsLoading(false);
      }
    };

    fetchCounts();
  }, []);

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Member Dashboard</h1>
          <p className="page-description">
            Welcome{user?.full_name ? `, ${user.full_name}` : ''}! Quick access to your tools, reservations, and notifications.
          </p>
          {USE_MOCKS && (
            <p className="mock-banner">Running in mock mode — no backend required.</p>
          )}
        </div>
      </div>

      <div className="dashboard-summary-grid">
        <article className="summary-card">
          <span className="summary-number">{isLoading ? '...' : totalTools}</span>
          <span className="summary-label">Available Tools</span>
        </article>

        <article className="summary-card">
          <span className="summary-number">{isLoading ? '...' : totalReservations}</span>
          <span className="summary-label">Your Reservations</span>
        </article>

        <article className="summary-card notification-unread-summary">
          <span className="summary-number">{isLoading ? '...' : unreadNotifications}</span>
          <span className="summary-label">Unread Notifications</span>
        </article>
      </div>

      <div className="dashboard-card-grid">
        <Link className="dashboard-card-link" to="/tools">
          <article className="dashboard-card">
            <h2>Browse Tools</h2>
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
