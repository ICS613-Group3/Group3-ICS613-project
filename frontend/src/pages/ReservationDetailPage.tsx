import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { reservationsApi } from '../api/reservations';
import { toolsApi } from '../api/tools';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';
import type { ReservationResponse, ReservationState, ToolResponse } from '../types/api';

function formatStatus(status: ReservationState): string {
  return status.replace('_', ' ');
}

function ReservationDetailPage() {
  const { reservationId } = useParams();
  const { user } = useAuth();
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);
  const [tool, setTool] = useState<ToolResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [denyReason, setDenyReason] = useState('');

  const loadReservation = useCallback(async () => {
    if (!reservationId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await reservationsApi.get(reservationId);
      setReservation(res);
      try {
        const t = await toolsApi.get(res.tool_id);
        setTool(t);
      } catch {
        // Tool fetch is non-critical.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reservation not found');
    } finally {
      setIsLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReservation();
  }, [loadReservation]);

  const handleAction = async (
    action: () => Promise<ReservationResponse>,
    message: string,
  ) => {
    setIsActing(true);
    setActionMessage('');
    try {
      const updated = await action();
      setReservation(updated);
      setActionMessage(message);
    } catch (err) {
      setActionMessage(
        err instanceof ApiRequestError ? err.detail : 'Action failed',
      );
    } finally {
      setIsActing(false);
    }
  };

  const isBorrower = user && reservation && user.id === reservation.borrower_id;
  const isToolOwner = user && tool && user.id === tool.owner_id;

  if (isLoading) {
    return (
      <section className="page-section">
        <div className="page-header"><h1>Loading...</h1></div>
      </section>
    );
  }

  if (!reservation || error) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Reservation Not Found</p>
          <h1>We could not find this reservation.</h1>
          <p>{error || 'The selected reservation may not exist.'}</p>
          <Link className="primary-link narrow-link" to="/reservations">
            Back to Reservations
          </Link>
        </div>
      </section>
    );
  }

  const state = reservation.state;

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reservation Detail</p>
          <h1>{tool?.name || `Tool ${reservation.tool_id.slice(0, 8)}`}</h1>
          <p className="page-description">
            Review this reservation and manage its workflow.
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
                {isBorrower ? 'Borrower View' : isToolOwner ? 'Owner View' : 'View'}
              </p>
              <h2>{tool?.name || 'Tool'}</h2>
            </div>
            <span className={`workflow-status status-${state.toLowerCase()}`}>
              {formatStatus(state)}
            </span>
          </div>

          <dl className="reservation-meta-grid detail-meta-grid">
            <div>
              <dt>Tool</dt>
              <dd>
                {tool ? (
                  <Link to={`/tools/${reservation.tool_id}`}>{tool.name}</Link>
                ) : (
                  reservation.tool_id.slice(0, 8)
                )}
              </dd>
            </div>
            <div>
              <dt>Start Date</dt>
              <dd>{reservation.start_date}</dd>
            </div>
            <div>
              <dt>End Date</dt>
              <dd>{reservation.end_date}</dd>
            </div>
            {reservation.picked_up_at && (
              <div>
                <dt>Picked Up</dt>
                <dd>{new Date(reservation.picked_up_at).toLocaleString()}</dd>
              </div>
            )}
            {reservation.returned_at && (
              <div>
                <dt>Returned</dt>
                <dd>{new Date(reservation.returned_at).toLocaleString()}</dd>
              </div>
            )}
            {reservation.denied_reason && (
              <div>
                <dt>Denial Reason</dt>
                <dd>{reservation.denied_reason}</dd>
              </div>
            )}
            {reservation.cancelled_reason && (
              <div>
                <dt>Cancellation Reason</dt>
                <dd>{reservation.cancelled_reason}</dd>
              </div>
            )}
          </dl>

          {actionMessage && (
            <p className={actionMessage.includes('failed') || actionMessage.includes('error') ? 'form-error' : 'success-message'}>
              {actionMessage}
            </p>
          )}
        </article>

        <aside className="workflow-actions-card">
          <p className="eyebrow">Workflow Actions</p>
          <h2>Available Actions</h2>

          <div className="workflow-action-list">
            {/* Owner: approve/deny REQUESTED */}
            {state === 'REQUESTED' && isToolOwner && (
              <>
                <button
                  type="button"
                  className="action-button approve-button"
                  disabled={isActing}
                  onClick={() =>
                    handleAction(
                      () => reservationsApi.approve(reservation.id),
                      'Reservation approved.',
                    )
                  }
                >
                  Approve Request
                </button>

                <label htmlFor="deny-reason" style={{ display: 'block', marginTop: '0.5rem' }}>
                  Denial reason (optional):
                  <input
                    id="deny-reason"
                    type="text"
                    value={denyReason}
                    onChange={(e) => setDenyReason(e.target.value)}
                    placeholder="Reason for denial"
                  />
                </label>
                <button
                  type="button"
                  className="action-button danger-button"
                  disabled={isActing}
                  onClick={() =>
                    handleAction(
                      () => reservationsApi.deny(reservation.id, { reason: denyReason || undefined }),
                      'Reservation denied.',
                    )
                  }
                >
                  Deny Request
                </button>
              </>
            )}

            {/* Borrower: cancel REQUESTED */}
            {state === 'REQUESTED' && isBorrower && (
              <>
                <label htmlFor="cancel-reason" style={{ display: 'block', marginTop: '0.5rem' }}>
                  Cancellation reason:
                  <input
                    id="cancel-reason"
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancellation"
                    required
                  />
                </label>
                <button
                  type="button"
                  className="action-button danger-button"
                  disabled={isActing || !cancelReason.trim()}
                  onClick={() =>
                    handleAction(
                      () => reservationsApi.cancel(reservation.id, { reason: cancelReason }),
                      'Request cancelled.',
                    )
                  }
                >
                  Cancel Request
                </button>
              </>
            )}

            {/* Borrower: mark-picked-up APPROVED */}
            {state === 'APPROVED' && isBorrower && (
              <button
                type="button"
                className="action-button approve-button"
                disabled={isActing}
                onClick={() =>
                  handleAction(
                    () => reservationsApi.markPickedUp(reservation.id),
                    'Pickup confirmed.',
                  )
                }
              >
                Confirm Pickup
              </button>
            )}

            {/* Borrower: cancel APPROVED */}
            {state === 'APPROVED' && isBorrower && (
              <>
                <label htmlFor="cancel-reason2" style={{ display: 'block', marginTop: '0.5rem' }}>
                  Cancellation reason:
                  <input
                    id="cancel-reason2"
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancellation"
                    required
                  />
                </label>
                <button
                  type="button"
                  className="action-button danger-button"
                  disabled={isActing || !cancelReason.trim()}
                  onClick={() =>
                    handleAction(
                      () => reservationsApi.cancel(reservation.id, { reason: cancelReason }),
                      'Reservation cancelled.',
                    )
                  }
                >
                  Cancel Reservation
                </button>
              </>
            )}

            {/* Owner: cancel APPROVED */}
            {state === 'APPROVED' && isToolOwner && (
              <>
                <label htmlFor="cancel-reason-owner" style={{ display: 'block', marginTop: '0.5rem' }}>
                  Cancellation reason:
                  <input
                    id="cancel-reason-owner"
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancellation"
                    required
                  />
                </label>
                <button
                  type="button"
                  className="action-button danger-button"
                  disabled={isActing || !cancelReason.trim()}
                  onClick={() =>
                    handleAction(
                      () => reservationsApi.cancel(reservation.id, { reason: cancelReason }),
                      'Reservation cancelled by owner.',
                    )
                  }
                >
                  Cancel Reservation
                </button>
              </>
            )}

            {/* Borrower: mark-returned PICKED_UP */}
            {state === 'PICKED_UP' && isBorrower && (
              <button
                type="button"
                className="action-button approve-button"
                disabled={isActing}
                onClick={() =>
                  handleAction(
                    () => reservationsApi.markReturned(reservation.id),
                    'Return confirmed.',
                  )
                }
              >
                Confirm Return
              </button>
            )}

            {/* RETURNED: leave review */}
            {state === 'RETURNED' && isBorrower && (
              <Link
                className="action-button approve-button workflow-review-link"
                to={`/reservations/${reservation.id}/review`}
              >
                Leave Review
              </Link>
            )}

            {/* Closed states */}
            {(state === 'DENIED' || state === 'CANCELLED') && (
              <p className="closed-workflow-message">
                This reservation is closed. No further action is available.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

export default ReservationDetailPage;
