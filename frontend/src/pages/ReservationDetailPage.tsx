import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { reservationsApi } from '../api/reservations';
import {
  mockReservations,
  type MockReservation,
  type ReservationStatus,
} from '../data/mockData';
import type { ReservationResponse } from '../types/api';

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

interface ReservationDisplay {
  id: string;
  toolId: string;
  toolName: string;
  borrowerName: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  role: 'borrower' | 'owner';
  message?: string;
}

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

function normalizeBackendReservation(
  reservation: ReservationResponse,
): ReservationDisplay {
  return {
    id: reservation.id,
    toolId: reservation.tool_id,
    toolName: `Tool ${reservation.tool_id}`,
    borrowerName: reservation.borrower_id,
    ownerName: 'Owner details unavailable in reservation response',
    startDate: reservation.start_date,
    endDate: reservation.end_date,
    role: 'borrower',
    message: '',
  };
}

/**
 * ReservationDetailPage
 *
 * This page shows one reservation and workflow action buttons.
 *
 * Issue #47:
 * - Confirm Return now calls the real backend mark-returned endpoint for
 *   backend reservation IDs.
 * - Original frontend mock reservation IDs still use local state so the demo
 *   remains usable without a seeded backend record.
 */
function ReservationDetailPage() {
  const { reservationId } = useParams();

  const reservation = mockReservations.find(
    (mockReservation) => mockReservation.id === reservationId,
  );

  const [currentStatus, setCurrentStatus] = useState<ReservationStatus>(
    reservation?.status ?? 'REQUESTED',
  );

  const [actionMessage, setActionMessage] = useState('');
  const [isConfirmingReturn, setIsConfirmingReturn] = useState(false);
  const [returnErrorMessage, setReturnErrorMessage] = useState('');

  const [backendReservation, setBackendReservation] =
    useState<ReservationResponse | null>(null);
  const [isLoadingBackendReservation, setIsLoadingBackendReservation] =
    useState(false);
  const [backendReservationError, setBackendReservationError] = useState('');

  const formatStatus = (status: ReservationStatus) => {
    return status.replace('_', ' ');
  };

  /**
   * Issue #47 backend reservation loading.
   *
   * The original page was mock-only. This keeps mock reservations working,
   * but also loads real backend reservations when the URL uses a backend ID.
   */
  useEffect(() => {
    const backendReservationId = reservationId ?? '';

    if (
      reservation ||
      !backendReservationId ||
      backendReservationId.startsWith('reservation-')
    ) {
      return;
    }

    let isMounted = true;

    async function loadBackendReservation() {
      setIsLoadingBackendReservation(true);
      setBackendReservationError('');

      try {
        const loadedReservation = await reservationsApi.get(
          backendReservationId,
        );

        if (!isMounted) {
          return;
        }

        setBackendReservation(loadedReservation);
        setCurrentStatus(loadedReservation.state as ReservationStatus);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setBackendReservationError(
          error instanceof Error && error.message.trim()
            ? error.message
            : 'Unable to load this reservation from the backend.',
        );
      } finally {
        if (isMounted) {
          setIsLoadingBackendReservation(false);
        }
      }
    }

    void loadBackendReservation();

    return () => {
      isMounted = false;
    };
  }, [reservation, reservationId]);

  const handleStatusChange = (
    nextStatus: ReservationStatus,
    message: string,
  ) => {
    setCurrentStatus(nextStatus);
    setActionMessage(message);
    setReturnErrorMessage('');
  };

  /**
   * Issue #47 Confirm Tool Return.
   *
   * Calls the real backend mark-returned endpoint and updates this page from
   * the returned reservation state.
   */
  async function handleConfirmReturn() {
    setActionMessage('');
    setReturnErrorMessage('');

    const activeReservationId = reservation?.id ?? backendReservation?.id;

    if (!activeReservationId) {
      setReturnErrorMessage('Reservation not found.');
      return;
    }

    const isFrontendMockReservation =
      activeReservationId.startsWith('reservation-');

    if (isFrontendMockReservation) {
      handleStatusChange(
        'RETURNED',
        'Mock return confirmed. Status changed to RETURNED.',
      );
      return;
    }

    setIsConfirmingReturn(true);

    try {
      const updatedReservation = await reservationsApi.markReturned(
        activeReservationId,
      );

      setBackendReservation(updatedReservation);
      setCurrentStatus(updatedReservation.state as ReservationStatus);
      setActionMessage(
        updatedReservation.returned_at
          ? 'Return confirmed. Status changed to RETURNED and return timestamp was saved.'
          : 'Return confirmed. Status changed to RETURNED.',
      );
    } catch (error) {
      setReturnErrorMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Unable to confirm return. Please try again.',
      );
    } finally {
      setIsConfirmingReturn(false);
    }
  }

  const displayReservation: ReservationDisplay | null = reservation
    ? {
        id: reservation.id,
        toolId: reservation.toolId,
        toolName: reservation.toolName,
        borrowerName: reservation.borrowerName,
        ownerName: reservation.ownerName,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        role: reservation.role,
        message: reservation.message,
      }
    : backendReservation
      ? normalizeBackendReservation(backendReservation)
      : null;

  if (isLoadingBackendReservation) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Reservation Detail</p>
          <h1>Loading reservation</h1>
          <p>Loading this reservation from the backend...</p>
        </div>
      </section>
    );
  }

  if (!displayReservation) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Reservation Not Found</p>
          <h1>We could not find this reservation.</h1>
          <p>
            {backendReservationError ||
              'The selected reservation may not exist in the current mock data or backend.'}
          </p>
          <Link className="primary-link narrow-link" to="/reservations">
            Back to Reservations
          </Link>
        </div>
      </section>
    );
  }

  const isBorrower = displayReservation.role === 'borrower';
  const isOwner = displayReservation.role === 'owner';

  const autoCancelInfo = reservation
    ? getPickupAutoCancelInfo(reservation, currentStatus)
    : null;

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reservation Detail</p>
          <h1>{displayReservation.toolName}</h1>
          <p className="page-description">
            Review this reservation and test workflow actions for borrower and
            owner roles.
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
              <h2>{displayReservation.toolName}</h2>
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
              <dd>{displayReservation.borrowerName}</dd>
            </div>

            <div>
              <dt>Owner</dt>
              <dd>{displayReservation.ownerName}</dd>
            </div>

            <div>
              <dt>Start Date</dt>
              <dd>{displayReservation.startDate}</dd>
            </div>

            <div>
              <dt>End Date</dt>
              <dd>{displayReservation.endDate}</dd>
            </div>

            <div>
              <dt>Your Demo Role</dt>
              <dd>{isOwner ? 'Owner' : 'Borrower'}</dd>
            </div>

            <div>
              <dt>Tool Link</dt>
              <dd>
                <Link to={`/tools/${displayReservation.toolId}`}>
                  View Tool Detail
                </Link>
              </dd>
            </div>
          </dl>

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
                <li>
                  Reservation start date: {displayReservation.startDate}
                </li>
                <li>
                  Pickup grace deadline: {autoCancelInfo.graceDeadline} HST
                </li>
                <li>
                  Auto-cancel evaluation date: {autoCancelInfo.autoCancelDate}{' '}
                  HST
                </li>
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

          {displayReservation.message && (
            <div className="info-panel">
              <h3>Request Message</h3>
              <p>{displayReservation.message}</p>
            </div>
          )}

          {actionMessage && (
            <div className="success-message" role="status">
              {actionMessage}
            </div>
          )}

          {returnErrorMessage && (
            <p className="form-error" role="alert">
              {returnErrorMessage}
            </p>
          )}
        </article>

        <aside className="workflow-actions-card">
          <p className="eyebrow">Workflow Actions</p>
          <h2>Available Actions</h2>
          <p>
            Confirm Return calls the backend for real reservations. The other
            workflow buttons remain mock frontend actions for the demo.
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

            {currentStatus === 'PICKED_UP' && isBorrower && (
              <button
                type="button"
                className="action-button approve-button"
                onClick={() => void handleConfirmReturn()}
                disabled={isConfirmingReturn}
              >
                {isConfirmingReturn
                  ? 'Confirming Return...'
                  : 'Confirm Return'}
              </button>
            )}

            {currentStatus === 'RETURNED' && (
              <Link
                className="action-button approve-button workflow-review-link"
                to={`/reservations/${displayReservation.id}/review`}
              >
                Leave Review
              </Link>
            )}

            {(currentStatus === 'DENIED' || currentStatus === 'CANCELLED') && (
              <p className="closed-workflow-message">
                This reservation is closed. No further action is available.
              </p>
            )}
          </div>

          <div className="workflow-note">
            <h3>Stories covered</h3>
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
