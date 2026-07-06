import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api/admin';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';
import type { UserProfile } from '../types/api';

const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  EMAIL_PENDING: 'Email Pending',
  SUSPENDED: 'Suspended',
  DELETED: 'Deleted',
};

function AdminMembersPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Per-user action state
  const [actingUserId, setActingUserId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const data = await adminApi.listUsers(params);
      setMembers(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSuspend = async (userId: string) => {
    if (!suspendReason.trim()) return;
    setActingUserId(userId);
    setActionMessage('');
    try {
      await adminApi.suspendUser(userId);
      setActionMessage('User suspended successfully.');
      setSuspendTarget(null);
      setSuspendReason('');
      await fetchMembers();
    } catch (err) {
      setActionMessage(err instanceof ApiRequestError ? err.detail : 'Suspend failed.');
    } finally {
      setActingUserId(null);
    }
  };

  const handleReactivate = async (userId: string) => {
    setActingUserId(userId);
    setActionMessage('');
    try {
      await adminApi.unsuspendUser(userId);
      setActionMessage('User reactivated successfully.');
      await fetchMembers();
    } catch (err) {
      setActionMessage(err instanceof ApiRequestError ? err.detail : 'Reactivation failed.');
    } finally {
      setActingUserId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!deleteReason.trim()) return;
    setActingUserId(userId);
    setActionMessage('');
    try {
      await adminApi.deleteUser(userId, deleteReason.trim());
      setActionMessage('User deleted successfully.');
      setDeleteTarget(null);
      setDeleteReason('');
      await fetchMembers();
    } catch (err) {
      setActionMessage(err instanceof ApiRequestError ? err.detail : 'Deletion failed.');
    } finally {
      setActingUserId(null);
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

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Member Management</h1>
          <p className="page-description">
            View all registered members, filter by status, and search by name or email.
          </p>
        </div>
      </div>

      <div className="admin-listing-filter-panel">
        <label htmlFor="admin-member-search">
          Search
          <input
            id="admin-member-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
          />
        </label>
        <label htmlFor="admin-member-status">
          Status
          <select
            id="admin-member-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="EMAIL_PENDING">Email Pending</option>
          </select>
        </label>
      </div>

      {actionMessage && <p className={actionMessage.includes('failed') ? 'form-error' : 'success-message'}>{actionMessage}</p>}
      {error && <p className="form-error">{error}</p>}
      {isLoading && <p>Loading members...</p>}

      {!isLoading && !error && (
        <p className="results-summary">Showing {members.length} of {total} members.</p>
      )}

      {!isLoading && !error && members.length > 0 && (
        <div className="responsive-table-wrapper">
          <table className="invite-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Status</th>
                <th>Admin</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.email}</td>
                  <td>{m.full_name || '—'}</td>
                  <td>
                    <span className={`invite-status invite-status-${m.status.toLowerCase()}`}>
                      {statusLabels[m.status] || m.status}
                    </span>
                  </td>
                  <td>{m.is_admin ? 'Yes' : 'No'}</td>
                  <td>{new Date(m.created_at).toLocaleDateString()}</td>
                  <td>
                    {m.id === user?.id ? (
                      <span className="muted-text">Yourself</span>
                    ) : m.is_admin ? (
                      <span className="muted-text">Admin</span>
                    ) : m.status === 'SUSPENDED' ? (
                      <button
                        type="button"
                        className="action-button approve-button"
                        disabled={actingUserId === m.id}
                        onClick={() => handleReactivate(m.id)}
                      >
                        {actingUserId === m.id ? '...' : 'Reactivate'}
                      </button>
                    ) : suspendTarget === m.id ? (
                      <div className="inline-action-form">
                        <input
                          type="text"
                          value={suspendReason}
                          onChange={(e) => setSuspendReason(e.target.value)}
                          placeholder="Reason *"
                        />
                        <button
                          type="button"
                          className="action-button danger-button"
                          disabled={!suspendReason.trim() || actingUserId === m.id}
                          onClick={() => handleSuspend(m.id)}
                        >
                          {actingUserId === m.id ? '...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => { setSuspendTarget(null); setSuspendReason(''); }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : deleteTarget === m.id ? (
                      <div className="inline-action-form">
                        <input
                          type="text"
                          value={deleteReason}
                          onChange={(e) => setDeleteReason(e.target.value)}
                          placeholder="Reason *"
                        />
                        <button
                          type="button"
                          className="action-button danger-button"
                          disabled={!deleteReason.trim() || actingUserId === m.id}
                          onClick={() => handleDelete(m.id)}
                        >
                          {actingUserId === m.id ? '...' : 'Confirm Delete'}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => { setDeleteTarget(null); setDeleteReason(''); }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="inline-action-group">
                        <button
                          type="button"
                          className="action-button danger-button"
                          onClick={() => setSuspendTarget(m.id)}
                        >
                          Suspend
                        </button>
                        <button
                          type="button"
                          className="action-button danger-button"
                          onClick={() => setDeleteTarget(m.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && members.length === 0 && (
        <div className="empty-state-card">
          <h2>No members found</h2>
          <p>Try changing the search or status filter.</p>
        </div>
      )}
    </section>
  );
}

export default AdminMembersPage;
