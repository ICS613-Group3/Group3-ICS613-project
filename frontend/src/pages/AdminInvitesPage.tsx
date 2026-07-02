import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, adminApi, type Invite } from '../api/client';
import { isValidEmail } from '../utils/validation';

/**
 * AdminInvitesPage
 *
 * R1.A — admin-only. Lists outstanding invite tokens and lets the
 * admin create new ones. The returned token is the value the new member
 * pastes into the registration form. In dev with MailHog the same
 * value is in the email body.
 *
 * Note: there is no admin "revoke" endpoint in the R1 backend; revoked
 * tokens are auto-marked ``revoked`` when their 7-day TTL expires or
 * when consumed (status flips to ``used``).
 */
function AdminInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<{ email: string; token: string } | null>(null);
  const [createError, setCreateError] = useState('');

  const load = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const list = await adminApi.listInvites();
      setInvites(list);
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to load invites.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError('');
    setCreatedToken(null);
    const trimmed = newEmail.trim();
    if (!isValidEmail(trimmed)) {
      setCreateError('Please enter a valid email address.');
      return;
    }
    setIsCreating(true);
    try {
      const invite = await adminApi.createInvite(trimmed);
      setCreatedToken({ email: invite.email, token: invite.token });
      setNewEmail('');
      await load();
    } catch (err) {
      if (err instanceof ApiError) setCreateError(err.message);
      else setCreateError('Failed to create invite.');
    } finally {
      setIsCreating(false);
    }
  };

  // Computes the "expires in N days" text. ``Date.now()`` is called
  // inside the helper because the relative text should reflect the
  // current moment — re-rendering the page updates the text. This is
  // the intended behavior, not a bug, so the ``react-hooks/purity``
  // rule is disabled for the Date.now() call below.
  const formatExpiry = (iso: string) => {
    const expires = new Date(iso);
    // eslint-disable-next-line react-hooks/purity
    const days = Math.round((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days > 0) return `expires in ${days} day${days === 1 ? '' : 's'}`;
    return `expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">R1.A — Admin</p>
          <h1>Invite Tokens</h1>
          <p className="page-description">
            Issue invite tokens to new members. Each token is valid for
            7 days and can be used once.
          </p>
        </div>
      </div>

      <form className="auth-card admin-invite-form" onSubmit={handleCreate}>
        <h2>Create a new invite</h2>
        <label>
          New member's email
          <input
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="newmember@example.com"
            required
          />
        </label>
        <button
          className="primary-link auth-submit-button"
          type="submit"
          disabled={isCreating}
        >
          {isCreating ? 'Creating…' : 'Create invite'}
        </button>

        {createError && (
          <p className="error-message" role="alert">
            {createError}
          </p>
        )}

        {createdToken && (
          <div className="success-message" role="status">
            <strong>Invite created for {createdToken.email}.</strong>
            <p>Share this token with them (they paste it into the registration form):</p>
            <code className="invite-token-code">{createdToken.token}</code>
            <p className="helper-text">
              In dev the same token is also sent to MailHog at
              http://localhost:8025.
            </p>
          </div>
        )}
      </form>

      <h2>Existing invites</h2>
      {isLoading ? (
        <p>Loading…</p>
      ) : errorMessage ? (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      ) : invites.length === 0 ? (
        <p className="empty-state">No invites yet. Create one above.</p>
      ) : (
        <div className="admin-invite-list">
          {invites.map((invite) => (
            <article
              className="admin-invite-card"
              key={invite.id}
            >
              <div>
                <h3>{invite.email}</h3>
                <p className="admin-invite-meta">
                  Status: <strong>{invite.status}</strong> · {formatExpiry(invite.expires_at)}
                </p>
                <p className="admin-invite-meta">
                  Created: {new Date(invite.created_at).toLocaleString()}
                </p>
              </div>
              {invite.status === 'sent' && (
                <code className="invite-token-code" title="Token (click to copy)">
                  {invite.token}
                </code>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AdminInvitesPage;
