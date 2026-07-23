import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/admin';
import type { ReservationResponse } from '../types/api';
import { ApiRequestError } from '../api/client';

/**
 * AdminReservationPage
 *
 * US34: Admin view of all reservations with filters.
 * Fetches from GET /admin/reservations.
 */
function AdminReservationPage() {
  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'All') params.state = statusFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await adminApi.listAllReservations(params);
      setReservations(data.items);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMessage(err.detail);
      } else {
        setErrorMessage('Failed to load reservations.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const clearFilters = () => {
    setStatusFilter('All');
    setDateFrom('');
    setDateTo('');
  };

  function formatStatus(status: string) {
    return status.replace(/_/g, ' ');
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US34 — Admin</p>
          <h1>Admin Reservation Overview</h1>
          <p className="page-description">
            View and filter all reservations across the platform.
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All">All Statuses</option>
          <option value="REQUESTED">Requested</option>
          <option value="APPROVED">Approved</option>
          <option value="PICKED_UP">Picked Up</option>
          <option value="RETURNED">Returned</option>
        </select>
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
        <button className="secondary-button" onClick={fetchReservations} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {errorMessage && <p className="form-error">{errorMessage}</p>}

      {!isLoading && !errorMessage && (
        <p className="results-summary">
          Showing {reservations.length} of {total} reservations.
        </p>
      )}

      {!isLoading && !errorMessage && reservations.length === 0 && (
        <div className="empty-state-card">
          <p>No reservations match the current filters.</p>
          <button type="button" onClick={clearFilters}>Clear Filters</button>
        </div>
      )}

      {!isLoading && !errorMessage && reservations.length > 0 && (
        <div className="responsive-table-wrapper">
          <table className="invite-table">
            <thead>
              <tr>
                <th>Reservation ID</th>
                <th>Tool ID</th>
                <th>Borrower ID</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id}>
                  <td><code>{r.id.slice(0, 8)}</code></td>
                  <td><code>{r.tool_id.slice(0, 8)}</code></td>
                  <td><code>{r.borrower_id.slice(0, 8)}</code></td>
                  <td>{r.start_date} to {r.end_date}</td>
                  <td>
                    <span className={`workflow-status status-${r.state.toLowerCase()}`}>
                      {formatStatus(r.state)}
                    </span>
                  </td>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default AdminReservationPage;
