import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ApiError,
  reservationsApi,
  type Reservation,
  type ReservationState,
} from '../api/client';
import { useAuth } from '../context/authContextValue';

/**
 * ReservationsPage
 *
 * Real backend list via ``GET /reservations``.
 *
 * The backend doesn't return ``toolName`` / ``ownerName`` / ``borrowerName``
 * or a ``role`` field. We:
 *   - Derive ``role`` by comparing ``borrower_id`` to the current user id.
 *   - Show a tool id as a placeholder for the tool name (the detail page
 *     resolves the full tool on its own).
 *   - For owner names: only show it when the current user is the borrower,
 *     because the backend embeds ``owner`` on the tool (which the list
 *     doesn't include). Otherwise the user can open the reservation to see
 *     the tool detail.
 */
type StatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';

function formatStatus(state: ReservationState): string {
  return state.replace(/_/g, ' ');
}

/**
 * Returns true when a PICKED_UP reservation's end date has passed.
 * Dates are stored as YYYY-MM-DD; we compare against today's date
 * in the same format to avoid timezone ambiguity.
 */
function isOverdue(reservation: Reservation): boolean {
  if (reservation.state !== 'PICKED_UP') return false;
  const today = new Date().toISOString().slice(0, 10);
  return today > reservation.end_date;
}

function ReservationsPage() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'borrower' | 'owner'>('ALL');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage('');
    const params: { role?: 'borrower' | 'owner' } = {};
    if (roleFilter !== 'ALL') params.role = roleFilter;
    reservationsApi
      .list(params)
      .then((res) => {
        if (!cancelled) setReservations(res.items);
      })
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof ApiError) setErrorMessage(err.message);
          else setErrorMessage('Failed to load reservations.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roleFilter]);

  const filtered = reservations.filter((r) => {
    if (statusFilter === 'ACTIVE') {
      return r.state === 'REQUESTED' || r.state === 'APPROVED' || r.state === 'PICKED_UP';
    }
    if (statusFilter === 'COMPLETED') {
      return (
        r.state === 'RETURNED' || r.state === 'DENIED' || r.state === 'CANCELLED'
      );
    }
    return true;
  });

  const activeCount = reservations.filter(
    (r) =>
      r.state === 'REQUESTED' || r.state === 'APPROVED' || r.state === 'PICKED_UP',
  ).length;
  const completedCount = reservations.filter(
    (r) =>
      r.state === 'RETURNED' || r.state === 'DENIED' || r.state === 'CANCELLED',
  ).length;

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reservations</p>
          <h1>Reservation Dashboard</h1>
          <p className="page-description">
            Review your reservations as borrower and owner. Open one to take
            action or leave a review.
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <select
          value={roleFilter}
          onChange={(event) =>
            setRoleFilter(event.target.value as 'ALL' | 'borrower' | 'owner')
          }
          aria-label="Filter by role"
        >
          <option value="ALL">All roles</option>
          <option value="borrower">As borrower</option>
          <option value="owner">As owner</option>
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active (REQUESTED, APPROVED, PICKED_UP)</option>
          <option value="COMPLETED">Completed (RETURNED, DENIED, CANCELLED)</option>
        </select>
      </div>

      <div className="dashboard-summary-grid">
        <div className="summary-card">
          <span className="summary-number">{reservations.length}</span>
          <span className="summary-label">Total Reservations</span>
        </div>

        <div className="summary-card">
          <span className="summary-number">{activeCount}</span>
          <span className="summary-label">Active</span>
        </div>

        <div className="summary-card">
          <span className="summary-number">{completedCount}</span>
          <span className="summary-label">Completed or Closed</span>
        </div>
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : errorMessage ? (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      ) : filtered.length === 0 ? (
        <div className="empty-state-card">
          <p className="eyebrow">No Reservations</p>
          <h2>No reservations match the current filters.</h2>
          <p>Browse available tools to submit a new reservation request.</p>
          <Link className="primary-link" to="/tools">
            Browse Tools
          </Link>
        </div>
      ) : (
        <ReservationGrids reservations={filtered} currentUserId={user?.id} />
      )}
    </section>
  );
}

/**
 * Renders reservations split into "Active workflow" (REQUESTED,
 * APPROVED, PICKED_UP) and "Completed or closed" (RETURNED, DENIED,
 * CANCELLED). The split is visible, not just decorative — matches
 * the summary cards above.
 */
function ReservationGrids({
  reservations,
  currentUserId,
}: {
  reservations: Reservation[];
  currentUserId: string | undefined;
}) {
  const isActive = (state: ReservationState) =>
    state === 'REQUESTED' || state === 'APPROVED' || state === 'PICKED_UP';
  const active = reservations.filter((r) => isActive(r.state));
  const completed = reservations.filter((r) => !isActive(r.state));

  return (
    <>
      <section className="reservation-section">
        <h2 className="reservation-section-header">
          Active workflow <span className="reservation-section-count">({active.length})</span>
        </h2>
        {active.length === 0 ? (
          <p className="empty-state">No active reservations.</p>
        ) : (
          <div className="reservation-grid">
            {active.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                reservation={reservation}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}
      </section>

      <section className="reservation-section">
        <h2 className="reservation-section-header">
          Completed or closed{' '}
          <span className="reservation-section-count">({completed.length})</span>
        </h2>
        {completed.length === 0 ? (
          <p className="empty-state">No completed or closed reservations.</p>
        ) : (
          <div className="reservation-grid">
            {completed.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                reservation={reservation}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function ReservationCard({
  reservation,
  currentUserId,
}: {
  reservation: Reservation;
  currentUserId: string | undefined;
}) {
  const isBorrower = currentUserId === reservation.borrower_id;
  const roleLabel = isBorrower ? 'Borrower View' : 'Owner View';
  const overdue = isOverdue(reservation);
  return (
    <article className="reservation-card" key={reservation.id}>
      <div className="reservation-card-header">
        <div>
          <p className="eyebrow">{roleLabel}</p>
          <h2>Tool #{reservation.tool_id.slice(0, 8)}</h2>
        </div>

        <span
          className={`workflow-status status-${reservation.state.toLowerCase()}`}
        >
          {formatStatus(reservation.state)}
        </span>
      </div>

      {overdue && (
        <p className="overdue-banner" role="alert">
          ⚠ Overdue — the end date has passed. Please return the tool as soon as possible.
        </p>
      )}

      <dl className="reservation-meta-grid">
        <div>
          <dt>Start Date</dt>
          <dd>{reservation.start_date}</dd>
        </div>

        <div>
          <dt>End Date</dt>
          <dd>{reservation.end_date}</dd>
        </div>

        <div>
          <dt>Borrower</dt>
          <dd>
            {reservation.borrower_id === currentUserId
              ? 'You'
              : `User #${reservation.borrower_id.slice(0, 8)}`}
          </dd>
        </div>
      </dl>

      <Link
        className="primary-link"
        to={`/reservations/${reservation.id}`}
      >
        View Reservation
      </Link>
    </article>
  );
}

export default ReservationsPage;
