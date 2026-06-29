import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * ReviewHistoryItem
 *
 * Mock review history data for US25.
 */
type ReviewHistoryItem = {
  id: string;
  reservationId: string;
  toolName: string;
  reviewerName: string;
  reviewTarget: string;
  reviewType: 'Given' | 'Received';
  rating: number;
  comment: string;
  submittedAt: string;
};

/**
 * Mock review history data.
 *
 * Uses team member names for R1 demo:
 * - Rion Sawabe
 * - Ivan Wu
 * - Nick Fairhart
 * - Yafei Wang
 * - Loreto Coloma
 */
const mockReviewHistory: ReviewHistoryItem[] = [
  {
    id: 'review-1',
    reservationId: 'reservation-4',
    toolName: 'Pressure Washer',
    reviewerName: 'Yafei Wang',
    reviewTarget: 'Ivan Wu',
    reviewType: 'Given',
    rating: 5,
    comment: 'Tool was returned successfully and worked well during the borrowing period.',
    submittedAt: '2026-06-30',
  },
  {
    id: 'review-2',
    reservationId: 'reservation-3',
    toolName: 'Cordless Drill',
    reviewerName: 'Rion Sawabe',
    reviewTarget: 'Nick Fairhart',
    reviewType: 'Received',
    rating: 4,
    comment: 'Good borrower communication and the tool was returned on time.',
    submittedAt: '2026-06-28',
  },
  {
    id: 'review-3',
    reservationId: 'reservation-2',
    toolName: 'Garden Shovel',
    reviewerName: 'Loreto Coloma',
    reviewTarget: 'Yafei Wang',
    reviewType: 'Received',
    rating: 5,
    comment: 'Smooth reservation process and clear pickup/return coordination.',
    submittedAt: '2026-06-25',
  },
  {
    id: 'review-4',
    reservationId: 'reservation-1',
    toolName: 'Hammer Set',
    reviewerName: 'Ivan Wu',
    reviewTarget: 'Rion Sawabe',
    reviewType: 'Given',
    rating: 4,
    comment: 'The tool condition matched the listing and the return process was clear.',
    submittedAt: '2026-06-22',
  },
];

/**
 * ReviewHistoryPage
 *
 * US25 Review History page.
 *
 * Current R1 behavior:
 * - Shows mock submitted review history.
 * - Supports search by tool, reviewer, review target, and comment.
 * - Supports filtering by Given / Received.
 *
 * Future backend behavior:
 * - Replace mockReviewHistory with backend API data.
 */
function ReviewHistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewTypeFilter, setReviewTypeFilter] = useState<
    'All' | 'Given' | 'Received'
  >('All');

  const filteredReviews = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return mockReviewHistory.filter((review) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        review.toolName.toLowerCase().includes(normalizedSearch) ||
        review.reviewerName.toLowerCase().includes(normalizedSearch) ||
        review.reviewTarget.toLowerCase().includes(normalizedSearch) ||
        review.comment.toLowerCase().includes(normalizedSearch);

      const matchesType =
        reviewTypeFilter === 'All' || review.reviewType === reviewTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [reviewTypeFilter, searchTerm]);

  const clearFilters = () => {
    setSearchTerm('');
    setReviewTypeFilter('All');
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US25</p>
          <h1>Review History</h1>
          <p className="page-description">
            View mock review history for completed and returned reservations.
          </p>
        </div>

        <Link className="primary-link header-action-link" to="/tools?view=returned">
          Review Returned Tools
        </Link>
      </div>

      <div className="filter-panel">
        <input
          type="text"
          placeholder="Search by tool, reviewer, target, or comment"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <select
          value={reviewTypeFilter}
          onChange={(event) =>
            setReviewTypeFilter(event.target.value as 'All' | 'Given' | 'Received')
          }
        >
          <option value="All">All reviews</option>
          <option value="Given">Reviews given</option>
          <option value="Received">Reviews received</option>
        </select>

        <button type="button" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

      <p className="results-summary">
        Showing {filteredReviews.length} of {mockReviewHistory.length} reviews.
      </p>

      {filteredReviews.length === 0 ? (
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
                <span className="status-badge">{review.reviewType}</span>
                <span className="rating">Rating: {review.rating}/5</span>
              </div>

              <h2>{review.toolName}</h2>

              <dl className="tool-meta">
                <div>
                  <dt>Reviewer</dt>
                  <dd>{review.reviewerName}</dd>
                </div>

                <div>
                  <dt>Review target</dt>
                  <dd>{review.reviewTarget}</dd>
                </div>

                <div>
                  <dt>Submitted</dt>
                  <dd>{review.submittedAt}</dd>
                </div>
              </dl>

              <p className="review-history-comment">{review.comment}</p>

              <Link className="secondary-link" to={`/reservations/${review.reservationId}`}>
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
