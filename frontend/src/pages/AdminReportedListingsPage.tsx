import { useCallback, useEffect, useState } from 'react';
import { reportsApi } from '../api/reports';
import type { ReportResponse } from '../api/reports';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';

const reasonLabels: Record<string, string> = {
  INAPPROPRIATE_CONTENT: 'Inappropriate Content',
  PROHIBITED_ITEM: 'Prohibited Item',
  MISLEADING_LISTING: 'Misleading Listing',
  SCAM_OR_FRAUD: 'Scam or Fraud',
  DUPLICATE_LISTING: 'Duplicate Listing',
  OTHER: 'Other',
};

function AdminReportedListingsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const [statusFilter, setStatusFilter] = useState('');
  const [resolveNote, setResolveNote] = useState<Record<string, string>>({});

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const data = await reportsApi.list({ ...params, page_size: 100 });
      setReports(data.items);
      setTotal(data.total);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.detail : 'Failed to load reports.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleResolve = async (reportId: string, valid: boolean) => {
    const note = resolveNote[reportId]?.trim() || undefined;
    setActionMessage('');
    try {
      await reportsApi.resolve(reportId, { valid, note });
      setActionMessage(valid ? 'Report marked valid — listing deactivated.' : 'Report marked invalid.');
      setResolveNote((prev) => ({ ...prev, [reportId]: '' }));
      await fetchReports();
    } catch (err) {
      setActionMessage(err instanceof ApiRequestError ? err.detail : 'Resolution failed.');
    }
  };

  if (!user?.is_admin) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <h1>Access Denied</h1>
          <p>You must be an admin to review reports.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US27 — Reported Listings</p>
          <h1>Review Reported Listings</h1>
          <p className="page-description">
            Review member-submitted reports and resolve them as valid or invalid.
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="VALID">Valid</option>
          <option value="INVALID">Invalid</option>
        </select>
        <button className="secondary-button" onClick={fetchReports} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {errorMessage && <p className="form-error">{errorMessage}</p>}
      {actionMessage && <p className="success-message">{actionMessage}</p>}
      {isLoading && <p>Loading reports...</p>}

      {!isLoading && !errorMessage && (
        <p className="results-summary">
          Showing {reports.length} of {total} reports.
        </p>
      )}

      {!isLoading && reports.length === 0 && (
        <div className="empty-state-card">
          <h2>No reports found</h2>
          <p>No reports match the current filter.</p>
        </div>
      )}

      {!isLoading && reports.length > 0 && (
        <div className="responsive-table-wrapper">
          <table className="invite-table">
            <thead>
              <tr>
                <th>Tool</th>
                <th>Reporter</th>
                <th>Reason</th>
                <th>Comment</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.tool_name || r.tool_id.slice(0, 8)}</td>
                  <td>{r.reporter_name || r.reporter_id.slice(0, 8)}</td>
                  <td>{reasonLabels[r.reason] || r.reason}</td>
                  <td>{r.comment || '—'}</td>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`workflow-status status-${r.status.toLowerCase()}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>
                    {r.status === 'PENDING' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <input
                          type="text"
                          placeholder="Optional note"
                          value={resolveNote[r.id] ?? ''}
                          onChange={(e) => setResolveNote((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="action-button approve-button"
                            onClick={() => handleResolve(r.id, true)}
                          >
                            Valid
                          </button>
                          <button
                            type="button"
                            className="action-button danger-button"
                            onClick={() => handleResolve(r.id, false)}
                          >
                            Invalid
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="muted-text">
                        {r.resolver_name ? `Resolved by ${r.resolver_name}` : 'Resolved'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default AdminReportedListingsPage;
