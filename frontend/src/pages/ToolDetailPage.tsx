import { useMemo, useState } from 'react';

import type { FormEvent } from 'react';

import { Link, useParams } from 'react-router-dom';

import {
  categoryLabels,
  mockReservations,
  mockTools,
  type MockReservation,
  type ReservationStatus,
} from '../data/mockData';
import { formatRating } from '../utils/formatRating';

/**
 * Active reservation statuses that should block new overlapping reservation requests.
 *
 * Backend/database will later enforce this with real availability logic
 * and possibly a 409 Conflict response.
 */
const activeReservationStatuses: ReservationStatus[] = [
  'REQUESTED',
  'APPROVED',
  'PICKED_UP',
];

/**
 * datesOverlap
 *
 * Checks whether two YYYY-MM-DD date ranges overlap.
 *
 * Example:
 * Existing: 2026-07-01 to 2026-07-03
 * Requested: 2026-07-02 to 2026-07-04
 * Result: true
 *
 * This is frontend-only mock conflict detection for Task 5.
 */
function datesOverlap(
  requestedStartDate: string,
  requestedEndDate: string,
  existingStartDate: string,
  existingEndDate: string,
) {
  return (
    requestedStartDate <= existingEndDate &&
    requestedEndDate >= existingStartDate
  );
}

/**
 * formatStatus
 *
 * Converts backend-style reservation status values into readable text.
 *
 * Example:
 * PICKED_UP -> PICKED UP
 */
function formatStatus(status: ReservationStatus) {
  return status.replace('_', ' ');
}

/**
 * ToolDetailPage
 *
 * This page shows:
 * - Tool details.
 * - Owner and availability information.
 * - Reservation request form.
 * - HST date/time labels.
 * - Mock frontend reservation date-conflict detection.
 *
 * Task 5 frontend behavior:
 * - Reservation request dates are clearly labeled as HST.
 * - Date range is checked against tool availability.
 * - Requested dates are checked against active mock reservations.
 * - If there is a conflict, show a backend-ready conflict message:
 *   "Tool is not available for those dates. Please choose another date range."
 *
 * Important:
 * - This is frontend-only mock behavior.
 * - Real backend will later perform final conflict detection and return 409 Conflict.
 */
function ToolDetailPage() {
  // Read the toolId from the route path: /tools/:toolId
  const { toolId } = useParams();

  // Find the matching tool from mock data.
  const tool = mockTools.find((mockTool) => mockTool.id === toolId);

  // Local form state for the mock reservation request form.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [requestNote, setRequestNote] = useState('');

  // Separate message states make success and error display clearer.
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * Active reservations for this tool.
   *
   * These are used for the frontend conflict demo.
   * Backend/database will later be the final authority.
   */
  const activeReservationsForTool = useMemo(() => {
    return mockReservations.filter(
      (reservation) =>
        reservation.toolId === toolId &&
        activeReservationStatuses.includes(reservation.status),
    );
  }, [toolId]);

  /**
   * Finds the first active reservation that conflicts with the requested dates.
   */
  function findConflictingReservation(
    requestedStartDate: string,
    requestedEndDate: string,
  ) {
    return activeReservationsForTool.find((reservation) =>
      datesOverlap(
        requestedStartDate,
        requestedEndDate,
        reservation.startDate,
        reservation.endDate,
      ),
    );
  }

  /**
   * Handles the mock reservation request form.
   *
   * This does not create a real backend reservation yet.
   * It only shows success/error messages so the R1 demo can show:
   *
   * Browse Tool -> View Details -> Submit Reservation Request.
   */
  const handleReservationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Clear old messages before validating the new request.
    setSuccessMessage('');
    setErrorMessage('');

    if (!tool) {
      setErrorMessage('Tool not found. Please return to Browse Tools.');
      return;
    }

    // Basic frontend validation for the mock demo.
    if (!startDate || !endDate) {
      setErrorMessage('Please select both a start date and an end date.');
      return;
    }

    if (endDate < startDate) {
      setErrorMessage('End date cannot be before start date.');
      return;
    }

    // HST/date availability validation.
    if (startDate < tool.availableFrom || endDate > tool.availableTo) {
      setErrorMessage(
        `Selected dates must be within the tool availability window: ${tool.availableFrom} to ${tool.availableTo} HST.`,
      );
      return;
    }

    // Task 5 conflict-message validation.
    const conflictingReservation = findConflictingReservation(startDate, endDate);

    if (conflictingReservation) {
      setErrorMessage(
        `Tool is not available for those dates. Please choose another date range. Conflict: ${conflictingReservation.startDate} to ${conflictingReservation.endDate} HST, status ${formatStatus(conflictingReservation.status)}. Future backend response: 409 Conflict.`,
      );
      return;
    }

    setSuccessMessage(
      `Mock request submitted for ${tool.name} from ${startDate} to ${endDate} HST. Status: REQUESTED.`,
    );
  };

  /**
   * Friendly error page if the URL has an invalid toolId.
   */
  if (!tool) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Tool Not Found</p>
          <h1>We could not find this tool.</h1>
          <p>The selected tool may not exist in the current mock data.</p>

          <Link className="primary-link narrow-link" to="/tools">
            Back to Browse Tools
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      {/* Page header */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Tool Detail</p>
          <h1>{tool.name}</h1>
          <p className="page-description">
            Review the tool information, owner notes, availability, and submit a
            mock reservation request using Hawaii Standard Time (HST) dates.
          </p>
        </div>

        {/* Tool management actions */}
        <div className="page-header-actions">
          <Link className="primary-link" to={`/tools/${tool.id}/edit`}>
            Edit Tool Listing
          </Link>

          <Link className="secondary-link" to="/tools">
            Back to Browse Tools
          </Link>
        </div>
      </div>

      {/* Main detail layout */}
      <div className="tool-detail-layout">
        {/* Left side: tool detail card */}
        <article className="tool-detail-card">
          <img
            className="tool-detail-image"
            src={tool.imageUrl}
            alt={tool.name}
          />

          <div className="tool-detail-content">
            <div className="tool-detail-title-row">
              <span className="tool-category-badge">
                {categoryLabels[tool.category]}
              </span>

              <span className="tool-rating">Rating: {formatRating(tool.rating)}/5</span>
            </div>

            <h2>{tool.name}</h2>
            <p>{tool.description}</p>

            {/* Tool metadata */}
            <dl className="tool-detail-meta-grid">
              <div>
                <dt>Owner</dt>
                <dd>{tool.ownerName}</dd>
              </div>

              <div>
                <dt>Condition</dt>
                <dd>{tool.condition}</dd>
              </div>

              <div>
                <dt>Availability Dates</dt>
                <dd>
                  {tool.availableFrom} to {tool.availableTo} HST
                </dd>
              </div>

              <div>
                <dt>Latest Return Time</dt>
                <dd>{tool.latestReturnTime} HST</dd>
              </div>
            </dl>

            {/* Owner notes */}
            <section className="info-panel">
              <h3>Owner Notes</h3>
              <p>{tool.notesForBorrowers}</p>
            </section>

            {/* HST explanation */}
            <section className="hst-helper-panel">
              <strong>HST date/time rule</strong>
              <p>
                All availability dates, reservation dates, and latest return
                times on this page are interpreted in Hawaii Standard Time (HST).
              </p>
            </section>
          </div>
        </article>

        {/* Right side: reservation request form for borrower workflow */}
        <aside className="reservation-request-card">
          <p className="eyebrow">Reservation Request</p>
          <h2>Request this tool</h2>
          <p>
            Select your desired borrowing dates. For this R1 frontend demo, the
            form shows the planned REQUESTED workflow using mock data.
          </p>

          {/* Backend-ready conflict explanation */}
          <section className="reservation-conflict-info-panel">
            <strong>Conflict check</strong>
            <p>
              If the selected dates overlap an active reservation, the frontend
              shows the same type of message expected from a future backend
              <code> 409 Conflict </code> response.
            </p>
          </section>

          <form className="reservation-form" onSubmit={handleReservationSubmit}>
            <label htmlFor="reservation-start-date">
              Start Date (HST)
              <input
                id="reservation-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </label>

            <label htmlFor="reservation-end-date">
              End Date (HST)
              <input
                id="reservation-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </label>

            <label htmlFor="reservation-note">
              Message to Owner
              <textarea
                id="reservation-note"
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value)}
                placeholder="Optional note for the tool owner"
                rows={4}
              />
            </label>

            <p className="hst-note">
              All reservation dates are interpreted in Hawaii Standard Time
              (HST). Please choose dates between {tool.availableFrom} and{' '}
              {tool.availableTo} HST.
            </p>

            {/* Active reservation preview for conflict testing. */}
            {activeReservationsForTool.length > 0 && (
              <section className="active-date-conflict-list">
                <strong>Current active reservations for this tool</strong>

                <ul>
                  {activeReservationsForTool.map(
                    (reservation: MockReservation) => (
                      <li key={reservation.id}>
                        {reservation.startDate} to {reservation.endDate} HST —{' '}
                        {formatStatus(reservation.status)}
                      </li>
                    ),
                  )}
                </ul>
              </section>
            )}

            {/* Error and success messages */}
            {errorMessage && <p className="form-error">{errorMessage}</p>}
            {successMessage && <p className="success-message">{successMessage}</p>}

            <button type="submit">Submit Reservation Request</button>
          </form>
        </aside>
      </div>
    </section>
  );
}

export default ToolDetailPage;