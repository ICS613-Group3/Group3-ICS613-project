// Admin invite page — connected to the real backend API.
// Lists existing invites, creates new ones, displays associated members,
// and allows revoking unused, unexpired invites.
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import PaginationControls from '../components/PaginationControls';
import { useClientPagination } from '../hooks/useClientPagination';

import { adminApi } from '../api/admin';
import { authApi } from '../api/auth';
import { ApiRequestError } from '../api/client';
import { useAuth } from '../context/useAuth';
import type { InviteResponse, UserProfile } from '../types/api';
import { formatHstDateTime } from '../utils/hstDateTime';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function getEffectiveInviteStatus(invite: InviteResponse): string {
  const status = invite.status.toLowerCase();

  if (status === 'sent' && invite.expires_at) {
    const expirationTime = new Date(invite.expires_at).getTime();

    if (!Number.isNaN(expirationTime) && expirationTime <= Date.now()) {
      return 'expired';
    }
  }

  return status;
}

async function loadAllMembers(): Promise<UserProfile[]> {
  const firstPage = await adminApi.listUsers({
    page: 1,
    page_size: 100,
  });

  if (firstPage.pages <= 1) {
    return firstPage.items;
  }

  const remainingPages = await Promise.all(
    Array.from(
      { length: firstPage.pages - 1 },
      (_, index) =>
        adminApi.listUsers({
          page: index + 2,
          page_size: 100,
        }),
    ),
  );

  return [
    ...firstPage.items,
    ...remainingPages.flatMap((page) => page.items),
  ];
}

export default function AdminInvitesPage() {
  const { user } = useAuth();

  const [invites, setInvites] = useState<InviteResponse[]>([]);
  const [membersByEmail, setMembersByEmail] = useState<Record<string, UserProfile>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadInvites = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [inviteList, members] = await Promise.all([
        authApi.listInvites(),
        loadAllMembers(),
      ]);

      setInvites(inviteList);
      setMembersByEmail(
        Object.fromEntries(
          members.map((member) => [
            normalizeEmail(member.email),
            member,
          ]),
        ),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : 'Failed to load invites.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const pagination = useClientPagination(invites);

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedEmail = normalizeEmail(email);

    if (!emailPattern.test(normalizedEmail)) {
      setErrorMessage(
        'Please enter a valid email address, such as name@example.com.',
      );
      return;
    }

    setIsCreating(true);

    try {
      const invite = await authApi.createInvite({
        email: normalizedEmail,
      });

      setSuccessMessage(
        `Invite created for ${normalizedEmail}. Token: ${invite.token}`,
      );

      setEmail('');
      await loadInvites();
      pagination.setCurrentPage(1);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        const normalizedError = `${err.errorCode} ${err.detail}`
          .toLowerCase()
          .replace(/[_-]/g, ' ');

        const accountAlreadyExists =
          err.status === 409 &&
          normalizedError.includes('account') &&
          normalizedError.includes('already exists');

        setErrorMessage(
          accountAlreadyExists
            ? 'An account with this email already exists.'
            : err.detail,
        );
      } else {
        setErrorMessage('Failed to create invite.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeInvite = async (invite: InviteResponse) => {
    if (getEffectiveInviteStatus(invite) !== 'sent') {
      return;
    }

    setRevokingInviteId(invite.id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await authApi.revokeInvite(invite.id);
      setSuccessMessage(`Invite for ${invite.email} was revoked.`);
      await loadInvites();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof ApiRequestError
          ? err.detail
          : 'Failed to revoke invite.',
      );
    } finally {
      setRevokingInviteId(null);
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

  const inviteCounts = {
    sent: 0,
    used: 0,
    expired: 0,
    revoked: 0,
  };

  for (const invite of invites) {
    const status = getEffectiveInviteStatus(
      invite,
    ) as keyof typeof inviteCounts;

    if (status in inviteCounts) {
      inviteCounts[status]++;
    }
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <p className="eyebrow">Admin</p>
        <h1>Invite Management</h1>
        <p>
          Invite new neighborhood members, review invite status, and revoke
          unused invites.
        </p>
      </div>

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

        <button
          type="submit"
          className="primary-button"
          disabled={isCreating}
        >
          {isCreating ? 'Sending...' : 'Send Invite'}
        </button>

        {errorMessage && (
          <p className="form-error">{errorMessage}</p>
        )}

        {successMessage && (
          <p className="form-success">{successMessage}</p>
        )}
      </form>

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
                  <th>Associated Member</th>
                  <th>Token</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {pagination.pageItems.map((invite) => {
                  const effectiveStatus =
                    getEffectiveInviteStatus(invite);

                  const associatedMember =
                    membersByEmail[normalizeEmail(invite.email)];

                  const statusLabel =
                    effectiveStatus.charAt(0).toUpperCase() +
                    effectiveStatus.slice(1);

                  return (
                    <tr key={invite.id}>
                      <td>{invite.email}</td>

                      <td>
                        {associatedMember ? (
                          <Link
                            className="secondary-link"
                            to={`/members/${associatedMember.id}`}
                          >
                            {associatedMember.full_name ||
                              associatedMember.email}
                          </Link>
                        ) : effectiveStatus === 'used' ? (
                          <span className="muted-text">
                            Member unavailable
                          </span>
                        ) : (
                          <span className="muted-text">—</span>
                        )}
                      </td>

                      <td>
                        <code>{invite.token}</code>
                      </td>

                      <td>
                        <span
                          className={
                            `invite-status invite-status-${effectiveStatus}`
                          }
                        >
                          {statusLabel}
                        </span>
                      </td>

                      <td>
                        {invite.expires_at
                          ? formatHstDateTime(invite.expires_at)
                          : '—'}
                      </td>

                      <td>
                        {invite.created_at
                          ? formatHstDateTime(invite.created_at)
                          : '—'}
                      </td>

                      <td>
                        {effectiveStatus === 'sent' ? (
                          <button
                            type="button"
                            className="action-button danger-button"
                            disabled={revokingInviteId === invite.id}
                            onClick={() => handleRevokeInvite(invite)}
                          >
                            {revokingInviteId === invite.id
                              ? 'Revoking...'
                              : 'Revoke'}
                          </button>
                        ) : (
                          <span className="muted-text">
                            No action
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <PaginationControls
          currentPage={pagination.currentPage}
          itemLabel="invites"
          onPageChange={pagination.setCurrentPage}
          pageSize={pagination.pageSize}
          totalItems={invites.length}
          totalPages={pagination.totalPages}
        />
      </div>
    </section>
  );
}
