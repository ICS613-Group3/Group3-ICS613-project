import { Link } from 'react-router-dom';
import { mockReservations, type ReservationStatus } from '../data/mockData';

/**
 * ReservationsPage
 *
 * This page shows the user's reservation dashboard using mock data.
 * It supports both borrower-side and owner-side reservation examples.
 *
 * R1 demo flow:
 * Reservations -> View Reservation -> action buttons
 */
function ReservationsPage() {
  const activeReservations = mockReservations.filter(
    (reservation) =>
      reservation.status === 'REQUESTED' ||
      reservation.status === 'APPROVED' ||
      reservation.status === 'PICKED_UP',
  );

  const completedReservations = mockReservations.filter(
    (reservation) =>
      reservation.status === 'RETURNED' ||
      reservation.status === 'DENIED' ||
      reservation.status === 'CANCELLED',
  );

  /**
   * Converts backend-style reservation status values into readable text.
   */
  const formatStatus = (status: ReservationStatus) => {
    return status.replace('_', ' ');
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reservations</p>
          <h1>Reservation Dashboard</h1>
          <p className="page-description">
            Review borrower and owner reservations, check current status, and
            open each reservation to test the R1 workflow action buttons.
          </p>
        </div>
      </div>

      <div className="dashboard-summary-grid">
        <div className="summary-card">
          <span className="summary-number">{mockReservations.length}</span>
          <span className="summary-label">Total Reservations</span>
        </div>

        <div className="summary-card">
          <span className="summary-number">{activeReservations.length}</span>
          <span className="summary-label">Active Workflow Items</span>
        </div>

        <div className="summary-card">
          <span className="summary-number">{completedReservations.length}</span>
          <span className="summary-label">Completed or Closed</span>
        </div>
      </div>

      <div className="reservation-grid">
        {mockReservations.map((reservation) => (
          <article className="reservation-card" key={reservation.id}>
            <div className="reservation-card-header">
              <div>
                <p className="eyebrow">
                  {reservation.role === 'owner' ? 'Owner View' : 'Borrower View'}
                </p>
                <h2>{reservation.toolName}</h2>
              </div>

              <span
                className={`workflow-status status-${reservation.status.toLowerCase()}`}
              >
                {formatStatus(reservation.status)}
              </span>
            </div>

            <dl className="reservation-meta-grid">
              <div>
                <dt>Borrower</dt>
                <dd>{reservation.borrowerName}</dd>
              </div>

              <div>
                <dt>Owner</dt>
                <dd>{reservation.ownerName}</dd>
              </div>

              <div>
                <dt>Start Date</dt>
                <dd>{reservation.startDate}</dd>
              </div>

              <div>
                <dt>End Date</dt>
                <dd>{reservation.endDate}</dd>
              </div>
            </dl>

            {reservation.message && (
              <p className="reservation-message">{reservation.message}</p>
            )}

            <Link
              className="primary-link"
              to={`/reservations/${reservation.id}`}
            >
              View Reservation
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ReservationsPage;
