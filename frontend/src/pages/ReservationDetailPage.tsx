import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  mockReservations,
  type ReservationStatus,
} from '../data/mockData';

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
 * Later, Ivan can connect each button to the backend API endpoints.
 */
function ReservationDetailPage() {
  // Read reservationId from the route path: /reservations/:reservationId
  const { reservationId } = useParams();

  // Find selected reservation from mock data.
  const reservation = mockReservations.find(
    (mockReservation) => mockReservation.id === reservationId,
  );

  // Local status state lets the demo update status without backend persistence.
  const [currentStatus, setCurrentStatus] = useState<ReservationStatus>(
    reservation?.status ?? 'REQUESTED',
  );

  // Message shown after a mock action button is clicked.
  const [actionMessage, setActionMessage] = useState('');

  /**
   * Converts backend-style status values into readable text.
   */
  const formatStatus = (status: ReservationStatus) => {
    return status.replace('_', ' ');
  };

  /**
   * Updates local status for the mock demo.
   * This simulates a backend response.
   */
  const handleStatusChange = (
    nextStatus: ReservationStatus,
    message: string,
  ) => {
    setCurrentStatus(nextStatus);
    setActionMessage(message);
  };

  // Friendly error page for an invalid reservation ID.
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

  const isBorrower = reservation.role === 'borrower';
  const isOwner = reservation.role === 'owner';

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reservation Detail</p>
          <h1>{reservation.toolName}</h1>
          <p className="page-description">
            Review this reservation and test the mock R1 workflow actions for
            borrower and owner roles.
          </p>
        </div>

        <Link className="secondary-link" to="/reservations">
          Back to Reservations
        </Link>
      </div>

      <div className="reservation-detail-grid">
        <article className="reservation-detail-card">
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

          {reservation.message && (
            <div className="info-panel">
              <h3>Request Message</h3>
              <p>{reservation.message}</p>
            </div>
          )}

          {actionMessage && (
            <div className="success-message" role="status">
              {actionMessage}
            </div>
          )}
        </article>

        <aside className="workflow-actions-card">
          <p className="eyebrow">Workflow Actions</p>
          <h2>Available Actions</h2>
          <p>
            These buttons are mock frontend actions. They update the status on
            this page only. A page refresh will reset the mock data.
          </p>

          <div className="workflow-action-list">
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

            {currentStatus === 'RETURNED' && (
              <button type="button" className="action-button disabled-button">
                Leave Review Coming Next
              </button>
            )}

            {(currentStatus === 'DENIED' || currentStatus === 'CANCELLED') && (
              <p className="closed-workflow-message">
                This reservation is closed. No further action is available.
              </p>
            )}
          </div>

          <div className="workflow-note">
            <h3>R1 stories covered</h3>
            <ul>
              <li>US14 Owner Approve / Deny</li>
              <li>US17 Borrower Confirm Pickup</li>
              <li>US20 Borrower Confirm Return</li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default ReservationDetailPage;
