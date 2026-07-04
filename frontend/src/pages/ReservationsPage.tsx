import { Link } from 'react-router-dom';
import {
  mockReservations,
  type MockReservation,
  type ReservationStatus,
} from '../data/mockData';

/**
 * US18 frontend demo constants.
 *
 * pickupGraceDays:
 * - The R1 plan describes a 3-day pickup grace period.
 *
 * mockTodayHst:
 * - Fixed demo date so the overdue UI is always visible during the R1 demo.
 * - This is frontend-only display logic.
 * - Backend/Celery will later decide the real current HST date.
 */
const pickupGraceDays = 3;
const mockTodayHst = '2026-07-08';

/**
 * addDaysToDateString
 *
 * Adds days to a YYYY-MM-DD date string and returns YYYY-MM-DD.
 * Uses UTC internally to avoid browser local timezone display issues.
 */
function addDaysToDateString(dateString: string, daysToAdd: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

/**
 * getDateDifferenceInDays
 *
 * Returns the number of calendar days between two YYYY-MM-DD dates.
 * This is used only for frontend demo messages.
 */
function getDateDifferenceInDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay);
}

/**
 * getPickupAutoCancelInfo
 *
 * US18 frontend helper.
 *
 * Rule for this mock demo:
 * - Only APPROVED reservations can become overdue for pickup.
 * - The borrower has 3 days after the start date to pick up the tool.
 * - After the grace deadline, the UI shows an overdue/auto-cancel notice.
 *
 * Important:
 * - This does not auto-cancel anything in the backend.
 * - Real auto-cancel will later be handled by Celery/backend job logic.
 */
function getPickupAutoCancelInfo(reservation: MockReservation) {
  if (reservation.status !== 'APPROVED') {
    return null;
  }

  const graceDeadline = addDaysToDateString(
    reservation.startDate,
    pickupGraceDays,
  );

  const autoCancelDate = addDaysToDateString(
    reservation.startDate,
    pickupGraceDays + 1,
  );

  const isOverdue = mockTodayHst > graceDeadline;
  const daysPastGrace = Math.max(
    0,
    getDateDifferenceInDays(graceDeadline, mockTodayHst),
  );

  return {
    graceDeadline,
    autoCancelDate,
    isOverdue,
    daysPastGrace,
  };
}

/**
 * ReservationsPage
 *
 * This page shows the user's reservation dashboard using mock data.
 * It supports both borrower-side and owner-side reservation examples.
 *
 * R1 demo flow:
 * Reservations -> View Reservation -> action buttons
 *
 * US18 added:
 * - Shows overdue pickup indicator.
 * - Shows auto-cancel notice for APPROVED reservations past grace period.
 * - Uses frontend-only mock date logic.
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

  const overduePickupReservations = mockReservations.filter((reservation) => {
    const autoCancelInfo = getPickupAutoCancelInfo(reservation);
    return autoCancelInfo?.isOverdue;
  });

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

        <div className="summary-card overdue-summary-card">
          <span className="summary-number">
            {overduePickupReservations.length}
          </span>
          <span className="summary-label">Overdue Pickup</span>
        </div>
      </div>

      {/* US18 page-level explanation. */}
      <section className="auto-cancel-page-note">
        <p className="eyebrow">US18 Auto-Cancel Overdue Pickup</p>
        <h2>Overdue Pickup Demo Rule</h2>
        <p>
          For this frontend demo, today is treated as {mockTodayHst} HST. An
          APPROVED reservation becomes overdue if pickup is not confirmed within{' '}
          {pickupGraceDays} days after the start date.
        </p>
      </section>

      <div className="reservation-grid">
        {mockReservations.map((reservation) => {
          const autoCancelInfo = getPickupAutoCancelInfo(reservation);

          return (
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

              {/* US18 card-level overdue / grace period indicator. */}
              {autoCancelInfo && (
                <section
                  className={
                    autoCancelInfo.isOverdue
                      ? 'overdue-pickup-notice'
                      : 'pickup-grace-notice'
                  }
                >
                  <strong>
                    {autoCancelInfo.isOverdue
                      ? 'Overdue pickup - auto-cancel notice'
                      : 'Pickup grace period'}
                  </strong>

                  {autoCancelInfo.isOverdue ? (
                    <p>
                      Pickup was not confirmed by {autoCancelInfo.graceDeadline}{' '}
                      HST. This reservation is {autoCancelInfo.daysPastGrace}{' '}
                      day(s) past the grace deadline and would be auto-cancelled
                      by backend job logic.
                    </p>
                  ) : (
                    <p>
                      Pickup must be confirmed by {autoCancelInfo.graceDeadline}{' '}
                      HST before the auto-cancel rule applies.
                    </p>
                  )}
                </section>
              )}

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
          );
        })}
      </div>
    </section>
  );
}

export default ReservationsPage;