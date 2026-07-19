import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { authApi } from '../api/auth';
import type { InviteResponse } from '../types/api';

type InviteStatus = 'sent' | 'used' | 'expired' | 'revoked';

function isKnownInviteStatus(value: string): value is InviteStatus {
  return (
    value === 'sent' ||
    value === 'used' ||
    value === 'expired' ||
    value === 'revoked'
  );
}

function getInviteStatus(invite: InviteResponse): InviteStatus {
  const normalizedStatus = invite.status.toLowerCase();

  if (
    normalizedStatus === 'sent' &&
    new Date(invite.expires_at).getTime() <= Date.now()
  ) {
    return 'expired';
  }

  if (isKnownInviteStatus(normalizedStatus)) {
    return normalizedStatus;
  }

  return 'sent';
}

function getStatusClass(status: InviteStatus) {
  return `invite-status invite-status-${status}`;
}

function formatStatus(status: InviteStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString();
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

export default function AdminInvitesPage() {
  const [email, setEmail] = useState('');
  const [invites, setInvites] = useState<InviteResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function loadInvites(options?: { refresh?: boolean }) {
    if (options?.refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage('');

    try {
      const inviteRecords = await authApi.listInvites();
      setInvites(inviteRecords);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          'Unable to load invites. Confirm that you are signed in as an administrator and that the backend is available.',
        ),
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadInvites();
  }, []);

  const inviteCounts = useMemo(() => {
    return invites.reduce(
      (counts, invite) => {
        const status = getInviteStatus(invite);
        counts[status] += 1;
        return counts;
      },
      {
        sent: 0,
        used: 0,
        expired: 0,
        revoked: 0,
      } as Record<InviteStatus, number>,
    );
  }, [invites]);

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    setErrorMessage('');
    setSuccessMessage('');

    if (!normalizedEmail) {
      setErrorMessage('Enter the member email address.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    setIsSending(true);

    try {
      const createdInvite = await authApi.createInvite({
        email: normalizedEmail,
      });

      setInvites((currentInvites) => [
        createdInvite,
        ...currentInvites.filter(
          (invite) => String(invite.id) !== String(createdInvite.id),
        ),
      ]);

      setEmail('');
      setSuccessMessage(`Invite sent to ${normalizedEmail}.`);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          'Unable to send the invite. The email may already belong to a member or have an active invite.',
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Invite Management</h1>
          <p className="page-description">
            Invite new neighborhood members and review the current status of
            all invitation records.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={isLoading || isRefreshing}
            onClick={() => void loadInvites({ refresh: true })}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh Invites'}
          </button>
        </div>
      </header>

      <div className="invite-summary-grid">
        <article className="summary-card">
          <strong className="summary-number">{inviteCounts.sent}</strong>
          <span className="summary-label">Sent</span>
        </article>

        <article className="summary-card">
          <strong className="summary-number">{inviteCounts.used}</strong>
          <span className="summary-label">Used</span>
        </article>

        <article className="summary-card">
          <strong className="summary-number">{inviteCounts.expired}</strong>
          <span className="summary-label">Expired</span>
        </article>

        <article className="summary-card">
          <strong className="summary-number">{inviteCounts.revoked}</strong>
          <span className="summary-label">Revoked</span>
        </article>
      </div>

      <form className="form-card" onSubmit={handleInviteSubmit}>
        <h2>Invite New Member</h2>

        <div className="form-grid">
          <div>
            <label htmlFor="invite-email">Member Email</label>
            <input
              id="invite-email"
              name="invite-email"
              type="email"
              value={email}
              disabled={isSending}
              placeholder="member@example.com"
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          className="primary-button"
          disabled={isSending}
        >
          {isSending ? 'Sending…' : 'Send Invite'}
        </button>

        <div aria-live="polite">
          {errorMessage && <p className="form-error">{errorMessage}</p>}
          {successMessage && (
            <p className="form-success">{successMessage}</p>
          )}
        </div>
      </form>

      <section className="table-card">
        <h2>All Invites</h2>

        {isLoading ? (
          <p className="helper-text">Loading invite records…</p>
        ) : invites.length === 0 ? (
          <p className="helper-text">
            No invite records are currently available.
          </p>
        ) : (
          <div className="responsive-table-wrapper">
            <table className="invite-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Token</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>Registered Member</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {invites.map((invite) => {
                  const status = getInviteStatus(invite);
                  const canRevoke = status === 'sent';

                  return (
                    <tr key={String(invite.id)}>
                      <td>{invite.email}</td>

                      <td>
                        <code>{invite.token}</code>
                      </td>

                      <td>
                        <span className={getStatusClass(status)}>
                          {formatStatus(status)}
                        </span>
                      </td>

                      <td>{formatDateTime(invite.created_at)}</td>

                      <td>{formatDateTime(invite.expires_at)}</td>

                      <td>
                        {status === 'used'
                          ? 'Not provided by API'
                          : '—'}
                      </td>

                      <td>
                        {canRevoke ? (
                          <button
                            type="button"
                            className="danger-button"
                            disabled
                            title="The backend revoke-invite endpoint is not implemented yet."
                          >
                            Revoke unavailable
                          </button>
                        ) : (
                          <span aria-label="No action available">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="helper-text">
          Invite listing and creation use the live backend API. Registered
          member details and persistent invite revocation remain unavailable
          until the backend provides those fields and endpoints.
        </p>
      </section>
    </section>
  );
}
