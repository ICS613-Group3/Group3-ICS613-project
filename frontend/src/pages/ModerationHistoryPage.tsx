import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/admin';
import type { AuditLogEntry } from '../api/admin';
import { ApiRequestError } from '../api/client';

/**
 * ModerationHistoryPage
 *
 * US32: Admin view of moderation history / audit log.
 * Fetches from GET /admin/audit-log.
 */
function ModerationHistoryPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [actionFilter, setActionFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchAuditLog = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const params: Record<string, string> = {};
      if (actionFilter) params.action_type = actionFilter;
      if (targetFilter) params.target_type = targetFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await adminApi.getAuditLog(params);
      setEntries(data.items);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMessage(err.detail);
      } else {
        setErrorMessage('Failed to load audit log.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, targetFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const clearFilters = () => {
    setActionFilter('');
    setTargetFilter('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US32 — Moderation History</p>
          <h1>Moderation History</h1>
          <p className="page-description">
            View the full audit log of moderation actions.
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <input
          type="text"
          placeholder="Action type (e.g. SUSPEND, DEACTIVATE)"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        />
        <input
          type="text"
          placeholder="Target type (e.g. USER, TOOL)"
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value)}
        />
        <input
          type="date"
          aria-label="Date from"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <input
          type="date"
          aria-label="Date to"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
        <button className="secondary-button" onClick={clearFilters}>
          Clear Filters
        </button>
        <button className="secondary-button" onClick={fetchAuditLog} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {errorMessage && <p className="form-error">{errorMessage}</p>}

      {!isLoading && !errorMessage && (
        <p className="results-summary">
          Showing {entries.length} of {total} entries.
        </p>
      )}

      {!isLoading && !errorMessage && entries.length === 0 && (
        <div className="empty-state-card">
          <p>No audit log entries match the current filters.</p>
          <button type="button" onClick={clearFilters}>Clear Filters</button>
        </div>
      )}

      {!isLoading && !errorMessage && entries.length > 0 && (
        <div className="responsive-table-wrapper">
          <table className="invite-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target Type</th>
                <th>Target ID</th>
                <th>Reason</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td><code>{entry.id.slice(0, 8)}</code></td>
                  <td>{entry.action_type}</td>
                  <td><code>{entry.actor_id?.slice(0, 8) || '—'}</code></td>
                  <td>{entry.target_type}</td>
                  <td><code>{entry.target_id?.slice(0, 8) || '—'}</code></td>
                  <td>{entry.reason || '—'}</td>
                  <td>{entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default ModerationHistoryPage;
