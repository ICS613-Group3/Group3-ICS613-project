import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toolsApi } from '../api/tools';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';
import type { ToolResponse } from '../types/api';

const categoryLabels: Record<string, string> = {
  HAND_TOOLS: 'Hand Tools', POWER_TOOLS: 'Power Tools', GARDEN_TOOLS: 'Garden Tools',
  CLEANING_TOOLS: 'Cleaning Tools', OUTDOOR_GEAR: 'Outdoor Gear',
};

function AdminListingsPage() {
  const { user } = useAuth();
  const [tools, setTools] = useState<ToolResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deactivationReason, setDeactivationReason] = useState<Record<string, string>>({});

  const fetchTools = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const data = await toolsApi.adminListAll(params);
      setTools(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTools();
  }, [fetchTools]);

  const handleDeactivate = async (toolId: string, toolName: string) => {
    const reason = deactivationReason[toolId]?.trim();
    if (!reason) {
      setActionMessage('A deactivation reason is required.');
      return;
    }
    setActionMessage('');
    try {
      const updated = await toolsApi.deactivate(toolId, { reason });
      setTools((prev) => prev.map((t) => (t.id === toolId ? updated : t)));
      setActionMessage(`${toolName} deactivated.`);
      setDeactivationReason((prev) => ({ ...prev, [toolId]: '' }));
    } catch (err) {
      setActionMessage(err instanceof ApiRequestError ? err.detail : 'Deactivation failed.');
    }
  };

  const handleReactivate = async (toolId: string, toolName: string) => {
    setActionMessage('');
    try {
      const updated = await toolsApi.reactivate(toolId);
      setTools((prev) => prev.map((t) => (t.id === toolId ? updated : t)));
      setActionMessage(`${toolName} reactivated.`);
    } catch (err) {
      setActionMessage(err instanceof ApiRequestError ? err.detail : 'Reactivation failed.');
    }
  };

  if (!user?.is_admin) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <h1>Access Denied</h1>
          <p>You must be an admin to view this page.</p>
          <Link className="primary-link" to="/dashboard">Back to Dashboard</Link>
        </div>
      </section>
    );
  }

  const activeCount = tools.filter((t) => t.is_active).length;
  const deactivatedCount = tools.filter((t) => !t.is_active).length;

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US11 Admin Listing Controls</p>
          <h1>Admin Listing Management</h1>
          <p className="page-description">
            Review and manage all tool listings. Deactivate problematic listings or reactivate previously deactivated ones.
          </p>
        </div>
        <Link className="secondary-link header-action-link" to="/admin/invites">Admin Invites</Link>
      </div>

      <div className="admin-listing-summary-grid">
        <article className="summary-card"><strong>{total}</strong><span>Total Listings</span></article>
        <article className="summary-card"><strong>{activeCount}</strong><span>Active</span></article>
        <article className="summary-card"><strong>{deactivatedCount}</strong><span>Deactivated</span></article>
      </div>

      <section className="admin-listing-filter-panel">
        <label htmlFor="admin-listing-search">
          Search Listings
          <input id="admin-listing-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by tool name" />
        </label>
        <label htmlFor="admin-listing-status-filter">
          Status Filter
          <select id="admin-listing-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </select>
        </label>
      </section>

      {error && <p className="form-error">{error}</p>}
      {actionMessage && <p className="success-message">{actionMessage}</p>}
      {isLoading && <p>Loading listings...</p>}

      <section className="admin-listings-grid">
        {tools.map((tool) => {
          const reason = deactivationReason[tool.id] ?? '';
          return (
            <article className="admin-listing-card" key={tool.id}>
              <div className="admin-listing-card-header">
                <div>
                  <p className="eyebrow">{categoryLabels[tool.category] || tool.category}</p>
                  <h2>{tool.name}</h2>
                  <p>{tool.description}</p>
                </div>
                <span className={tool.is_active ? 'admin-listing-status admin-listing-status-active' : 'admin-listing-status admin-listing-status-deactivated'}>
                  {tool.is_active ? 'active' : 'deactivated'}
                </span>
              </div>

              <dl className="admin-listing-meta-grid">
                <div><dt>Owner</dt><dd>{tool.owner.full_name || 'Unknown'}</dd></div>
                <div><dt>Condition</dt><dd>{tool.condition}</dd></div>
                <div><dt>Rating</dt><dd>{tool.avg_rating}/5 ({tool.rating_count})</dd></div>
              </dl>

              {tool.deactivation_reason && (
                <p><strong>Deactivation reason:</strong> {tool.deactivation_reason}</p>
              )}

              <div className="admin-listing-actions">
                {tool.is_active ? (
                  <>
                    <label htmlFor={`reason-${tool.id}`}>
                      Reason *
                      <input id={`reason-${tool.id}`} type="text" value={reason} onChange={(e) => setDeactivationReason((prev) => ({ ...prev, [tool.id]: e.target.value }))} placeholder="Why deactivate?" />
                    </label>
                    <button type="button" className="action-button danger-button" onClick={() => handleDeactivate(tool.id, tool.name)} disabled={!reason.trim()}>
                      Deactivate
                    </button>
                  </>
                ) : (
                  <button type="button" className="action-button approve-button" onClick={() => handleReactivate(tool.id, tool.name)}>
                    Reactivate
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {!isLoading && tools.length === 0 && (
        <section className="empty-state-card">
          <h2>No listings found</h2>
          <p>Try changing the search or status filter.</p>
        </section>
      )}
    </section>
  );
}

export default AdminListingsPage;
