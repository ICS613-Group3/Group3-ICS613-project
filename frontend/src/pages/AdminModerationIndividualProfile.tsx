import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminApi } from '../api/admin';
import type { ModerationProfile } from '../api/admin';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';

/**
 * AdminModerationIndividualProfile
 *
 * US29/30/31: Shows a single member's moderation profile with violation history,
 * plus Suspend (US30) and Reactivate (US31) actions.
 * Fetches from GET /admin/users/{user_id}/moderation.
 */
function AdminModerationIndividualProfile() {
  const { memberId } = useParams<{ memberId: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ModerationProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  // Suspend/Reactivate state
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [isActioning, setIsActioning] = useState(false);

  const loadProfile = useCallback(async (id: string) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await adminApi.getModerationProfile(id);
      setProfile(data);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.detail : 'Failed to load moderation profile.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (memberId) loadProfile(memberId);
  }, [memberId, loadProfile]);

  const handleSuspend = async () => {
    if (!memberId || !suspendReason.trim()) return;
    setIsActioning(true);
    setActionMessage('');
    try {
      await adminApi.suspendUser(memberId, suspendReason.trim());
      setActionMessage('Account suspended successfully.');
      setShowSuspendForm(false);
      setSuspendReason('');
      await loadProfile(memberId);
    } catch (err) {
      setActionMessage(err instanceof ApiRequestError ? err.detail : 'Suspension failed.');
    } finally {
      setIsActioning(false);
    }
  };

  const handleReactivate = async () => {
    if (!memberId) return;
    setIsActioning(true);
    setActionMessage('');
    try {
      await adminApi.unsuspendUser(memberId, 'Admin reactivation');
      setActionMessage('Account reactivated successfully.');
      await loadProfile(memberId);
    } catch (err) {
      setActionMessage(err instanceof ApiRequestError ? err.detail : 'Reactivation failed.');
    } finally {
      setIsActioning(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page-section">
        <p>Loading moderation profile...</p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="page-section">
        <p className="form-error">{errorMessage}</p>
        <Link to="/admin/moderation" className="secondary-button">Back to Moderation</Link>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="page-section">
        <p>No profile found.</p>
        <Link to="/admin/moderation" className="secondary-button">Back to Moderation</Link>
      </section>
    );
  }

  const isSuspended = profile.status === 'SUSPENDED';

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US29/30/31 — Moderation Profile</p>
          <h1>{profile.full_name || profile.email}</h1>
          <p className="page-description">
            Violation history, suspension status, and moderation actions for this member.
          </p>
        </div>
      </div>

      {actionMessage && (
        <p className={actionMessage.includes('failed') || actionMessage.includes('error') ? 'form-error' : 'success-message'}>
          {actionMessage}
        </p>
      )}

      {/* Member Info */}
      <div className="form-card">
        <h2>Member Info</h2>
        <dl className="reservation-meta-grid">
          <div>
            <dt>Email</dt>
            <dd>{profile.email}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`workflow-status status-${profile.status.toLowerCase()}`}>
                {profile.status}
              </span>
            </dd>
          </div>
          <div>
            <dt>Violation Count</dt>
            <dd>{profile.violation_count}</dd>
          </div>
          <div>
            <dt>Damage Reports</dt>
            <dd>{profile.damage_reported}</dd>
          </div>
        </dl>
      </div>

      {/* Suspend / Reactivate Actions */}
      {user?.is_admin && (
        <div className="form-card">
          <h2>Moderation Actions</h2>

          {!isSuspended && !showSuspendForm && (
            <button
              type="button"
              className="action-button danger-button"
              onClick={() => setShowSuspendForm(true)}
            >
              Suspend Account
            </button>
          )}

          {!isSuspended && showSuspendForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px' }}>
              <label htmlFor="suspend-reason">
                Reason for suspension *
                <input
                  id="suspend-reason"
                  type="text"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Why is this account being suspended?"
                  maxLength={2000}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="action-button danger-button"
                  onClick={handleSuspend}
                  disabled={isActioning || !suspendReason.trim()}
                >
                  {isActioning ? 'Suspending...' : 'Confirm Suspend'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => { setShowSuspendForm(false); setSuspendReason(''); }}
                  disabled={isActioning}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isSuspended && (
            <button
              type="button"
              className="action-button approve-button"
              onClick={handleReactivate}
              disabled={isActioning}
            >
              {isActioning ? 'Reactivating...' : 'Reactivate Account'}
            </button>
          )}
        </div>
      )}

      {/* Violation History */}
      <section className="table-card">
        <h2>Violation History</h2>
        {profile.violation_history.length === 0 ? (
          <p className="muted-text">No violations recorded for this member.</p>
        ) : (
          <div className="responsive-table-wrapper">
            <table className="invite-table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Tool</th>
                  <th>Reason</th>
                  <th>Resolved At</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {profile.violation_history.map((v) => (
                  <tr key={v.report_id}>
                    <td><code>{v.report_id.slice(0, 8)}</code></td>
                    <td>{v.tool_name || '—'}</td>
                    <td>{v.reason}</td>
                    <td>{v.resolved_at ? new Date(v.resolved_at).toLocaleDateString() : '—'}</td>
                    <td>{v.resolution_note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Link to="/admin/moderation" className="secondary-button">
        Back to Moderation
      </Link>
    </section>
  );
}

export default AdminModerationIndividualProfile;
