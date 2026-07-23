import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reservationsApi } from '../api/reservations';
import { toolsApi } from '../api/tools';
import type { ReservationResponse, ReservationState, ToolResponse } from '../types/api';

function formatStatus(status: ReservationState): string {
  return status.replace('_', ' ');
}

function ReservationsPage() {
  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [toolMap, setToolMap] = useState<Record<string, ToolResponse>>({});
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    const fetchReservations = async () => {
      setIsLoading(true);
      setError('');
      try {
        const params: Record<string, string> = {};
        if (roleFilter) params.role = roleFilter;
        if (statusFilter) params.state = statusFilter;

        const data = await reservationsApi.list(params);
        setReservations(data.items);
        setTotal(data.total);

        // Fetch tool names for all reservations.
        const toolIds = [...new Set(data.items.map((r) => r.tool_id))];
        const tools = await Promise.allSettled(
          toolIds.map((id) => toolsApi.get(id)),
        );
        const map: Record<string, ToolResponse> = {};
        tools.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            map[toolIds[i]] = result.value;
          }
        });
        setToolMap(map);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reservations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservations();
  }, [roleFilter, statusFilter]);

  const activeReservations = reservations.filter(
    (r) => r.state === 'REQUESTED' || r.state === 'APPROVED' || r.state === 'PICKED_UP',
  );
  const completedReservations = reservations.filter(
    (r) => r.state === 'RETURNED' || r.state === 'DENIED' || r.state === 'CANCELLED',
  );

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reservations</p>
          <h1>Reservation Dashboard</h1>
          <p className="page-description">
            Review your borrower and owner reservations, check current status, and manage your workflow.
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
        >
          <option value="">All roles</option>
          <option value="borrower">As Borrower</option>
          <option value="owner">As Owner</option>
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All statuses</option>
          <option value="REQUESTED">Requested</option>
          <option value="APPROVED">Approved</option>
          <option value="PICKED_UP">Picked Up</option>
          <option value="RETURNED">Returned</option>
          <option value="DENIED">Denied</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="dashboard-summary-grid">
        <div className="summary-card">
          <span className="summary-number">{total}</span>
          <span className="summary-label">Total Reservations</span>
        </div>
        <div className="summary-card">
          <span className="summary-number">{activeReservations.length}</span>
          <span className="summary-label">Active</span>
        </div>
        <div className="summary-card">
          <span className="summary-number">{completedReservations.length}</span>
          <span className="summary-label">Completed or Closed</span>
        </div>
      </div>

      {isLoading && <p>Loading reservations...</p>}

      {!isLoading && reservations.length === 0 && (
        <div className="empty-state-card">
          <p className="eyebrow">No Reservations</p>
          <h2>No reservations found.</h2>
          <p>Try changing filters or browse tools to make a new request.</p>
        </div>
      )}

      <div className="reservation-grid">
        {reservations.map((reservation) => {
          const tool = toolMap[reservation.tool_id];
          return (
            <article className="reservation-card" key={reservation.id}>
              <div className="reservation-card-header">
                <div>
                  <h2>{tool?.name || `Tool ${reservation.tool_id.slice(0, 8)}`}</h2>
                </div>
                <span className={`workflow-status status-${reservation.state.toLowerCase()}`}>
                  {formatStatus(reservation.state)}
                </span>
              </div>

              <dl className="reservation-meta-grid">
                <div>
                  <dt>Start Date</dt>
                  <dd>{reservation.start_date}</dd>
                </div>
                <div>
                  <dt>End Date</dt>
                  <dd>{reservation.end_date}</dd>
                </div>
              </dl>

              <Link className="primary-link" to={`/reservations/${reservation.id}`}>
                View Reservation
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default ReservationsPage;
