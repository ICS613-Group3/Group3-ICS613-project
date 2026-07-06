import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { reservationsApi } from '../api/reservations';
import { toolsApi } from '../api/tools';
import { reviewsApi } from '../api/reviews';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';
import type { ReservationResponse, ToolResponse } from '../types/api';

function ReviewPage() {
  const { reservationId } = useParams();
  const { user } = useAuth();
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);
  const [tool, setTool] = useState<ToolResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [rating, setRating] = useState('');
  const [comment, setComment] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!reservationId) return;
    setIsLoading(true);
    try {
      const res = await reservationsApi.get(reservationId);
      setReservation(res);
      try {
        const t = await toolsApi.get(res.tool_id);
        setTool(t);
      } catch { /* non-critical */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reservation not found');
    } finally {
      setIsLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const canReview = reservation?.state === 'RETURNED';
  const isBorrower = user && reservation && user.id === reservation.borrower_id;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!reservation || !reservationId) {
      setErrorMessage('Reservation not found.');
      return;
    }

    if (!canReview) {
      setErrorMessage('Review is only available after the reservation status is RETURNED.');
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

    setIsSubmitting(true);
    try {
      await reviewsApi.create(reservationId, {
        rating: numericRating,
        comment: comment.trim() || undefined,
      });
      setSuccessMessage(`Review submitted: ${numericRating}/5 stars.`);
      setRating('');
      setComment('');
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.detail : 'Failed to submit review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page-section">
        <div className="page-header"><h1>Loading...</h1></div>
      </section>
    );
  }

  if (!reservation || error) {
    return (
      <main className="page-container">
        <section className="review-card">
          <p className="eyebrow">US24 Review</p>
          <h1>Reservation not found</h1>
          <p className="page-subtitle">{error || 'The reservation does not exist.'}</p>
          <Link className="secondary-link" to="/reservations">Back to Reservations</Link>
        </section>
      </main>
    );
  }

  const revieweeName = tool?.owner?.full_name || 'the tool owner';

  return (
    <main className="page-container">
      <section className="page-header split-page-header">
        <div>
          <p className="eyebrow">US24 Review</p>
          <h1>Leave a Rating and Review</h1>
          <p className="page-subtitle">
            Submit a review after a reservation has been returned.
          </p>
        </div>
        <div className="header-actions">
          <Link className="secondary-link" to={`/reservations/${reservation.id}`}>
            Back to Reservation Detail
          </Link>
        </div>
      </section>

      <section className="review-layout">
        <form className="review-card" onSubmit={handleSubmit}>
          <p className="eyebrow">{isBorrower ? 'Borrower Review' : 'Owner Review'}</p>
          <h2>
            {isBorrower ? `Review ${revieweeName}` : 'Review Borrower'}
          </h2>

          <div className="review-summary">
            <p><strong>Tool:</strong> {tool?.name || 'Unknown'}</p>
            <p><strong>Dates:</strong> {reservation.start_date} to {reservation.end_date}</p>
            <p><strong>Status:</strong> <span className={`status-badge status-${reservation.state.toLowerCase()}`}>{reservation.state}</span></p>
          </div>

          {!canReview && (
            <div className="warning-panel">
              <strong>Review blocked:</strong> This reservation is not RETURNED yet.
              US24 only allows reviews after the tool has been returned.
            </div>
          )}

          <label>
            Rating
            <select value={rating} onChange={(event) => setRating(event.target.value)} disabled={!canReview}>
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

          {errorMessage && <p className="form-error">{errorMessage}</p>}
          {successMessage && <p className="success-message">{successMessage}</p>}

          <button className="primary-button" type="submit" disabled={!canReview || isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>

        <aside className="review-card review-preview-card">
          <h2>Live Review Preview</h2>
          <p><strong>Review for:</strong> {revieweeName}</p>
          <p><strong>Rating:</strong> {rating ? `${rating}/5 stars` : 'No rating selected'}</p>
          <p><strong>Comment:</strong></p>
          <div className="review-comment-preview">{comment || 'No comment entered yet.'}</div>
        </aside>
      </section>
    </main>
  );
}

export default ReviewPage;
