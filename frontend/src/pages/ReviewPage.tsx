import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ApiError,
  reservationsApi,
  reviewsApi,
  type Reservation,
} from '../api/client';
import { useAuth } from '../context/authContextValue';

/**
 * ReviewPage
 *
 * Real backend review submission via
 * ``POST /reservations/{reservation_id}/review``.
 *
 * The backend only allows reviews when the reservation is ``RETURNED``,
 * and one review per reservation per reviewer (returns 409 on duplicate).
 * We gate the form on the client too for UX, but the backend is the
 * source of truth.
 */
function ReviewPage() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [rating, setRating] = useState('');
  const [comment, setComment] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!reservationId) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
    reservationsApi
      .get(reservationId)
      .then((r) => {
        if (!cancelled) setReservation(r);
      })
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof ApiError) setLoadError(err.message);
          else setLoadError('Failed to load reservation.');
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
      <main className="page-container">
        <section className="review-card">
          <p>Loading…</p>
        </section>
      </main>
    );
  }

  if (!reservation) {
    return (
      <main className="page-container">
        <section className="review-card">
          <p className="eyebrow">Review</p>
          <h1>Reservation not found</h1>
          <p className="page-subtitle">
            {loadError || 'The reservation does not exist or you are not a party to it.'}
          </p>
          <Link className="secondary-link" to="/reservations">
            Back to Reservations
          </Link>
        </section>
      </main>
    );
  }

  const canReview = reservation.state === 'RETURNED';
  const isBorrower = user?.id === reservation.borrower_id;
  // If the current user is the borrower, they review the owner.
  // Otherwise (the owner), they review the borrower.
  const revieweeLabel = isBorrower
    ? 'the tool owner'
    : 'the borrower';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (!rating) {
      setErrorMessage('Please select a rating from 1 to 5 stars.');
      return;
    }
    const numeric = Number(rating);
    if (numeric < 1 || numeric > 5) {
      setErrorMessage('Rating must be between 1 and 5.');
      return;
    }
    setIsSubmitting(true);
    try {
      await reviewsApi.create(reservation.id, {
        rating: numeric,
        comment: comment.trim() || undefined,
      });
      setSuccessMessage('Review submitted. Thank you!');
      // Brief delay so the user can see the success message before redirect.
      setTimeout(() => navigate('/reviews/history'), 1200);
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to submit review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-container">
      <section className="page-header split-page-header">
        <div>
          <p className="eyebrow">Review</p>
          <h1>Leave a Rating and Review</h1>
          <p className="page-subtitle">
            Submit a review after a reservation has been returned.
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
          <p className="eyebrow">
            {isBorrower ? 'Borrower Review' : 'Owner Review'}
          </p>
          <h2>Review {revieweeLabel}</h2>

          <div className="review-summary">
            <p>
              <strong>Reservation:</strong> #{reservation.id.slice(0, 8)}
            </p>
            <p>
              <strong>Tool:</strong> #{reservation.tool_id.slice(0, 8)}
            </p>
            <p>
              <strong>Dates:</strong> {reservation.start_date} to{' '}
              {reservation.end_date}
            </p>
            <p>
              <strong>Status:</strong>{' '}
              <span
                className={`status-badge status-${reservation.state.toLowerCase()}`}
              >
                {reservation.state}
              </span>
            </p>
          </div>

          {!canReview && (
            <div className="warning-panel">
              <strong>Review blocked:</strong> This reservation is not
              RETURNED yet. Reviews can only be submitted after the tool has
              been returned.
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
              maxLength={2000}
              disabled={!canReview}
            />
          </label>

          {errorMessage && <p className="error-message" role="alert">{errorMessage}</p>}
          {successMessage && <p className="success-message" role="status">{successMessage}</p>}

          <button className="primary-button" type="submit" disabled={!canReview || isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </form>

        <aside className="review-card review-preview-card">
          <h2>Live Review Preview</h2>

          <p>
            <strong>Review for:</strong> {revieweeLabel}
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
        </aside>
      </section>
    </main>
  );
}

export default ReviewPage;
