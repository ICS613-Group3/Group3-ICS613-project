import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toolsApi } from '../api/tools';
import { reservationsApi } from '../api/reservations';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';
import type { ToolResponse } from '../types/api';

const categoryLabels: Record<string, string> = {
  HAND_TOOLS: 'Hand Tools',
  POWER_TOOLS: 'Power Tools',
  GARDEN_TOOLS: 'Garden Tools',
  CLEANING_TOOLS: 'Cleaning Tools',
  OUTDOOR_GEAR: 'Outdoor Gear',
};

const BACKEND_ORIGIN = import.meta.env.VITE_API_TARGET || 'http://localhost:8000';

function ToolDetailPage() {
  const { toolId } = useParams();
  const { user } = useAuth();
  const [tool, setTool] = useState<ToolResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [reserveError, setReserveError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!toolId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    toolsApi
      .get(toolId)
      .then(setTool)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load tool'))
      .finally(() => setIsLoading(false));
  }, [toolId]);

  const isOwner = user && tool && user.id === tool.owner_id;

  const getImageUrl = (): string => {
    if (tool?.photos && tool.photos.length > 0) {
      return `${BACKEND_ORIGIN}${tool.photos[0].url}`;
    }
    return `https://placehold.co/600x400?text=${encodeURIComponent(tool?.name || 'Tool')}`;
  };

  const handleReservationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage('');
    setReserveError('');

    if (!tool || !toolId) {
      setReserveError('Tool not found.');
      return;
    }

    if (!startDate || !endDate) {
      setReserveError('Please select both a start date and an end date.');
      return;
    }

    if (endDate < startDate) {
      setReserveError('End date cannot be before start date.');
      return;
    }

    setIsSubmitting(true);
    try {
      await reservationsApi.create({
        tool_id: toolId,
        start_date: startDate,
        end_date: endDate,
      });
      setSuccessMessage(
        `Reservation request submitted for ${tool.name} from ${startDate} to ${endDate}. Status: REQUESTED.`,
      );
      setStartDate('');
      setEndDate('');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setReserveError(err.detail);
      } else {
        setReserveError('Failed to submit reservation.');
      }
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

  if (!tool || error) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Tool Not Found</p>
          <h1>We could not find this tool.</h1>
          <p>{error || 'The selected tool may not exist.'}</p>
          <Link className="primary-link narrow-link" to="/tools">
            Back to Browse Tools
          </Link>
        </div>
      </section>
    );
  }

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
        <div className="page-header-actions">
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

      <div className="tool-detail-layout">
        <article className="tool-detail-card">
          <img className="tool-detail-image" src={getImageUrl()} alt={tool.name} />

          <div className="tool-detail-content">
            <div className="tool-detail-title-row">
              <span className="tool-category-badge">
                {categoryLabels[tool.category] || tool.category}
              </span>
              <span className="tool-rating">
                Rating: {tool.avg_rating}/5 ({tool.rating_count} reviews)
              </span>
            </div>

            <h2>{tool.name}</h2>
            <p>{tool.description}</p>

            <dl className="tool-detail-meta-grid">
              <div>
                <dt>Owner</dt>
                <dd>{tool.owner.full_name || 'Unknown'}</dd>
              </div>
              <div>
                <dt>Condition</dt>
                <dd>{tool.condition}</dd>
              </div>
            </dl>
          </div>
        </article>

        {!isOwner && (
          <aside className="reservation-request-card">
            <p className="eyebrow">Reservation Request</p>
            <h2>Request this tool</h2>
            <p>Select your desired borrowing dates (HST).</p>

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

              <p className="hst-note">
                All reservation dates are in Hawaii Standard Time (HST).
              </p>

              {reserveError && <p className="form-error">{reserveError}</p>}
              {successMessage && <p className="success-message">{successMessage}</p>}

              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Reservation Request'}
              </button>
            </form>
          </aside>
        )}
      </div>
    </section>
  );
}

export default ToolDetailPage;
