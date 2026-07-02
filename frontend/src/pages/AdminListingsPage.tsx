import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  absolutePhotoUrl,
  ApiError,
  adminApi,
  toolsApi,
  type Tool,
  type ToolCategory,
} from '../api/client';

/**
 * AdminListingsPage (US11)
 *
 * Admin-only listing management. Lists ALL tool listings (active and
 * deactivated) across all owners, with deactivate / reactivate actions.
 *
 * Backend endpoints:
 *   GET    /tools/admin/all          — admin-only, all tools
 *   POST   /tools/{id}/deactivate    — owner or admin
 *   POST   /tools/{id}/reactivate    — admin only
 */
const categoryLabels: Record<ToolCategory, string> = {
  HAND_TOOLS: 'Hand Tools',
  POWER_TOOLS: 'Power Tools',
  GARDEN_TOOLS: 'Garden Tools',
  CLEANING_TOOLS: 'Cleaning Tools',
  OUTDOOR_GEAR: 'Outdoor Gear',
};

const categoryOptions: ToolCategory[] = [
  'HAND_TOOLS',
  'POWER_TOOLS',
  'GARDEN_TOOLS',
  'CLEANING_TOOLS',
  'OUTDOOR_GEAR',
];

type StatusFilter = '' | 'active' | 'inactive';

function AdminListingsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ToolCategory | ''>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const [deactivateFor, setDeactivateFor] = useState<Tool | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const params: {
          search?: string;
          category?: ToolCategory;
          status?: 'active' | 'inactive';
          page_size?: number;
        } = { page_size: 100 };
        if (searchTerm.trim()) params.search = searchTerm.trim();
        if (categoryFilter) params.category = categoryFilter;
        if (statusFilter) params.status = statusFilter;
        const res = await adminApi.listAllTools(params);
        if (!cancelled) {
          setTools(res.items);
          setTotal(res.total);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) setErrorMessage(err.message);
          else setErrorMessage('Failed to load tool listings.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    const timeout = setTimeout(load, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchTerm, categoryFilter, statusFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setStatusFilter('');
  };

  const handleDeactivate = async () => {
    if (!deactivateFor) return;
    if (!deactivateReason.trim()) {
      setErrorMessage('A reason is required to deactivate a listing.');
      return;
    }
    setIsActing(true);
    setActionMessage('');
    setErrorMessage('');
    try {
      await toolsApi.deactivate(deactivateFor.id, deactivateReason.trim());
      setActionMessage(`Deactivated "${deactivateFor.name}". Pending reservations were auto-cancelled.`);
      setDeactivateFor(null);
      setDeactivateReason('');
      // Reload
      const params: { status?: 'active' | 'inactive'; category?: ToolCategory; search?: string; page_size?: number } = { page_size: 100 };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await adminApi.listAllTools(params);
      setTools(res.items);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to deactivate tool.');
    } finally {
      setIsActing(false);
    }
  };

  const handleReactivate = async (tool: Tool) => {
    setIsActing(true);
    setActionMessage('');
    setErrorMessage('');
    try {
      await toolsApi.reactivate(tool.id);
      setActionMessage(`Reactivated "${tool.name}".`);
      // Reload
      const params: { status?: 'active' | 'inactive'; category?: ToolCategory; search?: string; page_size?: number } = { page_size: 100 };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await adminApi.listAllTools(params);
      setTools(res.items);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to reactivate tool.');
    } finally {
      setIsActing(false);
    }
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US11 — Admin · Listing Management</p>
          <h1>All Tool Listings</h1>
          <p className="page-description">
            Manage every tool listing on the platform. Deactivate listings
            that violate policy or reactivate previously deactivated ones.
            All actions are audit-logged.
          </p>
        </div>
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

      <div className="filter-panel">
        <input
          type="text"
          placeholder="Search by tool name or description"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <select
          value={categoryFilter}
          onChange={(event) =>
            setCategoryFilter(event.target.value as ToolCategory | '')
          }
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {categoryLabels[cat]}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Deactivated only</option>
        </select>

        <button type="button" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

      <p className="results-summary">
        {isLoading ? 'Loading…' : `Showing ${tools.length} of ${total} listings.`}
      </p>

      {isLoading ? (
        <p>Loading…</p>
      ) : tools.length === 0 ? (
        <div className="empty-state-card">
          <p className="eyebrow">No Listings</p>
          <h2>No tool listings match the current filters.</h2>
          <p>Try clearing filters or adjusting your search.</p>
          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      ) : (
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
                    <span className={`status-badge${!tool.is_active ? ' status-badge-inactive' : ''}`}>
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
                  <dl className="tool-meta">
                    <div>
                      <dt>Owner</dt>
                      <dd>{tool.owner.full_name ?? 'Anonymous'}</dd>
                    </div>
                    <div>
                      <dt>Category</dt>
                      <dd>{categoryLabels[tool.category]}</dd>
                    </div>
                  </dl>
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
                      <button
                        type="button"
                        className="action-button danger-button"
                        onClick={() => setDeactivateFor(tool)}
                        disabled={isActing}
                      >
                        Deactivate
                      </button>
                    )}
                    {!tool.is_active && (
                      <button
                        type="button"
                        className="action-button approve-button"
                        onClick={() => handleReactivate(tool)}
                        disabled={isActing}
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {deactivateFor && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Deactivate "{deactivateFor.name}"</h2>
            <p>
              The tool will be hidden from the browse page. Any
              REQUESTED or APPROVED reservations will be auto-cancelled.
              This action is audit-logged.
            </p>
            <label>
              Reason (required, shown to owner and audit log)
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

export default AdminListingsPage;
