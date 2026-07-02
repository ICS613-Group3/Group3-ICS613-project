import { useEffect, useState } from 'react';
import { ApiError, adminApi, type AuditLogEntry } from '../api/client';

/**
 * AdminAuditLogPage
 *
 * R1.C — admin-only. Lists every admin write (deactivate / reactivate
 * / suspend / reactivate-user) for the audit trail. Read-only for now;
 * filtering by ``action_type`` and ``target_type`` is supported by the
 * backend via query params.
 */
function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [actionType, setActionType] = useState('');
  const [targetType, setTargetType] = useState('');

  const load = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const params: { action_type?: string; target_type?: string } = {};
      if (actionType) params.action_type = actionType;
      if (targetType) params.target_type = targetType;
      const res = await adminApi.listAuditLog(params);
      setEntries(res.items);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to load audit log.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionType, targetType]);

  const clearFilters = () => {
    setActionType('');
    setTargetType('');
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">R1.C — Admin</p>
          <h1>Audit Log</h1>
          <p className="page-description">
            Every admin write (deactivate, reactivate, suspend, etc.)
            is recorded here for the R1 demo and the audit slide.
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <input
          type="text"
          placeholder="Filter by action_type (e.g. TOOL_DEACTIVATED)"
          value={actionType}
          onChange={(event) => setActionType(event.target.value)}
        />
        <input
          type="text"
          placeholder="Filter by target_type (e.g. tool, user)"
          value={targetType}
          onChange={(event) => setTargetType(event.target.value)}
        />
        <button type="button" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

      <p className="results-summary">
        {isLoading ? 'Loading…' : `Showing ${entries.length} of ${total} entries.`}
      </p>

      {errorMessage && (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading && entries.length === 0 ? (
        <div className="empty-state-card">
          <p className="eyebrow">No Entries</p>
          <h2>No audit entries match the current filters.</h2>
          <p>Try clearing the filters or perform an admin action (e.g. deactivate a tool) to generate one.</p>
          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="audit-log-list">
          {entries.map((entry) => (
            <article className="audit-log-card" key={entry.id}>
              <div className="audit-log-header">
                <h3>{entry.action_type}</h3>
                <span className="audit-log-target">
                  {entry.target_type} · {entry.target_id.slice(0, 8)}
                </span>
              </div>
              <p className="audit-log-reason">{entry.reason || '(no reason given)'}</p>
              <p className="audit-log-meta">
                {entry.actor_id ? `actor ${entry.actor_id.slice(0, 8)}` : 'system'} ·{' '}
                {new Date(entry.created_at).toLocaleString()}
              </p>
              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <details className="audit-log-details">
                  <summary>metadata</summary>
                  <pre>{JSON.stringify(entry.metadata, null, 2)}</pre>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AdminAuditLogPage;
