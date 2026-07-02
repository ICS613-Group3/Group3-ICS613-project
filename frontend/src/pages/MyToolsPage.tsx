import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  absolutePhotoUrl,
  ApiError,
  toolsApi,
  type Tool,
} from '../api/client';

/**
 * MyToolsPage
 *
 * US10 — list the current user's tool listings (active and deactivated)
 * with one-click delete and deactivate/reactivate actions. R1 backend
 * also exposes an admin-only ``POST /tools/{id}/reactivate``; non-admin
 * tools are owned by the user and cannot be reactivated by the owner
 * (deactivation is permanent for non-admins).
 */
function MyToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [actionMessage, setActionMessage] = useState('');
  const [deactivateFor, setDeactivateFor] = useState<Tool | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isActing, setIsActing] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await toolsApi.listMy({ page_size: 50 });
      setTools(res.items);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to load your tools.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (tool: Tool) => {
    if (!window.confirm(`Delete "${tool.name}"? This is permanent.`)) return;
    setActionMessage('');
    setIsActing(true);
    try {
      await toolsApi.delete(tool.id);
      setActionMessage(`Deleted "${tool.name}".`);
      await load();
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to delete tool.');
    } finally {
      setIsActing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateFor) return;
    if (!deactivateReason.trim()) {
      setErrorMessage('A reason is required to deactivate a listing.');
      return;
    }
    setIsActing(true);
    try {
      await toolsApi.deactivate(deactivateFor.id, deactivateReason.trim());
      setActionMessage(`Deactivated "${deactivateFor.name}". Pending reservations were auto-cancelled.`);
      setDeactivateFor(null);
      setDeactivateReason('');
      await load();
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to deactivate tool.');
    } finally {
      setIsActing(false);
    }
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US10 — My Listings</p>
          <h1>My Tool Listings</h1>
          <p className="page-description">
            Manage the tools you have listed for sharing. Active tools
            are visible to everyone; deactivated tools are hidden from
            the browse page and any pending reservations are
            auto-cancelled.
          </p>
        </div>
        <Link className="primary-link" to="/tools/new">
          + Add a new tool
        </Link>
      </div>

      {actionMessage && (
        <div className="success-message" role="status">
          {actionMessage}
        </div>
      )}
      {errorMessage && (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      )}

      {isLoading ? (
        <p>Loading…</p>
      ) : tools.length === 0 ? (
        <div className="empty-state-card">
          <p className="eyebrow">No Tools Yet</p>
          <h2>You haven't listed any tools.</h2>
          <p>Create your first listing so other members can borrow it.</p>
          <Link className="primary-link" to="/tools/new">
            Create a tool
          </Link>
        </div>
      ) : (
        <>
          <p className="results-summary">{total} listing{total === 1 ? '' : 's'}.</p>
          <div className="tool-grid">
            {tools.map((tool) => {
              const photo = tool.photos[0];
              const imageUrl = photo ? absolutePhotoUrl(photo.url) : '';
              return (
                <article
                  className={`tool-card${!tool.is_active ? ' tool-card-inactive' : ''}`}
                  key={tool.id}
                >
                  {imageUrl ? (
                    <img src={imageUrl} alt={tool.name} className="tool-image" />
                  ) : (
                    <div className="tool-image tool-image-placeholder">No photo</div>
                  )}
                  <div className="tool-card-body">
                    <div className="tool-card-top">
                      <span className="status-badge">
                        {tool.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                      </span>
                      <span className="rating">
                        {tool.rating_count > 0
                          ? `★ ${tool.avg_rating.toFixed(1)} (${tool.rating_count})`
                          : 'No reviews'}
                      </span>
                    </div>
                    <h2>{tool.name}</h2>
                    <p>{tool.description ?? 'No description provided.'}</p>
                    {tool.deactivation_reason && (
                      <p className="tool-deactivation-reason">
                        <strong>Deactivation reason:</strong> {tool.deactivation_reason}
                      </p>
                    )}
                    <div className="tool-card-actions">
                      <Link className="primary-link" to={`/tools/${tool.id}`}>
                        View
                      </Link>
                      {tool.is_active && (
                        <Link className="secondary-link" to={`/tools/${tool.id}/edit`}>
                          Edit
                        </Link>
                      )}
                      {tool.is_active && (
                        <button
                          type="button"
                          className="action-button danger-button"
                          onClick={() => setDeactivateFor(tool)}
                          disabled={isActing}
                        >
                          Deactivate
                        </button>
                      )}
                      <button
                        type="button"
                        className="action-button danger-button"
                        onClick={() => handleDelete(tool)}
                        disabled={isActing}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {deactivateFor && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Deactivate "{deactivateFor.name}"</h2>
            <p>
              The tool will be hidden from the browse page. Any
              ``REQUESTED`` or ``APPROVED`` reservations will be
              auto-cancelled.
            </p>
            <label>
              Reason (required, shown to borrowers and audit log)
              <textarea
                value={deactivateReason}
                onChange={(event) => setDeactivateReason(event.target.value)}
                rows={3}
                maxLength={2000}
                required
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-link"
                onClick={() => {
                  setDeactivateFor(null);
                  setDeactivateReason('');
                  setErrorMessage('');
                }}
                disabled={isActing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="action-button danger-button"
                onClick={handleDeactivate}
                disabled={isActing || !deactivateReason.trim()}
              >
                {isActing ? 'Deactivating…' : 'Deactivate listing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default MyToolsPage;
