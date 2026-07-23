import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toolsApi } from '../api/tools';
import { reservationsApi } from '../api/reservations';
import { reportsApi } from '../api/reports';
import type { ReportReason } from '../api/reports';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';
import type { ToolResponse } from '../types/api';

const categoryLabels: Record<string, string> = {
  HAND_TOOLS: 'Hand Tools', POWER_TOOLS: 'Power Tools', GARDEN_TOOLS: 'Garden Tools',
  CLEANING_TOOLS: 'Cleaning Tools', OUTDOOR_GEAR: 'Outdoor Gear',
};

const reportReasonOptions: { value: ReportReason; label: string }[] = [
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate Content' },
  { value: 'PROHIBITED_ITEM', label: 'Prohibited Item' },
  { value: 'MISLEADING_LISTING', label: 'Misleading Listing' },
  { value: 'SCAM_OR_FRAUD', label: 'Scam or Fraud' },
  { value: 'DUPLICATE_LISTING', label: 'Duplicate Listing' },
  { value: 'OTHER', label: 'Other' },
];

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

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason | ''>('');
  const [reportComment, setReportComment] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');
  const [isReporting, setIsReporting] = useState(false);

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
      return tool.photos[0].url;
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

  const handleReport = async () => {
    if (!toolId || !reportReason) return;
    setReportError('');
    setReportSuccess('');
    setIsReporting(true);
    try {
      await reportsApi.submit(toolId, {
        reason: reportReason,
        comment: reportComment.trim() || undefined,
      });
      setReportSuccess('Report submitted. Thank you for helping keep our community safe.');
      setShowReportModal(false);
      setReportReason('');
      setReportComment('');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setReportError(err.status === 409 ? 'You have already reported this listing.' : err.detail);
      } else {
        setReportError('Failed to submit report.');
      }
    } finally {
      setIsReporting(false);
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
          {!isOwner && user && (
            <button
              type="button"
              className="action-button danger-button"
              onClick={() => setShowReportModal(true)}
            >
              Report Listing
            </button>
          )}
          <Link className="secondary-link" to="/tools">
            Back to Browse Tools
          </Link>
        </div>
      </div>

      {reportSuccess && <p className="success-message">{reportSuccess}</p>}

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

      {/* Report Listing Modal */}
      {showReportModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setShowReportModal(false)}
        >
          <div
            className="form-card"
            style={{ maxWidth: '480px', width: '100%', margin: '1rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Report This Listing</h2>
            <p className="muted-text">
              Help us keep the community safe by reporting inappropriate or problematic listings.
            </p>

            <label htmlFor="report-reason">
              Reason *
              <select
                id="report-reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as ReportReason)}
                required
              >
                <option value="">Select a reason...</option>
                {reportReasonOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label htmlFor="report-comment">
              Comment (optional)
              <textarea
                id="report-comment"
                value={reportComment}
                onChange={(e) => setReportComment(e.target.value)}
                placeholder="Provide additional details..."
                maxLength={2000}
                rows={3}
              />
            </label>

            {reportError && <p className="form-error">{reportError}</p>}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="action-button danger-button"
                onClick={handleReport}
                disabled={isReporting || !reportReason}
              >
                {isReporting ? 'Submitting...' : 'Submit Report'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => { setShowReportModal(false); setReportError(''); }}
                disabled={isReporting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ToolDetailPage;
