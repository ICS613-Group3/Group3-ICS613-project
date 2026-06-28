import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mockTools } from '../data/mockData';

/**
 * ToolDetailPage
 *
 * This page shows one tool listing based on the URL parameter.
 * Example route:
 * /tools/tool-1
 *
 * For R1 demo purposes, this page uses mock data instead of calling
 * the backend API. Later, mockTools can be replaced with a real API call.
 */
function ToolDetailPage() {
  // Read the toolId from the route path: /tools/:toolId
  const { toolId } = useParams();

  // Find the matching tool from the mock data file.
  const tool = mockTools.find((mockTool) => mockTool.id === toolId);

  // Local form state for the mock reservation request form.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * Handles the mock reservation request form.
   *
   * This does not create a real backend reservation yet.
   * It only shows a success message so the R1 demo can show the workflow:
   * Browse Tool -> View Details -> Submit Reservation Request.
   */
  const handleReservationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Basic frontend validation for the mock demo.
    if (!startDate || !endDate) {
      setSuccessMessage('Please select both a start date and an end date.');
      return;
    }

    if (endDate < startDate) {
      setSuccessMessage('End date cannot be before start date.');
      return;
    }

    setSuccessMessage(
      `Mock request submitted for ${tool?.name} from ${startDate} to ${endDate}. Status: REQUESTED.`,
    );
  };

  // Show a friendly message when the user opens a tool ID that does not exist.
  if (!tool) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <p className="eyebrow">Tool Not Found</p>
          <h1>We could not find this tool.</h1>
          <p>
            The selected tool may no longer exist or the link may be incorrect.
          </p>
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
            Review the tool information, owner notes, availability, and submit a
            mock reservation request using Hawaii Standard Time (HST) dates.
          </p>
        </div>

        <Link className="secondary-link" to="/tools">
          Back to Browse Tools
        </Link>
      </div>

      <div className="tool-detail-grid">
        {/* Left side: detailed tool listing information. */}
        <article className="tool-detail-card">
          <img src={tool.imageUrl} alt={tool.name} className="detail-image" />

          <div className="tool-detail-content">
            <div className="tool-card-top">
              <span className="status-badge">{tool.category}</span>
              <span className="rating">? {tool.rating}</span>
            </div>

            <h2>{tool.name}</h2>
            <p>{tool.description}</p>

            <dl className="detail-meta-grid">
              <div>
                <dt>Owner</dt>
                <dd>{tool.ownerName}</dd>
              </div>

              <div>
                <dt>Condition</dt>
                <dd>{tool.condition}</dd>
              </div>

              <div>
                <dt>Availability</dt>
                <dd>{tool.availability}</dd>
              </div>

              <div>
                <dt>Latest return time</dt>
                <dd>{tool.latestReturnTime} HST</dd>
              </div>
            </dl>

            <div className="info-panel">
              <h3>Owner Notes</h3>
              <p>{tool.notesForBorrowers}</p>
            </div>
          </div>
        </article>

        {/* Right side: reservation request form for borrower workflow. */}
        <aside className="reservation-request-card">
          <p className="eyebrow">Reservation Request</p>
          <h2>Request this tool</h2>
          <p>
            Select your desired borrowing dates. For this R1 frontend demo, the
            form shows the planned REQUESTED workflow using mock data.
          </p>

          <form className="reservation-form" onSubmit={handleReservationSubmit}>
            <label>
              Start Date
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </label>

            <label>
              End Date
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </label>

            <label>
              Message to Owner
              <textarea
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value)}
                placeholder="Optional note for the tool owner"
                rows={4}
              />
            </label>

            <p className="hst-note">
              All reservation dates are interpreted in Hawaii Standard Time
              (HST).
            </p>

            <button type="submit">Submit Reservation Request</button>
          </form>

          {/* This message simulates the backend response for the demo. */}
          {successMessage && (
            <div className="success-message" role="status">
              {successMessage}
            </div>
          )}

          {requestNote && (
            <div className="info-panel request-preview">
              <h3>Request Note Preview</h3>
              <p>{requestNote}</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

export default ToolDetailPage;
