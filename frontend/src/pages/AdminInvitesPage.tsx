// Import React runtime hooks for memoized counts and page state.
import { useMemo, useState } from 'react';

// Import React type only for form submit event typing.
// This is required because verbatimModuleSyntax is enabled.
import type { FormEvent } from 'react';

// Define the possible invite statuses shown in the admin invite table.
type InviteStatus = 'sent' | 'used' | 'expired' | 'revoked';

// Define the shape of one invite record used by the mock frontend page.
interface InviteRecord {
  id: string;
  email: string;
  token: string;
  status: InviteStatus;
  createdAt: string;
  registeredMember?: string;
}

// Define a stricter email pattern so incomplete emails like "rion@e" are rejected.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mock existing member emails for Issue #64.
// Later, the real backend should return this error from the invite API.
const existingMemberEmails = new Set([
  'rion@example.com',
  'ivan@example.com',
  'nick@example.com',
  'loreto@example.com',
  'yafei@example.com',
]);

// Mock invite records for the Invite Management Page.
// This supports Issue #63 by showing sent, used, expired, and revoked invites.
const initialInvites: InviteRecord[] = [
  {
    id: 'invite-1',
    email: 'new.member@example.com',
    token: 'INVITE-DEMO-001',
    status: 'sent',
    createdAt: '2026-07-03',
  },
  {
    id: 'invite-2',
    email: 'used.member@example.com',
    token: 'INVITE-DEMO-002',
    status: 'used',
    createdAt: '2026-07-02',
    registeredMember: 'Used Member',
  },
  {
    id: 'invite-3',
    email: 'expired.member@example.com',
    token: 'INVITE-DEMO-003',
    status: 'expired',
    createdAt: '2026-06-29',
  },
  {
    id: 'invite-4',
    email: 'revoked.member@example.com',
    token: 'INVITE-DEMO-004',
    status: 'revoked',
    createdAt: '2026-06-28',
  },
];

// Build a status-specific CSS class for each invite status badge.
function getStatusClass(status: InviteStatus) {
  return `invite-status invite-status-${status}`;
}

// Admin invite page.
// Covers:
// #62 Create Invite New Member UI
// #63 Create Invite Management Page
// #64 Show account-already-exists message
export default function AdminInvitesPage() {
  // Store the email typed into the invite form.
  const [email, setEmail] = useState('');

  // Store the mock invite list shown in the management table.
  const [invites, setInvites] = useState<InviteRecord[]>(initialInvites);

  // Store validation or mock backend error messages.
  const [errorMessage, setErrorMessage] = useState('');

  // Store success messages after sending or revoking an invite.
  const [successMessage, setSuccessMessage] = useState('');

  // Count invite statuses for the summary cards.
  const inviteCounts = useMemo(() => {
    return invites.reduce(
      (counts, invite) => {
        counts[invite.status] += 1;
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

  // Generate a mock invite token.
  // In the real backend version, the API will generate and email this token.
  function generateInviteToken() {
    return `INVITE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  // Handle the admin invite form submission.
  function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Clear old messages before processing the new form submission.
    setErrorMessage('');
    setSuccessMessage('');

    // Normalize the email so duplicate checks are consistent.
    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format before creating the invite.
    if (!emailPattern.test(normalizedEmail)) {
      setErrorMessage('Please enter a valid email address, such as name@example.com.');
      return;
    }

    // Issue #64: show account-already-exists message.
    // This mocks the backend rejecting an invite for an existing account.
    if (existingMemberEmails.has(normalizedEmail)) {
      setErrorMessage('An account with that email already exists.');
      return;
    }

    // Prevent duplicate active invites for the same email.
    const hasActiveInvite = invites.some(
      (invite) =>
        invite.email.toLowerCase() === normalizedEmail &&
        invite.status !== 'expired' &&
        invite.status !== 'revoked',
    );

    if (hasActiveInvite) {
      setErrorMessage('An active invite already exists for this email.');
      return;
    }

    // Create a new mock invite record.
    const newInvite: InviteRecord = {
      id: `invite-${Date.now()}`,
      email: normalizedEmail,
      token: generateInviteToken(),
      status: 'sent',
      createdAt: new Date().toISOString().slice(0, 10),
    };

    // Add the new invite to the top of the table and clear the form.
    setInvites((currentInvites) => [newInvite, ...currentInvites]);
    setEmail('');
    setSuccessMessage(`Invite sent to ${normalizedEmail}.`);
  }

  // Revoke an unused invite.
  // Only invites with "sent" status show the Revoke button.
  function handleRevokeInvite(inviteId: string) {
    // Clear old messages before updating the invite.
    setErrorMessage('');
    setSuccessMessage('');

    // Update the selected invite status to revoked.
    setInvites((currentInvites) =>
      currentInvites.map((invite) =>
        invite.id === inviteId ? { ...invite, status: 'revoked' } : invite,
      ),
    );

    // Show confirmation after the mock revoke action.
    setSuccessMessage('Invite was revoked successfully.');
  }

  return (
    <section className="page-section">
      {/* Page header explains what this admin page is for. */}
      <div className="page-header">
        <p className="eyebrow">Admin</p>
        <h1>Invite Management</h1>
        <p>
          Invite new neighborhood members, review invite status, and revoke unused
          invites.
        </p>
      </div>

      {/* Summary cards show quick invite status counts. */}
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

      {/* Issue #62: Invite New Member UI. */}
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

        <button type="submit" className="primary-button">
          Send Invite
        </button>

        {/* Issue #64: account-already-exists and validation error message area. */}
        {errorMessage && <p className="form-error">{errorMessage}</p>}

        {/* Success message confirms the invite/revoke action. */}
        {successMessage && <p className="form-success">{successMessage}</p>}
      </form>

      {/* Issue #63: Invite Management Page table. */}
      <div className="table-card">
        <h2>All Invites</h2>

        <div className="responsive-table-wrapper">
          <table className="invite-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Token</th>
                <th>Status</th>
                <th>Created</th>
                <th>Registered Member</th>
                <th>Action</th>
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
                    <span className={getStatusClass(invite.status)}>
                      {invite.status}
                    </span>
                  </td>
                  <td>{invite.createdAt}</td>
                  <td>{invite.registeredMember ?? '—'}</td>
                  <td>
                    {invite.status === 'sent' ? (
                      <button
                        type="button"
                        className="secondary-button danger-button"
                        onClick={() => handleRevokeInvite(invite.id)}
                      >
                        Revoke
                      </button>
                    ) : (
                      <span className="muted-text">No action</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demo note documents that this page is frontend mock behavior for now. */}
      <p className="demo-note">
        Demo note: this page uses mock frontend data. Later, it can connect to the
        backend invite endpoint.
      </p>
    </section>
  );
}