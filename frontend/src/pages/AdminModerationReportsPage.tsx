import { useCallback, useState } from 'react';
import { adminApi } from '../api/admin';
import type { ModerationReport } from '../api/admin';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';

function AdminModerationReportsPage() {
  const { user } = useAuth();
  const [report, setReport] = useState<ModerationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const generateReport = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    setReport(null);
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await adminApi.getModerationReport(params);
      setReport(data);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.detail : 'Failed to generate report.');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  const exportCsv = async () => {
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await adminApi.exportModerationReportCsv(params);
      const blob = new Blob([data.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'moderation_report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.detail : 'Export failed.');
    }
  };

  if (!user?.is_admin) {
    return (
      <section className="page-section">
        <div className="empty-state-card">
          <h1>Access Denied</h1>
          <p>You must be an admin to view moderation reports.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US33 — Moderation Reports</p>
          <h1>Community Moderation Report</h1>
          <p className="page-description">
            Generate and export moderation activity reports with date range filtering.
          </p>
        </div>
      </div>

      <div className="filter-panel">
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
        <button className="primary-button" onClick={generateReport} disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate Report'}
        </button>
        {report && (
          <button className="secondary-button" onClick={exportCsv}>
            Export CSV
          </button>
        )}
      </div>

      {errorMessage && <p className="form-error">{errorMessage}</p>}

      {!isLoading && !report && !errorMessage && (
        <div className="empty-state-card">
          <p>Select a date range and click "Generate Report" to view moderation activity.</p>
        </div>
      )}

      {report && (
        <>
          {/* Summary cards */}
          <div className="admin-listing-summary-grid">
            <article className="summary-card">
              <strong>{report.summary.total_reports}</strong>
              <span>Total Reports</span>
            </article>
            <article className="summary-card">
              <strong>{report.summary.pending_reports}</strong>
              <span>Pending</span>
            </article>
            <article className="summary-card">
              <strong>{report.summary.valid_reports}</strong>
              <span>Valid</span>
            </article>
            <article className="summary-card">
              <strong>{report.summary.invalid_reports}</strong>
              <span>Invalid</span>
            </article>
            <article className="summary-card">
              <strong>{report.summary.total_suspensions}</strong>
              <span>Suspensions</span>
            </article>
            <article className="summary-card">
              <strong>{report.summary.total_reactivations}</strong>
              <span>Reactivations</span>
            </article>
            <article className="summary-card">
              <strong>{report.summary.total_tool_deactivations}</strong>
              <span>Tool Deactivations</span>
            </article>
            <article className="summary-card">
              <strong>{report.summary.total_tool_reactivations}</strong>
              <span>Tool Reactivations</span>
            </article>
            <article className="summary-card">
              <strong>{report.summary.total_account_deletions}</strong>
              <span>Account Deletions</span>
            </article>
            <article className="summary-card">
              <strong>{report.summary.active_reservations}</strong>
              <span>Active Reservations</span>
            </article>
          </div>

          {/* Records table */}
          {report.records.length > 0 && (
            <div className="responsive-table-wrapper">
              <table className="invite-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Target Type</th>
                    <th>Target ID</th>
                    <th>Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {report.records.map((rec) => (
                    <tr key={rec.id}>
                      <td>{rec.action_type}</td>
                      <td>{rec.target_type}</td>
                      <td><code>{String(rec.target_id).slice(0, 8)}</code></td>
                      <td>{rec.reason || '—'}</td>
                      <td>{new Date(rec.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.records.length === 0 && (
            <div className="empty-state-card">
              <p>No records found for the selected date range.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default AdminModerationReportsPage;
