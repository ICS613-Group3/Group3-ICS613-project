import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import { reservationsApi } from '../api/reservations';
import { reviewsApi } from '../api/reviews';
import type {
  ReservationResponse,
  ReviewResponse,
  UserProfile,
} from '../types/api';

const reviewEditWindowMilliseconds = 24 * 60 * 60 * 1000;

/**
 * Return a readable API or validation error message.
 */
function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

/**
 * Determine whether a review is still inside the 24-hour edit/delete window.
 *
 * The backend remains authoritative and performs the final time-window check.
 */
function isWithinReviewEditWindow(createdAt: string) {
  const createdTime = Date.parse(createdAt);

  if (Number.isNaN(createdTime)) {
    return false;
  }

  const elapsedMilliseconds = Date.now() - createdTime;

  return (
    elapsedMilliseconds >= 0 &&
    elapsedMilliseconds <= reviewEditWindowMilliseconds
  );
}

/**
 * Format an API timestamp for Hawaii display.
 */
function formatHstDateTime(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return `${parsedDate.toLocaleString('en-US', {
    timeZone: 'Pacific/Honolulu',
  })} HST`;
}

/**
 * Issue #51 / US24:
 * Submit, update, or delete the logged-in user's review for a returned
 * reservation using the real backend review API.
 */
function ReviewPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const resolvedReservationId = reservationId ?? '';

  const [reservation, setReservation] =
    useState<ReservationResponse | null>(null);

  const [currentUser, setCurrentUser] =
    useState<UserProfile | null>(null);

  const [existingReview, setExistingReview] =
    useState<ReviewResponse | null>(null);

  const [rating, setRating] = useState('');
  const [comment, setComment] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * Load the reservation, logged-in user, and existing reservation reviews.
   * The logged-in user's reviewer_id identifies their own existing review.
   */
  useEffect(() => {
    if (!resolvedReservationId) {
      setErrorMessage('Reservation ID is missing.');
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    async function loadReviewData() {
      setIsLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      try {
        const [
          reservationData,
          userData,
          reservationReviews,
        ] = await Promise.all([
          reservationsApi.get(resolvedReservationId),
          authApi.me(),
          reviewsApi.listForReservation(resolvedReservationId),
        ]);

        if (isCancelled) {
          return;
        }

        const ownReview =
          reservationReviews.find(
            (review) => review.reviewer_id === userData.id,
          ) ?? null;

        setReservation(reservationData);
        setCurrentUser(userData);
        setExistingReview(ownReview);

        if (ownReview) {
          setRating(String(ownReview.rating));
          setComment(ownReview.comment ?? '');
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            getErrorMessage(
              error,
              'Unable to load the reservation review.',
            ),
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadReviewData();

    return () => {
      isCancelled = true;
    };
  }, [resolvedReservationId]);

  if (isLoading) {
    return (
      <section className="page-section">
        <div className="review-card">
          <p className="eyebrow">US24 Review</p>
          <h1>Loading Review</h1>
          <p>Loading reservation and review information...</p>
        </div>
      </section>
    );
  }

  if (!reservation || !currentUser || !resolvedReservationId) {
    return (
      <section className="page-section">
        <div className="review-card">
          <p className="eyebrow">US24 Review</p>
          <h1>Unable to Load Review</h1>

          <p className="form-error">
            {errorMessage || 'Reservation information is unavailable.'}
          </p>

          <Link className="secondary-link" to="/reservations">
            Back to Reservations
          </Link>
        </div>
      </section>
    );
  }

  const canReviewReservation = reservation.state === 'RETURNED';

  const canModifyExistingReview =
    existingReview !== null &&
    isWithinReviewEditWindow(existingReview.created_at);

  const canUseReviewForm =
    canReviewReservation &&
    (existingReview === null || canModifyExistingReview);

  const isBusy = isSaving || isDeleting;

  const reviewerRoleLabel =
    currentUser.id === reservation.borrower_id
      ? 'Borrower Review'
      : 'Owner Review';

  /**
   * Create a new review or update the logged-in user's existing review.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (!canReviewReservation) {
      setErrorMessage(
        'Review is only available after the reservation status is RETURNED.',
      );
      return;
    }

    if (existingReview && !canModifyExistingReview) {
      setErrorMessage(
        'The 24-hour edit window has closed. This review can no longer be changed.',
      );
      return;
    }

    if (!rating) {
      setErrorMessage('Please select a rating from 1 to 5 stars.');
      return;
    }

    const numericRating = Number(rating);

    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      setErrorMessage('Rating must be an integer between 1 and 5.');
      return;
    }

    const normalizedComment = comment.trim();

    setIsSaving(true);

    try {
      const savedReview = existingReview
        ? await reviewsApi.update(existingReview.id, {
            rating: numericRating,
            comment: normalizedComment,
          })
        : await reviewsApi.create(resolvedReservationId, {
            rating: numericRating,
            ...(normalizedComment
              ? { comment: normalizedComment }
              : {}),
          });

      setExistingReview(savedReview);
      setRating(String(savedReview.rating));
      setComment(savedReview.comment ?? '');

      setSuccessMessage(
        existingReview
          ? 'Review updated successfully.'
          : 'Review submitted successfully.',
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          existingReview
            ? 'Unable to update the review.'
            : 'Unable to submit the review.',
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Delete the logged-in user's review during the backend-enforced
   * 24-hour deletion window.
   */
  async function handleDeleteReview() {
    if (!existingReview) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    if (!canModifyExistingReview) {
      setErrorMessage(
        'The 24-hour delete window has closed. This review can no longer be deleted.',
      );
      return;
    }

    const confirmed = window.confirm(
      'Delete this review permanently? This action cannot be undone.',
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      await reviewsApi.delete(existingReview.id);

      setExistingReview(null);
      setRating('');
      setComment('');
      setSuccessMessage('Review deleted successfully.');
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, 'Unable to delete the review.'),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US24 Review</p>
          <h1>
            {existingReview
              ? 'Manage Your Review'
              : 'Leave a Rating and Review'}
          </h1>

          <p className="page-description">
            Submit a review after the tool is returned. Reviews may be edited
            or deleted during the first 24 hours.
          </p>
        </div>

        <Link
          className="secondary-link"
          to={`/reservations/${reservation.id}`}
        >
          Back to Reservation Detail
        </Link>
      </div>

      <div className="review-layout">
        <form
          className="review-card"
          onSubmit={handleSubmit}
          aria-busy={isBusy}
          noValidate
        >
          <p className="eyebrow">{reviewerRoleLabel}</p>

          <h2>
            {existingReview ? 'Your Existing Review' : 'Review Other Member'}
          </h2>

          <div className="review-summary">
            <p>
              <strong>Reservation:</strong> {reservation.id}
            </p>

            <p>
              <strong>Tool ID:</strong> {reservation.tool_id}
            </p>

            <p>
              <strong>Dates:</strong> {reservation.start_date} to{' '}
              {reservation.end_date}
            </p>

            <p>
              <strong>Status:</strong> {reservation.state}
            </p>

            {existingReview && (
              <>
                <p>
                  <strong>Created:</strong>{' '}
                  {formatHstDateTime(existingReview.created_at)}
                </p>

                <p>
                  <strong>Last updated:</strong>{' '}
                  {formatHstDateTime(existingReview.updated_at)}
                </p>
              </>
            )}
          </div>

          {!canReviewReservation && (
            <p className="form-error">
              Review blocked: this reservation is not RETURNED.
            </p>
          )}

          {existingReview && !canModifyExistingReview && (
            <p className="workflow-note">
              The 24-hour edit/delete window has closed. The review is now
              read-only.
            </p>
          )}

          <label htmlFor="review-rating">
            Rating
            <select
              id="review-rating"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              disabled={!canUseReviewForm || isBusy}
              required
            >
              <option value="">Select rating</option>
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Okay</option>
              <option value="2">2 - Poor</option>
              <option value="1">1 - Very Poor</option>
            </select>
          </label>

          <label htmlFor="review-comment">
            Comment
            <textarea
              id="review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Optional comment about the borrowing experience"
              rows={5}
              disabled={!canUseReviewForm || isBusy}
            />
          </label>

          <p className="workflow-note">
            The backend enforces RETURNED status, one review per reviewer,
            the 30-day submission window, and the 24-hour edit/delete window.
          </p>

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p className="form-success" role="status">
              {successMessage}
            </p>
          )}

          <div className="page-header-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={!canUseReviewForm || isBusy}
            >
              {isSaving
                ? 'Saving Review...'
                : existingReview
                  ? 'Update Review'
                  : 'Submit Review'}
            </button>

            {existingReview && (
              <button
                className="danger-button"
                type="button"
                onClick={handleDeleteReview}
                disabled={!canModifyExistingReview || isBusy}
              >
                {isDeleting ? 'Deleting Review...' : 'Delete Review'}
              </button>
            )}
          </div>
        </form>

        <aside className="review-card review-preview-card">
          <p className="eyebrow">Preview</p>
          <h2>Review Preview</h2>

          <p>
            <strong>Rating:</strong>{' '}
            {rating ? `${rating}/5 stars` : 'No rating selected'}
          </p>

          <p>
            <strong>Comment:</strong>
          </p>

          <div className="review-comment-preview">
            {comment || 'No comment entered.'}
          </div>

          {existingReview && (
            <p className="workflow-note">
              Review ID: {existingReview.id}
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

export default ReviewPage;
