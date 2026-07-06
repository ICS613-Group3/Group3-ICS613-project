// Admin invite page — connected to the real backend API.
// Lists existing invites, creates new ones, and allows revoking unused ones.
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { authApi } from '../api/auth';
import { useAuth } from '../context/useAuth';
import type { InviteResponse } from '../types/api';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminInvitesPage() {
  const { user } = useAuth();

  const [invites, setInvites] = useState<InviteResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadInvites = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const list = await authApi.listInvites();
      setInvites(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load invites.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail)) {
      setErrorMessage('Please enter a valid email address, such as name@example.com.');
      return;
    }

    setIsCreating(true);
    try {
      const invite = await authApi.createInvite({ email: normalizedEmail });
      setSuccessMessage(
        `Invite created for ${normalizedEmail}. Token: ${invite.token}`,
      );
      setEmail('');
      await loadInvites();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create invite.';
      setErrorMessage(msg);
    } finally {
      setIsCreating(false);
    }
  };

  if (!user?.is_admin) {
    return (
      <section className="page-section">
        <div className="page-header">
          <h1>Access Denied</h1>
          <p>Only administrators can manage invites.</p>
        </div>
      </section>
    );
  }

  // Invite status counts for summary cards.
  const inviteCounts = { sent: 0, used: 0, expired: 0, revoked: 0 };
  for (const inv of invites) {
    const s = inv.status.toLowerCase() as keyof typeof inviteCounts;
    if (s in inviteCounts) inviteCounts[s]++;
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <p className="eyebrow">Admin</p>
        <h1>Invite Management</h1>
        <p>
          Invite new neighborhood members, review invite status, and revoke unused
          invites.
        </p>
      </div>

      {/* Summary cards */}
      <div className="invite-summary-grid">
        <article className="summary-card">
          <strong>{inviteCounts.sent}</strong>
          <span>Sent</span>
        </article>
        <article className="summary-card">
          <strong>{inviteCounts.used}</strong>
          <span>Used</span>
        </article>
        <article className="summary-card">
          <strong>{inviteCounts.expired}</strong>
          <span>Expired</span>
        </article>
        <article className="summary-card">
          <strong>{inviteCounts.revoked}</strong>
          <span>Revoked</span>
        </article>
      </div>

      {/* Invite form */}
      <form className="form-card" onSubmit={handleInviteSubmit}>
        <h2>Invite New Member</h2>

        <label htmlFor="invite-email">Member Email</label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="new.member@example.com"
          required
          pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
          title="Please enter a valid email address, such as name@example.com."
        />

        <button type="submit" className="primary-button" disabled={isCreating}>
          {isCreating ? 'Sending...' : 'Send Invite'}
        </button>

        {errorMessage && <p className="form-error">{errorMessage}</p>}
        {successMessage && <p className="form-success">{successMessage}</p>}
      </form>

      {/* Invites table */}
      <div className="table-card">
        <h2>All Invites</h2>

        {isLoading ? (
          <p>Loading invites...</p>
        ) : invites.length === 0 ? (
          <p className="muted-text">No invites yet.</p>
        ) : (
          <div className="responsive-table-wrapper">
            <table className="invite-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Token</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td>{invite.email}</td>
                    <td>
                      <code>{invite.token}</code>
                    </td>
                    <td>
                      <span className={`invite-status invite-status-${invite.status.toLowerCase()}`}>
                        {invite.status}
                      </span>
                    </td>
                    <td>{new Date(invite.expires_at).toLocaleDateString()}</td>
                    <td>{new Date(invite.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
