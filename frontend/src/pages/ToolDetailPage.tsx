import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  absolutePhotoUrl,
  ApiError,
  reservationsApi,
  toolsApi,
  type Tool,
  type ToolCategory,
} from '../api/client';
import { useAuth } from '../context/authContextValue';

const categoryLabels: Record<ToolCategory, string> = {
  HAND_TOOLS: 'Hand Tools',
  POWER_TOOLS: 'Power Tools',
  GARDEN_TOOLS: 'Garden Tools',
  CLEANING_TOOLS: 'Cleaning Tools',
  OUTDOOR_GEAR: 'Outdoor Gear',
};

const conditionLabels: Record<Tool['condition'], string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
};

/**
 * ToolDetailPage
 *
 * Fetches one tool via ``GET /tools/{id}`` and offers a real
 * reservation request form (``POST /reservations``).
 *
 * "Edit Tool Listing" only shows when the current user is the owner.
 * The backend still enforces ownership on the PATCH endpoint.
 */
function ToolDetailPage() {
  const { toolId } = useParams();
  const { user } = useAuth();
  const [tool, setTool] = useState<Tool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!toolId) return;
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage('');
    toolsApi
      .get(toolId)
      .then((t) => {
        if (!cancelled) setTool(t);
      })
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof ApiError) setErrorMessage(err.message);
          else setErrorMessage('Failed to load tool.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toolId]);

  if (isLoading) {
    return (
      <section className="page-section">
        <p>Loading tool…</p>
      </section>
    );
  }

  if (!tool) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Tool Not Found</p>
          <h1>We could not find this tool.</h1>
          <p>
            {errorMessage ||
              'The selected tool may no longer exist or the link may be incorrect.'}
          </p>
          <Link className="primary-link narrow-link" to="/tools">
            Back to Browse Tools
          </Link>
        </div>
      </section>
    );
  }

  const photo = tool.photos[0];
  const imageUrl = photo ? absolutePhotoUrl(photo.url) : '';
  const isOwner = user?.id === tool.owner_id;

  const handleReservationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');
    setSuccessMessage('');
    if (!startDate || !endDate) {
      setSubmitError('Please select both a start date and an end date.');
      return;
    }
    if (endDate < startDate) {
      setSubmitError('End date cannot be before start date.');
      return;
    }
    setIsSubmitting(true);
    try {
      const reservation = await reservationsApi.create({
        tool_id: tool.id,
        start_date: startDate,
        end_date: endDate,
      });
      setSuccessMessage(
        `Reservation request submitted. Status: ${reservation.state}.`,
      );
      setStartDate('');
      setEndDate('');
    } catch (err) {
      if (err instanceof ApiError) setSubmitError(err.message);
      else setSubmitError('Failed to submit reservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Tool Detail</p>
          <h1>{tool.name}</h1>
          <p className="page-description">
            Review the tool information and submit a reservation request.
          </p>
        </div>

        <div className="header-actions tool-detail-actions">
          {isOwner && (
            <Link className="primary-link" to={`/tools/${tool.id}/edit`}>
              Edit Tool Listing
            </Link>
          )}
          <Link className="secondary-link" to="/tools">
            Back to Browse Tools
          </Link>
        </div>
      </div>

      <div className="tool-detail-grid">
        <article className="tool-detail-card">
          {imageUrl ? (
            <img src={imageUrl} alt={tool.name} className="detail-image" />
          ) : (
            <div className="detail-image detail-image-placeholder">No photo</div>
          )}

          <div className="tool-detail-content">
            <div className="tool-card-top">
              <span className="status-badge">{categoryLabels[tool.category]}</span>
              <span className="rating">
                {tool.rating_count > 0
                  ? `★ ${tool.avg_rating.toFixed(1)} (${tool.rating_count})`
                  : 'No reviews yet'}
              </span>
            </div>

            <h2>{tool.name}</h2>
            <p>{tool.description ?? 'No description provided.'}</p>

            <dl className="detail-meta-grid">
              <div>
                <dt>Owner</dt>
                <dd>{tool.owner.full_name ?? 'Anonymous'}</dd>
              </div>

              <div>
                <dt>Condition</dt>
                <dd>{conditionLabels[tool.condition]}</dd>
              </div>

              {!tool.is_active && (
                <div>
                  <dt>Status</dt>
                  <dd>
                    Deactivated
                    {tool.deactivation_reason ? `: ${tool.deactivation_reason}` : ''}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </article>

        <aside className="reservation-request-card">
          <p className="eyebrow">Reservation Request</p>
          <h2>Request this tool</h2>
          {isOwner ? (
            <p>You own this tool — you cannot reserve your own listing.</p>
          ) : !tool.is_active ? (
            <p>This tool is currently deactivated and cannot be reserved.</p>
          ) : (
            <>
              <p>Select your desired borrowing dates.</p>
              <p className="helper-text">Dates are in Hawaii Standard Time (HST).</p>
              <form className="reservation-form" onSubmit={handleReservationSubmit}>
                <label>
                  Start Date (HST)
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    required
                  />
                </label>

                <label>
                  End Date (HST)
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    required
                  />
                </label>

                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting…' : 'Submit Reservation Request'}
                </button>
              </form>

              {submitError && (
                <p className="error-message" role="alert">
                  {submitError}
                </p>
              )}
              {successMessage && (
                <div className="success-message" role="status">
                  {successMessage}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

export default ToolDetailPage;
