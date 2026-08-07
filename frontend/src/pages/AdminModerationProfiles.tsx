import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api/admin';
import type { UserProfile } from '../types/api';
import { ApiRequestError } from '../api/client';

/**
 * AdminModerationProfiles
 *
 * US29: Shows all members with their violation counts.
 * Fetches from GET /admin/users.
 */
function AdminModerationProfiles() {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await adminApi.listUsers({ page_size: 50, page: 1 });
      setMembers(data.items);
      setPage(data.page);
      setTotalPages(data.pages);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMessage(err.detail);
      } else {
        setErrorMessage('Failed to load members.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setErrorMessage('');
    try {
      const data = await adminApi.listUsers({ page_size: 50, page: page + 1 });
      setMembers((prev) => [...prev, ...data.items]);
      setPage(data.page);
      setTotalPages(data.pages);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMessage(err.detail);
      } else {
        setErrorMessage('Failed to load more members.');
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, isLoadingMore]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const filteredMembers = members.filter((member) => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      member.full_name?.toLowerCase().includes(search) ||
      member.email.toLowerCase().includes(search)
    );
  });

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US29 — Moderation</p>
          <h1>Member Moderation Profiles</h1>
          <p className="page-description">
            View all members and their violation history.
          </p>
        </div>
        <Link className="secondary-link header-action-link" to="/admin/moderation/history">
          Moderation History
        </Link>
        <Link className="secondary-link header-action-link" to="/admin/moderation/reports">
          Reports &amp; CSV Export
        </Link>
      </div>

      <div className="filter-panel">
        <input
          type="text"
          placeholder="Search by member name or email"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <button className="secondary-button" onClick={loadMembers} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {errorMessage && <p className="form-error">{errorMessage}</p>}

      {isLoading && <p>Loading members...</p>}

      {!isLoading && !errorMessage && (
        <div className="responsive-table-wrapper">
          <table className="invite-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Violations</th>
                <th>Damage Reports</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td>{member.full_name || '—'}</td>
                  <td>{member.email}</td>
                  <td>
                    <span className={`invite-status invite-status-${member.status.toLowerCase()}`}>
                      {member.status}
                    </span>
                  </td>
                  <td>{member.violation_count ?? 0}</td>
                  <td>{member.damage_reported ?? 0}</td>
                  <td>
                    <Link to={`/admin/moderation/${member.id}`}>
                      <button type="button" className="secondary-button">
                        Details
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={6}>No members found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !errorMessage && page < totalPages && (
        <div className="filter-panel" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="secondary-button"
            onClick={loadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Loading...' : 'Load More Members'}
          </button>
        </div>
      )}
    </section>
  );
}

export default AdminModerationProfiles;
