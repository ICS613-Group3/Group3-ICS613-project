// My Tools page — shows tools owned by the current user.
// Uses GET /tools/me endpoint.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toolsApi } from '../api/tools';
import type { ToolResponse } from '../types/api';

const categoryLabels: Record<string, string> = {
  HAND_TOOLS: 'Hand Tools',
  POWER_TOOLS: 'Power Tools',
  GARDEN_TOOLS: 'Garden Tools',
  CLEANING_TOOLS: 'Cleaning Tools',
  OUTDOOR_GEAR: 'Outdoor Gear',
};

const conditionLabels: Record<string, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
};

function MyToolsPage() {
  const [tools, setTools] = useState<ToolResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  const fetchTools = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await toolsApi.listMy();
      setTools(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your tools');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const handleDelete = async (toolId: string, toolName: string) => {
    setActionMessage('');
    try {
      await toolsApi.delete(toolId);
      setActionMessage(`${toolName} has been deleted.`);
      setDeleteConfirm(null);
      await fetchTools();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to delete tool.');
    }
  };

  // Client-side filtering for search and status
  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      !search.trim() ||
      tool.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      (tool.description || '').toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'active' && tool.is_active) ||
      (statusFilter === 'inactive' && !tool.is_active);
    return matchesSearch && matchesStatus;
  });

  const activeCount = tools.filter((t) => t.is_active).length;
  const inactiveCount = tools.filter((t) => !t.is_active).length;

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">My Listings</p>
          <h1>My Tools</h1>
          <p className="page-description">
            Manage your tool listings. Create new listings, edit existing ones, or deactivate tools
            you no longer want to share.
          </p>
        </div>
        <Link className="primary-button header-action-link" to="/tools/new">
          + New Tool
        </Link>
      </div>

      {/* Summary cards */}
      <div className="admin-listing-summary-grid">
        <article className="summary-card">
          <strong>{total}</strong>
          <span>Total Tools</span>
        </article>
        <article className="summary-card">
          <strong>{activeCount}</strong>
          <span>Active</span>
        </article>
        <article className="summary-card">
          <strong>{inactiveCount}</strong>
          <span>Inactive</span>
        </article>
      </div>

      {/* Filter panel */}
      <section className="admin-listing-filter-panel">
        <label htmlFor="my-tools-search">
          Search
          <input
            id="my-tools-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tool name"
          />
        </label>
        <label htmlFor="my-tools-status-filter">
          Status
          <select
            id="my-tools-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </section>

      {error && <p className="form-error">{error}</p>}
      {actionMessage && <p className="success-message">{actionMessage}</p>}
      {isLoading && <p>Loading your tools...</p>}

      {/* Tools grid */}
      {!isLoading && !error && (
        <>
          <p className="results-summary">
            Showing {filteredTools.length} of {total} tools.
          </p>

          {filteredTools.length > 0 ? (
            <section className="admin-listings-grid">
              {filteredTools.map((tool) => (
                <article className="admin-listing-card" key={tool.id}>
                  <div className="admin-listing-card-header">
                    <div>
                      <p className="eyebrow">
                        {categoryLabels[tool.category] || tool.category}
                      </p>
                      <h2>{tool.name}</h2>
                      <p>{tool.description || 'No description provided.'}</p>
                    </div>
                    <span
                      className={
                        tool.is_active
                          ? 'admin-listing-status admin-listing-status-active'
                          : 'admin-listing-status admin-listing-status-deactivated'
                      }
                    >
                      {tool.is_active ? 'active' : 'inactive'}
                    </span>
                  </div>

                  <dl className="admin-listing-meta-grid">
                    <div>
                      <dt>Condition</dt>
                      <dd>{conditionLabels[tool.condition] || tool.condition}</dd>
                    </div>
                    <div>
                      <dt>Rating</dt>
                      <dd>
                        {tool.avg_rating}/5 ({tool.rating_count}{' '}
                        {tool.rating_count === 1 ? 'review' : 'reviews'})
                      </dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{new Date(tool.created_at).toLocaleDateString()}</dd>
                    </div>
                  </dl>

                  {tool.deactivation_reason && (
                    <p className="form-error">
                      <strong>Deactivation reason:</strong> {tool.deactivation_reason}
                    </p>
                  )}

                  <div className="admin-listing-actions">
                    <Link
                      className="primary-link"
                      to={`/tools/${tool.id}`}
                    >
                      View
                    </Link>
                    <Link
                      className="secondary-link"
                      to={`/tools/${tool.id}/edit`}
                    >
                      Edit
                    </Link>
                    {deleteConfirm === tool.id ? (
                      <div className="inline-action-form">
                        <span>Delete this tool?</span>
                        <button
                          type="button"
                          className="action-button danger-button"
                          onClick={() => handleDelete(tool.id, tool.name)}
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="action-button danger-button"
                        onClick={() => setDeleteConfirm(tool.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <section className="empty-state-card">
              <h2>No tools found</h2>
              <p>
                {search || statusFilter
                  ? 'Try changing the search or status filter.'
                  : "You haven't listed any tools yet. Create your first listing!"}
              </p>
              {!search && !statusFilter && (
                <Link className="primary-button" to="/tools/new">
                  + Create Your First Tool
                </Link>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}

export default MyToolsPage;
