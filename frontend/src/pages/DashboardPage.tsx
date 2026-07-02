import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ApiError,
  notificationsApi,
  reservationsApi,
  toolsApi,
  type NotificationListResponse,
  type PaginatedResponse,
  type Reservation,
  type Tool,
} from '../api/client';
import { useAuth } from '../context/authContextValue';

/**
 * DashboardPage
 *
 * Real backend summary via three small list calls:
 *   - ``GET /tools``                    → total tools count
 *   - ``GET /reservations``             → reservation counts (active vs closed)
 *   - ``GET /notifications?unread_only`` → unread notification count
 *
 * The dashboard itself doesn't display a notifications page yet; the
 * link goes to ``/tools?view=returned`` until the dedicated page is built.
 */
function DashboardPage() {
  const { user } = useAuth();
  const [totalTools, setTotalTools] = useState(0);
  const [activeReservations, setActiveReservations] = useState(0);
  const [completedReservations, setCompletedReservations] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage('');
    Promise.all([
      toolsApi.list({ page_size: 1 }),
      reservationsApi.list({ page_size: 100 }),
      notificationsApi.list({ unread_only: true, page_size: 1 }),
    ])
      .then(
        ([toolsRes, reservationsRes, notifRes]: [
          PaginatedResponse<Tool>,
          PaginatedResponse<Reservation>,
          NotificationListResponse,
        ]) => {
          if (cancelled) return;
          setTotalTools(toolsRes.total);
          setUnreadNotifications(notifRes.unread_count);
          const active = reservationsRes.items.filter(
            (r) =>
              r.state === 'REQUESTED' ||
              r.state === 'APPROVED' ||
              r.state === 'PICKED_UP',
          ).length;
          const closed = reservationsRes.items.filter(
            (r) =>
              r.state === 'RETURNED' ||
              r.state === 'DENIED' ||
              r.state === 'CANCELLED',
          ).length;
          setActiveReservations(active);
          setCompletedReservations(closed);
        },
      )
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof ApiError) setErrorMessage(err.message);
          else setErrorMessage('Failed to load dashboard.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">R1 Workflow</p>
          <h1>Member Dashboard</h1>
          <p className="page-description">
            Welcome{user?.full_name ? `, ${user.full_name}` : ''}. Quick access
            to your tools, reservations, and notifications.
          </p>
        </div>
      </div>

      {errorMessage && (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="dashboard-summary-grid">
        <article className="summary-card">
          <span className="summary-number">
            {isLoading ? '—' : totalTools}
          </span>
          <span className="summary-label">Tools in the system</span>
        </article>

        <article className="summary-card">
          <span className="summary-number">
            {isLoading ? '—' : activeReservations}
          </span>
          <span className="summary-label">My active reservations</span>
        </article>

        <article className="summary-card">
          <span className="summary-number">
            {isLoading ? '—' : completedReservations}
          </span>
          <span className="summary-label">My completed or closed</span>
        </article>

        <article className="summary-card">
          <span className="summary-number">
            {isLoading ? '—' : unreadNotifications}
          </span>
          <span className="summary-label">Unread notifications</span>
        </article>
      </div>

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
              Review borrower and owner reservations and take workflow actions
              like approve, deny, confirm pickup, and confirm return.
            </p>
            <span className="card-action">View reservations</span>
          </article>
        </Link>

        <Link className="dashboard-card-link" to="/reviews/history">
          <article className="dashboard-card">
            <h2>Review History</h2>
            <p>
              See reviews you have given and received for returned
              reservations.
            </p>
            <span className="card-action">View review history</span>
          </article>
        </Link>
      </div>
    </section>
  );
}

export default DashboardPage;
