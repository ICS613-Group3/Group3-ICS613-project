import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiRequestError } from '../api/client';
import { membersApi } from '../api/members';

import type {
  PublicMemberProfileResponse,
  PublicMemberReview,
  ToolResponse,
} from '../types/api';

/**
 * Convert an enum-like backend value into readable text.
 *
 * Example:
 * POWER_TOOLS -> Power Tools
 */
function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Format backend dates for member-facing display.
 *
 * Hawaii Standard Time is used consistently with the rest of the project.
 */
function formatProfileDate(value: string) {
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00Z`
    : value;

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Pacific/Honolulu',
  }).format(date);
}

/**
 * Produce a safe avatar fallback from a display name.
 */
function getInitials(displayName: string) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return initials || 'M';
}

/**
 * PublicMemberProfilePage
 *
 * Frontend coverage for Issue #52 / User Story 25:
 * - Loads another member's public profile using the route member ID.
 * - Excludes private member information from the frontend contract.
 * - Displays member-since date and neighborhood.
 * - Displays average rating and completed loans as owner.
 * - Displays damage-report trust signals.
 * - Displays active tool listings.
 * - Displays all reviews written about the member.
 * - Preserves a safe deleted-member presentation.
 *
 * Backend dependency:
 * - GET /users/{memberId} must be implemented by the backend.
 * - The page does not use mock profile or review data.
 */
function PublicMemberProfilePage() {
  const { memberId } = useParams<{ memberId: string }>();

  const [profile, setProfile] =
    useState<PublicMemberProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let ignoreResult = false;

    async function loadProfile() {
      if (!memberId) {
        setErrorMessage('A member ID is required to view this profile.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await membersApi.getPublicProfile(memberId);

        if (!ignoreResult) {
          setProfile(response);
        }
      } catch (error) {
        if (ignoreResult) {
          return;
        }

        if (error instanceof ApiRequestError && error.status === 404) {
          setErrorMessage(
            'This member profile could not be found or is currently unavailable.',
          );
        } else if (error instanceof ApiRequestError && error.status === 403) {
          setErrorMessage(
            'You do not have permission to view this member profile.',
          );
        } else {
          setErrorMessage(
            error instanceof ApiRequestError
              ? error.detail
              : 'Unable to load this member profile. Please try again.',
          );
        }
      } finally {
        if (!ignoreResult) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      ignoreResult = true;
    };
  }, [memberId]);

  const activeTools = useMemo(() => {
    return (profile?.active_tools ?? []).filter((tool) => tool.is_active);
  }, [profile]);

  const reviews = profile?.reviews ?? [];

  if (isLoading) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Member Profile</p>
          <h1>Loading member profile...</h1>
          <p>
            Retrieving public profile details, active listings, and review
            history.
          </p>
        </div>
      </section>
    );
  }

  if (errorMessage || !profile) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Profile Unavailable</p>
          <h1>We could not display this member profile.</h1>

          <p className="form-error">
            {errorMessage || 'The member profile response was empty.'}
          </p>

          <Link className="primary-link narrow-link" to="/tools">
            Back to Browse Tools
          </Link>
        </div>
      </section>
    );
  }

  const isDeletedMember = profile.status === 'DELETED';
  const displayName = isDeletedMember
    ? 'Community Member'
    : profile.full_name?.trim() || 'Community Member';

  // Defense in depth: do not display optional profile data for deleted members,
  // even if an incomplete backend response accidentally includes it.
  const publicPhotoUrl = isDeletedMember ? null : profile.photo_url;
  const publicBio = isDeletedMember ? null : profile.bio;
  const publicNeighborhood = isDeletedMember ? null : profile.neighborhood;

  const averageRating = Number.isFinite(profile.average_rating)
    ? profile.average_rating
    : 0;

  const damageReportCount = profile.damage_report_count ?? 0;

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Public Member Profile</p>
          <h1>{displayName}</h1>
          <p className="page-description">
            Review this member's community history before lending or borrowing.
          </p>
        </div>

        <div className="page-header-actions">
          <Link className="secondary-link" to="/tools">
            Back to Browse Tools
          </Link>
        </div>
      </div>

      <article className="profile-card public-profile-hero">
        <div className="public-profile-identity">
          {publicPhotoUrl ? (
            <img
              className="public-profile-avatar"
              src={publicPhotoUrl}
              alt={`${displayName} profile`}
            />
          ) : (
            <div
              className="public-profile-avatar public-profile-avatar-fallback"
              aria-hidden="true"
            >
              {getInitials(displayName)}
            </div>
          )}

          <div>
            <h2>{displayName}</h2>

            <dl className="public-profile-detail-list">
              <div>
                <dt>Member since</dt>
                <dd>{formatProfileDate(profile.member_since)}</dd>
              </div>

              {!isDeletedMember && (
                <div>
                  <dt>Neighborhood</dt>
                  <dd>{publicNeighborhood || 'Not provided'}</dd>
                </div>
              )}

              <div>
                <dt>Account status</dt>
                <dd>{formatEnumLabel(profile.status)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {isDeletedMember ? (
          <p className="deleted-member-notice">
            This account has been deleted. Historical reviews are preserved
            for community trust, while the member's identity and other
            personal profile information are hidden.
          </p>
        ) : (
          <section>
            <h3>About this member</h3>
            <p>{publicBio || 'This member has not added a public bio.'}</p>
          </section>
        )}
      </article>

      <div className="dashboard-summary-grid">
        <article className="summary-card">
          <strong className="summary-number">
            {averageRating.toFixed(1)}/5
          </strong>
          <span className="summary-label">Average rating</span>
        </article>

        <article className="summary-card">
          <strong className="summary-number">
            {profile.review_count ?? reviews.length}
          </strong>
          <span className="summary-label">Community reviews</span>
        </article>

        <article className="summary-card">
          <strong className="summary-number">
            {profile.completed_loans_as_owner}
          </strong>
          <span className="summary-label">Completed loans as owner</span>
        </article>

        <article className="summary-card">
          <strong className="summary-number">{damageReportCount}</strong>
          <span className="summary-label">Damage-report trust signals</span>
        </article>
      </div>

      <article className="profile-card public-profile-trust-card">
        <div>
          <p className="eyebrow">Community Trust</p>
          <h2>Trust signals</h2>
        </div>

        {damageReportCount > 0 ? (
          <div className="trust-signal-warning">
            <strong>
              {damageReportCount} damage{' '}
              {damageReportCount === 1 ? 'report' : 'reports'}
            </strong>

            <p>
              Each damage report is included as a 1-star equivalent when the
              member's displayed average rating is calculated.
            </p>
          </div>
        ) : (
          <p>
            No damage-report trust signals are currently associated with this
            member.
          </p>
        )}
      </article>

      {!isDeletedMember && (
        <section className="public-profile-section">
          <div className="public-profile-section-header">
            <div>
              <p className="eyebrow">Active Listings</p>
              <h2>Tools available from {displayName}</h2>
            </div>

            <span className="status-badge">
              {activeTools.length}{' '}
              {activeTools.length === 1 ? 'listing' : 'listings'}
            </span>
          </div>

          {activeTools.length === 0 ? (
            <div className="empty-state-card">
              <h3>No active tool listings</h3>
              <p>This member does not currently have an active listing.</p>
            </div>
          ) : (
            <div className="card-grid">
              {activeTools.map((tool: ToolResponse) => {
                const firstPhoto = tool.photos[0]?.url;

                return (
                  <article className="tool-card" key={tool.id}>
                    {firstPhoto ? (
                      <img
                        className="tool-image"
                        src={firstPhoto}
                        alt={tool.name}
                      />
                    ) : (
                      <div className="tool-image public-profile-tool-placeholder">
                        No photo
                      </div>
                    )}

                    <div className="tool-card-body">
                      <div className="tool-card-top">
                        <span className="status-badge">
                          {formatEnumLabel(tool.category)}
                        </span>

                        <span className="rating">
                          Rating: {tool.avg_rating.toFixed(1)}/5
                        </span>
                      </div>

                      <h2>{tool.name}</h2>

                      <p>
                        {tool.description ||
                          'No description was provided for this tool.'}
                      </p>

                      <dl className="tool-meta">
                        <div>
                          <dt>Condition</dt>
                          <dd>{formatEnumLabel(tool.condition)}</dd>
                        </div>

                        <div>
                          <dt>Reviews</dt>
                          <dd>{tool.rating_count}</dd>
                        </div>
                      </dl>

                      <Link className="primary-link" to={`/tools/${tool.id}`}>
                        View Tool Details
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="public-profile-section">
        <div className="public-profile-section-header">
          <div>
            <p className="eyebrow">Review History</p>
            <h2>Reviews written about {displayName}</h2>
          </div>

          <span className="status-badge">
            {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
          </span>
        </div>

        {reviews.length === 0 ? (
          <div className="empty-state-card">
            <h3>No reviews yet</h3>
            <p>No community reviews have been written about this member.</p>
          </div>
        ) : (
          <div className="review-history-grid">
            {reviews.map((review: PublicMemberReview) => (
              <article className="review-history-card" key={review.id}>
                <div className="tool-card-top">
                  <span className="status-badge">Community Review</span>
                  <span className="rating">
                    Rating: {review.rating}/5
                  </span>
                </div>

                <dl className="tool-meta">
                  <div>
                    <dt>Reviewer</dt>
                    <dd>
                      <Link
                        className="public-profile-reviewer-link"
                        to={`/members/${review.reviewer_id}`}
                      >
                        {review.reviewer_name || 'Community Member'}
                      </Link>
                    </dd>
                  </div>

                  <div>
                    <dt>Reservation date</dt>
                    <dd>{formatProfileDate(review.reservation_date)}</dd>
                  </div>

                  <div>
                    <dt>Review submitted</dt>
                    <dd>{formatProfileDate(review.created_at)}</dd>
                  </div>
                </dl>

                <p className="review-history-comment">
                  {review.comment || 'No written comment was provided.'}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default PublicMemberProfilePage;
