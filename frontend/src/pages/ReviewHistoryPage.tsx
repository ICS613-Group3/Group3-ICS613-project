import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ApiError,
  reservationsApi,
  reviewsApi,
  type Reservation,
  type Review,
} from '../api/client';
import { useAuth } from '../context/authContextValue';

/**
 * ReviewHistoryPage
 *
 * Real backend "given + received" review history.
 *
 * The backend has no ``GET /reviews/me`` or ``GET /reviews/for-me`` yet,
 * so we rebuild the history by:
 *   1. Fetching ``GET /reservations?state=RETURNED`` for both roles.
 *   2. For each, calling ``GET /reservations/{id}/review`` to see which
 *      have reviews and to get the review records.
 *   3. Classifying each review as "Given" (current user is reviewer)
 *      or "Received" (current user is reviewee).
 */
type ReviewType = 'Given' | 'Received';
type FilterType = 'All' | ReviewType;

interface DisplayReview {
  id: string;
  reservationId: string;
  rating: number;
  comment: string | null;
  submittedAt: string;
  type: ReviewType;
  counterpartyId: string;
}

function ReviewHistoryPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<DisplayReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('All');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage('');
    (async () => {
      try {
        const [asBorrower, asOwner] = await Promise.all([
          reservationsApi.list({ state: 'RETURNED', role: 'borrower' }),
          reservationsApi.list({ state: 'RETURNED', role: 'owner' }),
        ]);
        const seenRes = new Set<string>();
        const allReservations: Reservation[] = [];
        for (const r of [...asBorrower.items, ...asOwner.items]) {
          if (!seenRes.has(r.id)) {
            seenRes.add(r.id);
            allReservations.push(r);
          }
        }

        // Pull reviews for each reservation in parallel.
        const reviewLists = await Promise.all(
          allReservations.map((r) =>
            reviewsApi.listForReservation(r.id).catch(() => [] as Review[]),
          ),
        );

        if (cancelled) return;
        const flat: DisplayReview[] = [];
        for (let i = 0; i < allReservations.length; i += 1) {
          const reservation = allReservations[i];
          const list = reviewLists[i];
          for (const review of list) {
            if (!user) continue;
            const type: ReviewType =
              review.reviewer_id === user.id ? 'Given' : 'Received';
            flat.push({
              id: review.id,
              reservationId: reservation.id,
              rating: review.rating,
              comment: review.comment,
              submittedAt: review.created_at,
              type,
              counterpartyId:
                type === 'Given' ? review.reviewee_id : review.reviewer_id,
            });
          }
        }
        setReviews(flat);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) setErrorMessage(err.message);
          else setErrorMessage('Failed to load review history.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return reviews.filter((r) => {
      const matchesType = typeFilter === 'All' || r.type === typeFilter;
      const matchesSearch =
        !q || (r.comment ?? '').toLowerCase().includes(q) || r.reservationId.includes(q);
      return matchesType && matchesSearch;
    });
  }, [reviews, searchTerm, typeFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('All');
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Review History</p>
          <h1>Review History</h1>
          <p className="page-description">
            View reviews you have given and received for returned
            reservations.
          </p>
        </div>

        <Link className="primary-link header-action-link" to="/tools?view=returned">
          Review Returned Tools
        </Link>
      </div>

      <div className="filter-panel">
        <input
          type="text"
          placeholder="Search by comment text or reservation id"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as FilterType)}
        >
          <option value="All">All reviews</option>
          <option value="Given">Reviews given</option>
          <option value="Received">Reviews received</option>
        </select>

        <button type="button" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : errorMessage ? (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      ) : filtered.length === 0 ? (
        <div className="empty-state-card">
          <p className="eyebrow">No Results</p>
          <h2>No reviews match the current filters.</h2>
          <p>Try clearing filters or come back after a reservation is returned.</p>
          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="review-history-grid">
          {filtered.map((review) => (
            <article className="review-history-card" key={review.id}>
              <div className="tool-card-top">
                <span className="status-badge">{review.type}</span>
                <span className="rating">Rating: {review.rating}/5</span>
              </div>

              <h2>Reservation #{review.reservationId.slice(0, 8)}</h2>

              <dl className="tool-meta">
                <div>
                  <dt>Counterparty</dt>
                  <dd>User #{review.counterpartyId.slice(0, 8)}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{new Date(review.submittedAt).toLocaleDateString()}</dd>
                </div>
              </dl>

              {review.comment && (
                <p className="review-history-comment">{review.comment}</p>
              )}

              <Link
                className="secondary-link"
                to={`/reservations/${review.reservationId}`}
              >
                View Reservation
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default ReviewHistoryPage;
