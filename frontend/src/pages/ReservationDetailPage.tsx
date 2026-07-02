import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ApiError,
  reservationsApi,
  type Reservation,
  type ReservationState,
} from '../api/client';
import { useAuth } from '../context/authContextValue';

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

/**
 * ReservationDetailPage
 *
 * Real backend detail via ``GET /reservations/{id}`` plus the
 * state-transition endpoints:
 *   - POST /reservations/{id}/approve
 *   - POST /reservations/{id}/deny        (optional reason)
 *   - POST /reservations/{id}/cancel      (required reason)
 *   - POST /reservations/{id}/mark-picked-up
 *   - POST /reservations/{id}/mark-returned
 *
 * The buttons shown are restricted by both reservation state AND the
 * caller's role (borrower vs owner), mirroring the backend's auth
 * rules. The backend still enforces everything; this is just UX.
 */
function ReservationDetailPage() {
  const { reservationId } = useParams();
  const { user } = useAuth();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (!reservationId) return;
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage('');
    reservationsApi
      .get(reservationId)
      .then((r) => {
        if (!cancelled) setReservation(r);
      })
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof ApiError) setErrorMessage(err.message);
          else setErrorMessage('Failed to load reservation.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  if (isLoading) {
    return (
      <section className="page-section">
        <p>Loading reservation…</p>
      </section>
    );
  }

  if (!reservation) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Reservation Not Found</p>
          <h1>We could not find this reservation.</h1>
          <p>{errorMessage || 'It may have been deleted or you may not be a party to it.'}</p>
          <Link className="primary-link narrow-link" to="/reservations">
            Back to Reservations
          </Link>
        </div>
      </section>
    );
  }

  const isBorrower = user?.id === reservation.borrower_id;
  const isOwner = !isBorrower; // The backend only returns reservations the
  // user is a party to, so if you're not the borrower you're the owner.

  const callAction = async (
    label: string,
    fn: () => Promise<Reservation>,
  ) => {
    setActionMessage('');
    setErrorMessage('');
    setIsActing(true);
    try {
      const updated = await fn();
      setReservation(updated);
      setActionMessage(`${label} — status is now ${updated.state}.`);
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage(`${label} failed.`);
    } finally {
      setIsActing(false);
    }
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reservation Detail</p>
          <h1>Reservation #{reservation.id.slice(0, 8)}</h1>
          <p className="page-description">
            Review this reservation and take action if you are a party to it.
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
              <h2>Tool #{reservation.tool_id.slice(0, 8)}</h2>
            </div>

            <span
              className={`workflow-status status-${reservation.state.toLowerCase()}`}
            >
              {formatStatus(reservation.state)}
            </span>
          </div>

          {isOverdue(reservation) && (
            <p className="overdue-banner" role="alert">
              ⚠ Overdue — the end date ({reservation.end_date}) has passed.
              Please return the tool as soon as possible.
            </p>
          )}

          <dl className="reservation-meta-grid detail-meta-grid">
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
                {reservation.borrower_id === user?.id
                  ? 'You'
                  : `User #${reservation.borrower_id.slice(0, 8)}`}
              </dd>
            </div>

            <div>
              <dt>Your Role</dt>
              <dd>{isOwner ? 'Owner' : 'Borrower'}</dd>
            </div>

            <div>
              <dt>Tool</dt>
              <dd>
                <Link to={`/tools/${reservation.tool_id}`}>
                  View Tool Detail
                </Link>
              </dd>
            </div>

            {reservation.denied_reason && (
              <div>
                <dt>Deny reason</dt>
                <dd>{reservation.denied_reason}</dd>
              </div>
            )}

            {reservation.cancelled_reason && (
              <div>
                <dt>Cancel reason</dt>
                <dd>{reservation.cancelled_reason}</dd>
              </div>
            )}

            {reservation.damage_reported && (
              <div>
                <dt>Damage report</dt>
                <dd>
                  Reported
                  {reservation.damage_description
                    ? `: ${reservation.damage_description}`
                    : ''}
                </dd>
              </div>
            )}
          </dl>

          {actionMessage && (
            <div className="success-message" role="status">
              {actionMessage}
            </div>
          )}
          {errorMessage && (
            <p className="error-message" role="alert">
              {errorMessage}
            </p>
          )}
        </article>

        <aside className="workflow-actions-card">
          <p className="eyebrow">Workflow Actions</p>
          <h2>Available Actions</h2>

          {/* Owner actions on REQUESTED */}
          {reservation.state === 'REQUESTED' && isOwner && (
            <>
              <button
                type="button"
                className="action-button approve-button"
                disabled={isActing}
                onClick={() =>
                  callAction('Reservation approved', () =>
                    reservationsApi.approve(reservation.id),
                  )
                }
              >
                Approve Request
              </button>

              <div className="action-group">
                <label>
                  Deny reason (optional)
                  <input
                    type="text"
                    value={denyReason}
                    onChange={(event) => setDenyReason(event.target.value)}
                    maxLength={2000}
                  />
                </label>
                <button
                  type="button"
                  className="action-button danger-button"
                  disabled={isActing}
                  onClick={() =>
                    callAction('Reservation denied', () =>
                      reservationsApi.deny(
                        reservation.id,
                        denyReason.trim() || undefined,
                      ),
                    )
                  }
                >
                  Deny Request
                </button>
              </div>
            </>
          )}

          {/* Borrower cancel on REQUESTED */}
          {reservation.state === 'REQUESTED' && isBorrower && (
            <div className="action-group">
              <label>
                Cancel reason (required)
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  minLength={1}
                  maxLength={2000}
                  required
                />
              </label>
              <button
                type="button"
                className="action-button danger-button"
                disabled={isActing || !cancelReason.trim()}
                onClick={() =>
                  callAction('Request cancelled', () =>
                    reservationsApi.cancel(reservation.id, cancelReason.trim()),
                  )
                }
              >
                Cancel Request
              </button>
            </div>
          )}

          {/* Borrower confirm pickup / cancel on APPROVED */}
          {reservation.state === 'APPROVED' && isBorrower && (
            <>
              <button
                type="button"
                className="action-button approve-button"
                disabled={isActing}
                onClick={() =>
                  callAction('Pickup confirmed', () =>
                    reservationsApi.markPickedUp(reservation.id),
                  )
                }
              >
                Confirm Pickup
              </button>

              <div className="action-group">
                <label>
                  Cancel reason (required)
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    minLength={1}
                    maxLength={2000}
                    required
                  />
                </label>
                <button
                  type="button"
                  className="action-button danger-button"
                  disabled={isActing || !cancelReason.trim()}
                  onClick={() =>
                    callAction('Reservation cancelled', () =>
                      reservationsApi.cancel(
                        reservation.id,
                        cancelReason.trim(),
                      ),
                    )
                  }
                >
                  Cancel Before Pickup
                </button>
              </div>
            </>
          )}

          {/* Owner cancel on APPROVED */}
          {reservation.state === 'APPROVED' && isOwner && (
            <div className="action-group">
              <label>
                Cancel reason (required)
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  minLength={1}
                  maxLength={2000}
                  required
                />
              </label>
              <button
                type="button"
                className="action-button danger-button"
                disabled={isActing || !cancelReason.trim()}
                onClick={() =>
                  callAction('Owner cancelled the reservation', () =>
                    reservationsApi.cancel(reservation.id, cancelReason.trim()),
                  )
                }
              >
                Cancel Reservation
              </button>
            </div>
          )}

          {/* Borrower confirm return on PICKED_UP */}
          {reservation.state === 'PICKED_UP' && isBorrower && (
            <>
              {isOverdue(reservation) && (
                <p className="overdue-warning-text">
                  This tool is past its due date. Returning it late may affect your trust score.
                </p>
              )}
              <button
                type="button"
                className={`action-button ${isOverdue(reservation) ? 'danger-button' : 'approve-button'}`}
                disabled={isActing}
                onClick={() =>
                  callAction('Return confirmed', () =>
                    reservationsApi.markReturned(reservation.id),
                  )
                }
              >
                {isOverdue(reservation) ? 'Confirm Late Return' : 'Confirm Return'}
              </button>
            </>
          )}

          {/* RETURNED → review CTA + damage report (owner only, 7-day window) */}
          {reservation.state === 'RETURNED' && (
            <>
              <DamageReportForm
                reservation={reservation}
                isOwner={isOwner}
                onDone={setReservation}
              />
              <Link
                className="action-button approve-button"
                to={`/reservations/${reservation.id}/review`}
              >
                Leave a Review
              </Link>
            </>
          )}

          {/* Admin can force-return a PICKED_UP reservation */}
          {reservation.state === 'PICKED_UP' && user?.is_admin && (
            <AdminForceReturnForm
              reservation={reservation}
              onDone={setReservation}
            />
          )}

          {(reservation.state === 'DENIED' || reservation.state === 'CANCELLED') && (
            <p className="closed-workflow-message">
              This reservation is closed. No further action is available.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

/**
 * DamageReportForm
 *
 * US20 — owner-only. Backend allows a damage report on a RETURNED
 * reservation within 7 days of return. We gate on the client too for
 * UX; the backend is the source of truth.
 */
function DamageReportForm({
  reservation,
  isOwner,
  onDone,
}: {
  reservation: Reservation;
  isOwner: boolean;
  onDone: (r: Reservation) => void;
}) {
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOwner) return null;
  if (reservation.damage_reported) {
    return (
      <p className="info-banner">
        Damage already reported
        {reservation.damage_description ? `: ${reservation.damage_description}` : ''}
      </p>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (description.trim().length < 1) {
      setError('Describe the damage.');
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await reservationsApi.markDamaged(
        reservation.id,
        description.trim(),
      );
      onDone(updated);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to report damage.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="damage-report-form">
      <h3>Report damage</h3>
      <p className="helper-text">
        Owners can report damage to a returned tool within 7 days of
        return. Reporting damage deactivates the tool and notifies the
        borrower.
      </p>
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="What was damaged and how?"
        disabled={isSubmitting || success}
      />
      <button
        type="submit"
        className="action-button danger-button"
        disabled={isSubmitting || success}
      >
        {success ? 'Reported' : isSubmitting ? 'Reporting…' : 'Report damage'}
      </button>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * AdminForceReturnForm
 *
 * Admin-only escape hatch to force-return a PICKED_UP reservation. The
 * backend's ``POST /reservations/{id}/admin-force-return`` endpoint
 * requires ``is_admin`` and a reason (audit-logged).
 */
function AdminForceReturnForm({
  reservation,
  onDone,
}: {
  reservation: Reservation;
  onDone: (r: Reservation) => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (reason.trim().length < 1) {
      setError('A reason is required (audit-logged).');
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await reservationsApi.adminForceReturn(
        reservation.id,
        reason.trim(),
      );
      onDone(updated);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to force-return reservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-force-return-form">
      <h3>Admin: force-return</h3>
      <p className="helper-text">
        Force-mark this PICKED_UP reservation as returned. The borrower
        is notified and the tool is released. Audit-logged.
      </p>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Reason (required)"
        disabled={isSubmitting}
      />
      <button
        type="submit"
        className="action-button danger-button"
        disabled={isSubmitting || !reason.trim()}
      >
        {isSubmitting ? 'Forcing return…' : 'Force-return'}
      </button>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export default ReservationDetailPage;
