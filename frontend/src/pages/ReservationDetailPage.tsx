import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  mockReservations,
  type MockReservation,
  type ReservationStatus,
} from '../data/mockData';

/**
 * US18 frontend demo constants.
 *
 * pickupGraceDays:
 * - R1 plan uses a 3-day grace period for pickup.
 *
 * mockTodayHst:
 * - Fixed HST demo date so the overdue notice is visible during the demo.
 * - Backend/Celery will later use the real HST date.
 */
const pickupGraceDays = 3;
const mockTodayHst = '2026-07-08';

/**
 * addDaysToDateString
 *
 * Adds days to a YYYY-MM-DD date string and returns YYYY-MM-DD.
 * Uses UTC internally to keep output stable across browsers.
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
 * Rule for mock demo:
 * - Only APPROVED reservations can become overdue for pickup.
 * - Pickup must be confirmed within 3 days after the reservation start date.
 * - If the grace deadline passed, show an overdue/auto-cancel notice.
 *
 * Important:
 * - This does not run a real scheduled job.
 * - Backend/Celery will later perform the actual auto-cancel.
 */
function getPickupAutoCancelInfo(
  reservation: MockReservation,
  currentStatus: ReservationStatus,
) {
  if (currentStatus !== 'APPROVED') {
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
 * ReservationDetailPage
 *
 * This page shows one reservation and mock action buttons.
 * The buttons simulate the reservation lifecycle for R1:
 *
 * REQUESTED -> APPROVED / DENIED
 * APPROVED -> PICKED_UP
 * PICKED_UP -> RETURNED
 *
 * PR #131 review fix:
 * - When a reservation reaches RETURNED status, show a real "Leave Review"
 *   link instead of a disabled "Leave Review Coming Next" button.
 *
 * US18 added:
 * - Shows overdue pickup indicator.
 * - Shows detailed auto-cancel notice.
 * - Provides a mock auto-cancel action for demo purposes only.
 *
 * Later backend behavior:
 * - Ivan can connect each action button to backend API endpoints.
 * - The review link can stay the same because it already matches the route:
 *   /reservations/:reservationId/review
 * - Celery/backend job can perform the real US18 auto-cancel.
 */
function ReservationDetailPage() {
  // Read reservationId from the route path: /reservations/:reservationId
  const { reservationId } = useParams();

  // Find selected reservation from mock data.
  const reservation = mockReservations.find(
    (mockReservation) => mockReservation.id === reservationId,
  );

  /**
   * Local status state lets the demo update status without backend persistence.
   *
   * If the reservation exists, start with the mock reservation status.
   * If the reservation does not exist, fall back to REQUESTED.
   */
  const [currentStatus, setCurrentStatus] = useState<ReservationStatus>(
    reservation?.status ?? 'REQUESTED',
  );

  // Message shown after a mock action button is clicked.
  const [actionMessage, setActionMessage] = useState('');

  /**
   * Converts backend-style status values into readable text.
   *
   * Example:
   * PICKED_UP -> PICKED UP
   */
  const formatStatus = (status: ReservationStatus) => {
    return status.replace('_', ' ');
  };

  /**
   * Updates local status for the mock demo.
   *
   * This simulates a backend response for the R1 frontend demo.
   * A page refresh will reset the status back to the original mock data.
   */
  const handleStatusChange = (
    nextStatus: ReservationStatus,
    message: string,
  ) => {
    setCurrentStatus(nextStatus);
    setActionMessage(message);
  };

  /**
   * Friendly error page for an invalid reservation ID.
   *
   * This prevents the app from crashing if a user opens a bad URL.
   */
  if (!reservation) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Reservation Not Found</p>
          <h1>We could not find this reservation.</h1>
          <p>
            The selected reservation may not exist in the current mock data.
          </p>
          <Link className="primary-link narrow-link" to="/reservations">
            Back to Reservations
          </Link>
        </div>
      </section>
    );
  }

  // Determine which mock role this reservation is using for demo actions.
  const isBorrower = reservation.role === 'borrower';
  const isOwner = reservation.role === 'owner';

  // US18 auto-cancel notice information for this reservation.
  const autoCancelInfo = getPickupAutoCancelInfo(reservation, currentStatus);

  return (
    <section className="page-section">
      {/* Page header */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Reservation Detail</p>
          <h1>{reservation.toolName}</h1>
          <p className="page-description">
            Review this reservation and test the mock R1 workflow actions for
            borrower and owner roles.
          </p>
        </div>

        {/* Back link to the reservation list */}
        <Link className="secondary-link" to="/reservations">
          Back to Reservations
        </Link>
      </div>

      {/* Main reservation detail layout */}
      <div className="reservation-detail-grid">
        {/* Reservation information card */}
        <article className="reservation-detail-card">
          {/* Reservation title and status */}
          <div className="reservation-card-header">
            <div>
              <p className="eyebrow">
                {isOwner ? 'Owner Workflow' : 'Borrower Workflow'}
              </p>
              <h2>{reservation.toolName}</h2>
            </div>

            <span
              className={`workflow-status status-${currentStatus.toLowerCase()}`}
            >
              {formatStatus(currentStatus)}
            </span>
          </div>

          {/* Reservation metadata */}
          <dl className="reservation-meta-grid detail-meta-grid">
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

            <div>
              <dt>Your Demo Role</dt>
              <dd>{isOwner ? 'Owner' : 'Borrower'}</dd>
            </div>

            <div>
              <dt>Tool Link</dt>
              <dd>
                <Link to={`/tools/${reservation.toolId}`}>
                  View Tool Detail
                </Link>
              </dd>
            </div>
          </dl>

          {/* US18 detailed auto-cancel notice. */}
          {autoCancelInfo && (
            <section
              className={
                autoCancelInfo.isOverdue
                  ? 'auto-cancel-detail-panel overdue'
                  : 'auto-cancel-detail-panel grace'
              }
            >
              <p className="eyebrow">US18 Auto-Cancel Overdue Pickup</p>

              <h3>
                {autoCancelInfo.isOverdue
                  ? 'Pickup is overdue'
                  : 'Pickup is still within grace period'}
              </h3>

              <ul>
                <li>Mock today: {mockTodayHst} HST</li>
                <li>Reservation start date: {reservation.startDate}</li>
                <li>Pickup grace deadline: {autoCancelInfo.graceDeadline} HST</li>
                <li>Auto-cancel evaluation date: {autoCancelInfo.autoCancelDate} HST</li>
              </ul>

              {autoCancelInfo.isOverdue ? (
                <p>
                  Pickup was not confirmed within the {pickupGraceDays}-day
                  grace period. The real backend job would auto-cancel this
                  reservation and free the tool dates.
                </p>
              ) : (
                <p>
                  Pickup is not overdue yet. The borrower can still confirm
                  pickup before the grace deadline.
                </p>
              )}
            </section>
          )}

          {/* Optional borrower request message */}
          {reservation.message && (
            <div className="info-panel">
              <h3>Request Message</h3>
              <p>{reservation.message}</p>
            </div>
          )}

          {/* Success/status message after mock action */}
          {actionMessage && (
            <div className="success-message" role="status">
              {actionMessage}
            </div>
          )}
        </article>

        {/* Workflow action panel */}
        <aside className="workflow-actions-card">
          <p className="eyebrow">Workflow Actions</p>
          <h2>Available Actions</h2>
          <p>
            These buttons are mock frontend actions. They update the status on
            this page only. A page refresh will reset the mock data.
          </p>

          {/* Workflow buttons change based on status and role */}
          <div className="workflow-action-list">
            {/* Owner can approve or deny REQUESTED reservations */}
            {currentStatus === 'REQUESTED' && isOwner && (
              <>
                <button
                  type="button"
                  className="action-button approve-button"
                  onClick={() =>
                    handleStatusChange(
                      'APPROVED',
                      'Reservation approved. Status changed to APPROVED.',
                    )
                  }
                >
                  Approve Request
                </button>

                <button
                  type="button"
                  className="action-button danger-button"
                  onClick={() =>
                    handleStatusChange(
                      'DENIED',
                      'Reservation denied. Status changed to DENIED.',
                    )
                  }
                >
                  Deny Request
                </button>
              </>
            )}

            {/* Borrower can cancel REQUESTED reservations */}
            {currentStatus === 'REQUESTED' && isBorrower && (
              <button
                type="button"
                className="action-button danger-button"
                onClick={() =>
                  handleStatusChange(
                    'CANCELLED',
                    'Request cancelled. Status changed to CANCELLED.',
                  )
                }
              >
                Cancel Request
              </button>
            )}

            {/* Borrower can confirm pickup or cancel before pickup when APPROVED */}
            {currentStatus === 'APPROVED' && isBorrower && (
              <>
                <button
                  type="button"
                  className="action-button approve-button"
                  onClick={() =>
                    handleStatusChange(
                      'PICKED_UP',
                      'Pickup confirmed. Status changed to PICKED_UP.',
                    )
                  }
                >
                  Confirm Pickup
                </button>

                <button
                  type="button"
                  className="action-button danger-button"
                  onClick={() =>
                    handleStatusChange(
                      'CANCELLED',
                      'Reservation cancelled before pickup.',
                    )
                  }
                >
                  Cancel Before Pickup
                </button>
              </>
            )}

            {/* Owner can cancel an APPROVED reservation */}
            {currentStatus === 'APPROVED' && isOwner && (
              <button
                type="button"
                className="action-button danger-button"
                onClick={() =>
                  handleStatusChange(
                    'CANCELLED',
                    'Owner cancelled the approved reservation.',
                  )
                }
              >
                Cancel Reservation
              </button>
            )}

            {/* US18 mock auto-cancel action for overdue APPROVED reservation. */}
            {autoCancelInfo?.isOverdue && (
              <button
                type="button"
                className="action-button danger-button"
                onClick={() =>
                  handleStatusChange(
                    'CANCELLED',
                    'Mock US18 auto-cancel applied. Status changed to CANCELLED and tool dates would be freed by backend logic.',
                  )
                }
              >
                Mock Auto-Cancel Overdue Pickup
              </button>
            )}

            {/* Borrower can confirm return when PICKED_UP */}
            {currentStatus === 'PICKED_UP' && isBorrower && (
              <button
                type="button"
                className="action-button approve-button"
                onClick={() =>
                  handleStatusChange(
                    'RETURNED',
                    'Return confirmed. Status changed to RETURNED.',
                  )
                }
              >
                Confirm Return
              </button>
            )}

            {/* PR #131 review fix: RETURNED reservations now link to ReviewPage */}
            {currentStatus === 'RETURNED' && (
              <Link
                className="action-button approve-button workflow-review-link"
                to={`/reservations/${reservation.id}/review`}
              >
                Leave Review
              </Link>
            )}

            {/* Closed states show a message instead of action buttons */}
            {(currentStatus === 'DENIED' || currentStatus === 'CANCELLED') && (
              <p className="closed-workflow-message">
                This reservation is closed. No further action is available.
              </p>
            )}
          </div>

          {/* R1 story coverage note */}
          <div className="workflow-note">
            <h3>R1 stories covered</h3>
            <ul>
              <li>US14 Owner Approve / Deny</li>
              <li>US17 Borrower Confirm Pickup</li>
              <li>US18 Auto-Cancel Overdue Pickup</li>
              <li>US20 Borrower Confirm Return</li>
              <li>US24 Leave Rating / Review after return</li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default ReservationDetailPage;