import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mockReservations } from '../data/mockData';

/**
 * ReviewPage
 *
 * This page supports US24 - Leave a Rating and Review After a Tool is Returned.
 *
 * Current R1 behavior:
 * - Uses mock reservation data from src/data/mockData.ts.
 * - Only allows review submission when reservation status is RETURNED.
 * - Validates that rating is required and must be 1 to 5.
 * - Comment is optional.
 * - Shows a frontend-only mock success message.
 *
 * Important:
 * - This page does NOT save to the backend yet.
 * - Ivan can later connect handleSubmit() to the backend review API.
 */
function ReviewPage() {
  // Read reservationId from the route: /reservations/:reservationId/review
  const { reservationId } = useParams();

  /**
   * Find the selected reservation from mock data.
   * Example test route:
   * /reservations/reservation-4/review
   */
  const reservation = useMemo(
    () =>
      mockReservations.find(
        (currentReservation) => currentReservation.id === reservationId,
      ),
    [reservationId],
  );

  /**
   * Local form state for the mock review form.
   * rating starts as an empty string so we can validate whether the user selected it.
   */
  const [rating, setRating] = useState('');
  const [comment, setComment] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * If the reservation ID does not exist, show a safe error message.
   * This prevents the page from crashing when the URL is invalid.
   */
  if (!reservation) {
    return (
      <main className="page-container">
        <section className="review-card">
          <p className="eyebrow">US24 Review</p>
          <h1>Reservation not found</h1>
          <p className="page-subtitle">
            The reservation you are trying to review does not exist in the mock data.
          </p>

          <Link className="secondary-link" to="/reservations">
            Back to Reservations
          </Link>
        </section>
      </main>
    );
  }

  /**
   * US24 rule:
   * A review can only be submitted after the reservation reaches RETURNED.
   */
  const canReview = reservation.status === 'RETURNED';

  /**
   * Decide who is being reviewed for the mock demo.
   *
   * If the current mock view is owner, the owner reviews the borrower.
   * If the current mock view is borrower, the borrower reviews the owner.
   */
  const revieweeName =
    reservation.role === 'owner'
      ? reservation.borrowerName
      : reservation.ownerName;

  const reviewerRoleLabel =
    reservation.role === 'owner' ? 'Owner Review' : 'Borrower Review';

  /**
   * Handles mock review submission.
   *
   * Later backend integration idea:
   * Replace the mock success message with an API call, for example:
   * await reviewService.createReview(reservation.id, { rating, comment })
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (!canReview) {
      setErrorMessage(
        'Review is only available after the reservation status is RETURNED.',
      );
      return;
    }

    if (!rating) {
      setErrorMessage('Please select a rating from 1 to 5 stars.');
      return;
    }

    const numericRating = Number(rating);

    if (numericRating < 1 || numericRating > 5) {
      setErrorMessage('Rating must be between 1 and 5.');
      return;
    }

    setSuccessMessage(
      `Mock review submitted for ${revieweeName}: ${numericRating}/5 stars.`,
    );
  };

  return (
    <main className="page-container">
      <section className="page-header split-page-header">
        <div>
          <p className="eyebrow">US24 Review</p>
          <h1>Leave a Rating and Review</h1>
          <p className="page-subtitle">
            Submit a mock review after a reservation has been returned.
          </p>
        </div>

        <div className="header-actions">
          <Link
            className="secondary-link"
            to={`/reservations/${reservation.id}`}
          >
            Back to Reservation Detail
          </Link>
        </div>
      </section>

      <section className="review-layout">
        <form className="review-card" onSubmit={handleSubmit}>
          <p className="eyebrow">{reviewerRoleLabel}</p>
          <h2>Review {revieweeName}</h2>

          <div className="review-summary">
            <p>
              <strong>Tool:</strong> {reservation.toolName}
            </p>
            <p>
              <strong>Borrower:</strong> {reservation.borrowerName}
            </p>
            <p>
              <strong>Owner:</strong> {reservation.ownerName}
            </p>
            <p>
              <strong>Dates:</strong> {reservation.startDate} to{' '}
              {reservation.endDate}
            </p>
            <p>
              <strong>Status:</strong>{' '}
              <span className={`status-badge status-${reservation.status.toLowerCase()}`}>
                {reservation.status}
              </span>
            </p>
          </div>

          {!canReview && (
            <div className="warning-panel">
              <strong>Review blocked:</strong> This reservation is not RETURNED yet.
              US24 only allows reviews after the tool has been returned.
            </div>
          )}

          <label>
            Rating
            <select
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              disabled={!canReview}
            >
              <option value="">Select rating</option>
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Okay</option>
              <option value="2">2 - Poor</option>
              <option value="1">1 - Very Poor</option>
            </select>
          </label>

          <label>
            Comment
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Optional comment about the borrowing experience"
              rows={5}
              disabled={!canReview}
            />
          </label>

          <p className="workflow-note">
            This review form is frontend-only for the R1 demo. It does not save to
            the backend yet.
          </p>

          {errorMessage && <p className="error-message">{errorMessage}</p>}
          {successMessage && <p className="success-message">{successMessage}</p>}

          <button className="primary-button" type="submit" disabled={!canReview}>
            Submit Mock Review
          </button>
        </form>

        <aside className="review-card review-preview-card">
          <h2>Live Review Preview</h2>

          <p>
            <strong>Review for:</strong> {revieweeName}
          </p>

          <p>
            <strong>Rating:</strong>{' '}
            {rating ? `${rating}/5 stars` : 'No rating selected'}
          </p>

          <p>
            <strong>Comment:</strong>
          </p>

          <div className="review-comment-preview">
            {comment || 'No comment entered yet.'}
          </div>

          <p className="workflow-note">
            This preview updates locally while you type.
          </p>
        </aside>
      </section>
    </main>
  );
}

export default ReviewPage;
