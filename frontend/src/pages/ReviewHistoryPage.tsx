import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { reviewsApi } from '../api/reviews';
import { useAuth } from '../context/useAuth';
import type { ReviewResponse } from '../types/api';

function ReviewHistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<ReviewResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewTypeFilter, setReviewTypeFilter] = useState<'all' | 'given' | 'received'>('all');

  const role = reviewTypeFilter === 'all' ? undefined : reviewTypeFilter;

  const loadReviews = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError('');
    try {
      // Load both given and received for the "all" filter
      if (reviewTypeFilter === 'all') {
        const [given, received] = await Promise.all([
          reviewsApi.listMyReviews({ role: 'given', page_size: 50 }),
          reviewsApi.listMyReviews({ role: 'received', page_size: 50 }),
        ]);
        setReviews([...given.items, ...received.items]);
      } else {
        const data = await reviewsApi.listMyReviews({ role, page_size: 50 });
        setReviews(data.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  }, [user, role, reviewTypeFilter]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const filteredReviews = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return reviews;
    return reviews.filter((review) => {
      const toolName = ''; // reviews don't include tool name directly
      const comment = review.comment?.toLowerCase() || '';
      return comment.includes(normalizedSearch) || toolName.includes(normalizedSearch);
    });
  }, [reviews, searchTerm]);

  const clearFilters = () => {
    setSearchTerm('');
    setReviewTypeFilter('all');
  };

  if (authLoading) {
    return <section className="page-section"><div className="page-header"><h1>Loading...</h1></div></section>;
  }

  if (!user) {
    return (
      <section className="page-section">
        <div className="page-header"><h1>Please log in</h1></div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US25</p>
          <h1>Review History</h1>
          <p className="page-description">
            View reviews you have given and received.
          </p>
        </div>
        <Link className="primary-link header-action-link" to="/tools?view=returned">
          Review Returned Tools
        </Link>
      </div>

      <div className="filter-panel">
        <input
          type="text"
          placeholder="Search by comment text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <select
          value={reviewTypeFilter}
          onChange={(event) =>
            setReviewTypeFilter(event.target.value as 'all' | 'given' | 'received')
          }
        >
          <option value="all">All reviews</option>
          <option value="given">Reviews given</option>
          <option value="received">Reviews received</option>
        </select>
        <button type="button" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {isLoading && <p>Loading reviews...</p>}

      {!isLoading && !error && (
        <p className="results-summary">
          Showing {filteredReviews.length} of {reviews.length} reviews.
        </p>
      )}

      {!isLoading && !error && filteredReviews.length === 0 ? (
        <div className="empty-state-card">
          <p className="eyebrow">No Results</p>
          <h2>No reviews match the current filters.</h2>
          <p>Try clearing filters or searching for a different keyword.</p>
          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="review-history-grid">
          {filteredReviews.map((review) => (
            <article className="review-history-card" key={review.id}>
              <div className="tool-card-top">
                <span className="rating">Rating: {review.rating}/5</span>
              </div>

              <h2>Review for Reservation</h2>

              <dl className="tool-meta">
                <div>
                  <dt>Comment</dt>
                  <dd>{review.comment || 'No comment'}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{new Date(review.created_at).toLocaleDateString()}</dd>
                </div>
              </dl>

              <Link className="secondary-link" to={`/reservations/${review.reservation_id}`}>
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
