import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, authApi } from '../api/client';
import { useAuth } from '../context/authContextValue';
import { EMAIL_PATTERN, isValidEmail } from '../utils/validation';

/**
 * RegisterPage
 *
 * Real backend registration via ``POST /auth/register``.
 *
 * The backend requires a valid invite token. The seed script creates an
 * invite for ``newmember@example.com`` and prints its token to the
 * server log; for the R1 demo the token can also be pre-filled from the
 * dev environment variable ``VITE_DEV_INVITE_TOKEN`` (see frontend/.env).
 *
 * After registration, the user is in ``EMAIL_PENDING`` status and CANNOT
 * log in until they verify their email via the link emailed to them.
 * We show a clear success message explaining this instead of auto-login.
 */
function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  // Optional dev token; in a real deployment the admin copies the token
  // from their invite-creation response and pastes it here.
  const [inviteToken, setInviteToken] = useState(
    (import.meta.env.VITE_DEV_INVITE_TOKEN as string | undefined) ?? '',
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    // Already-logged-in users are bounced to the dashboard (handled by
    // <RequireAuth requireAuth={false}> in AppRoutes, but we double-check
    // here so a stale render doesn't show the form).
    window.location.replace('/dashboard');
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. you@example.com).');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }
    if (!inviteToken.trim()) {
      setErrorMessage('Invite token is required. Ask an admin to create one for you.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.register({
        email: trimmedEmail,
        password,
        full_name: fullName.trim() || undefined,
        invite_token: inviteToken.trim(),
      });
      setSuccessMessage(
        'Registration submitted. Check your email for a verification link — you must verify before you can log in.',
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unable to reach the server. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Create Account</p>
          <h1>Register</h1>
          <p className="page-description">
            Create a Neighborhood Tool Sharing account. An invite token from
            an administrator is required.
          </p>
        </div>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <label>
          Display Name
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            maxLength={255}
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            pattern={EMAIL_PATTERN.source}
            title="Enter an email like you@example.com"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
          <span className="helper-text">At least 8 characters.</span>
        </label>

        <label>
          Invite Token
          <input
            type="text"
            value={inviteToken}
            onChange={(event) => setInviteToken(event.target.value)}
            placeholder="Paste the token from your invite email"
            required
          />
        </label>

        <button
          className="primary-link auth-submit-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting…' : 'Register'}
        </button>

        {errorMessage && (
          <p className="error-message" role="alert">
            {errorMessage}
          </p>
        )}

        {successMessage && (
          <p className="success-message" role="status">
            {successMessage}
          </p>
        )}

        <p className="auth-helper-text">
          Already have an account? <Link to="/login">Login here</Link>.
        </p>
      </form>
    </section>
  );
}

export default RegisterPage;
