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

// Mock logged-in member used by the current frontend demo.
// Replace this with authenticated user data during real API integration.
const currentMockUserId = 'user-1';

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

  // Owners cannot submit reservation requests for their own listings.
  const isCurrentUserOwner = tool?.ownerId === currentMockUserId;

  // Local form state for the mock reservation request form.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [requestNote, setRequestNote] = useState('');

  // Separate message states make success and error display clearer.
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Issue #53 report workflow state.
  // The current Tool Detail page uses mock data, so the pending-report state
  // remains local until the backend Report model and endpoint are available.
  const [isReportFormOpen, setIsReportFormOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportComment, setReportComment] = useState('');
  const [reportErrorMessage, setReportErrorMessage] = useState('');
  const [reportSuccessMessage, setReportSuccessMessage] = useState('');
  const [hasPendingReport, setHasPendingReport] = useState(false);

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

    if (isCurrentUserOwner) {
      setErrorMessage('You cannot request a reservation for your own tool.');
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
        `This tool is not available for the selected dates. Please choose another date range. The conflicting reservation is ${conflictingReservation.startDate} to ${conflictingReservation.endDate} HST.`,
      );
      return;
    }

    setSuccessMessage(
      `Mock request submitted for ${tool.name} from ${startDate} to ${endDate} HST. Status: REQUESTED.`,
    );
  };

  /**
   * Issue #53 report workflow.
   *
   * This performs frontend validation and demonstrates the required
   * PENDING_REVIEW workflow with local state. A real API request cannot be
   * added safely until the backend defines its Report schema and endpoint.
   */
  const handleReportSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setReportErrorMessage('');
    setReportSuccessMessage('');

    if (!tool) {
      setReportErrorMessage('This listing is not available for reporting.');
      return;
    }

    if (hasPendingReport) {
      setReportErrorMessage(
        'This listing has already been reported and is waiting for an admin review.',
      );
      return;
    }

    if (!reportReason) {
      setReportErrorMessage('A report reason is required.');
      return;
    }

    setHasPendingReport(true);
    setIsReportFormOpen(false);
    setReportSuccessMessage(
      'Report submitted. Status: PENDING_REVIEW. An admin will review this listing.',
    );
    setReportReason('');
    setReportComment('');
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
          <p>
        This listing is not available for reporting. It may not exist, be
        deactivated, or belong to a deleted account.
      </p>

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

      {reportSuccessMessage && (
        <p
          className="success-message report-status-message"
          role="status"
          aria-live="polite"
        >
          {reportSuccessMessage}
        </p>
      )}

      {hasPendingReport && (
        <section
          className="pending-report-message"
          aria-label="Pending listing report"
        >
          <strong>Report pending review</strong>
          <p>
            This listing has already been reported and is waiting for an admin
            review.
          </p>
        </section>
      )}

      {isReportFormOpen && !hasPendingReport && (
        <section
          className="listing-report-card"
          aria-labelledby="listing-report-heading"
        >
          <p className="eyebrow">Community Safety</p>
          <h2 id="listing-report-heading">Report this listing</h2>
          <p>
            Tell the admin team why this listing may be inappropriate, unsafe,
            or against community rules.
          </p>

          <form
            className="listing-report-form"
            onSubmit={handleReportSubmit}
            noValidate
          >
            <label htmlFor="listing-report-reason">
              Report Reason
              <select
                id="listing-report-reason"
                value={reportReason}
                onChange={(event) => {
                  setReportReason(event.target.value);
                  setReportErrorMessage('');
                }}
                required
              >
                <option value="">Select a report reason</option>
                <option value="Unsafe tool or condition">
                  Unsafe tool or condition
                </option>
                <option value="Inappropriate listing content">
                  Inappropriate listing content
                </option>
                <option value="Misleading listing information">
                  Misleading listing information
                </option>
                <option value="Violates community rules">
                  Violates community rules
                </option>
                <option value="Other concern">Other concern</option>
              </select>
            </label>

            <label htmlFor="listing-report-comment">
              Additional Comment
              <textarea
                id="listing-report-comment"
                value={reportComment}
                onChange={(event) => setReportComment(event.target.value)}
                placeholder="Optional details that may help the admin review the listing"
                rows={5}
              />
            </label>

            <p className="report-form-help">
              The reason is required. The additional comment is optional.
            </p>

            {reportErrorMessage && (
              <p className="form-error" role="alert">
                {reportErrorMessage}
              </p>
            )}

            <div className="report-form-actions">
              <button type="submit" className="report-submit-button">
                Submit Report
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setIsReportFormOpen(false);
                  setReportReason('');
                  setReportComment('');
                  setReportErrorMessage('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

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

              <span className="tool-rating">Rating: {tool.rating}/5</span>
            </div>

            <h2>{tool.name}</h2>
            <p>{tool.description}</p>

            {/* Tool metadata */}
            <dl className="tool-detail-meta-grid">
              <div>
                <dt>Owner</dt>
                <dd>
                  <Link
                    className="public-profile-reviewer-link"
                    to={`/members/${tool.ownerId}`}
                  >
                    {tool.ownerName}
                  </Link>
                </dd>
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

          {isCurrentUserOwner && (
            <p className="form-error">
              You cannot request a reservation for your own tool.
            </p>
          )}

          {/* Backend-ready conflict explanation */}
          <section className="reservation-conflict-info-panel">
            <strong>Conflict check</strong>
            <p>
              If the selected dates overlap an active reservation, you will be
              asked to choose another date range.
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
                        {reservation.startDate} to {reservation.endDate} HST â€”{' '}
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

            <button type="submit" disabled={isCurrentUserOwner}>
              {isCurrentUserOwner
                ? 'Owner Cannot Request'
                : 'Submit Reservation Request'}
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}

export default ToolDetailPage;
