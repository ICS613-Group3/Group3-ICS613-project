import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, authApi, tokenStore } from '../api/client';

/**
 * ResetPasswordPage
 *
 * US4 — finalize a password reset. The user lands here from the link in
 * the reset email; the token comes in as the ``?token=`` query param.
 * On success the backend returns a fresh token pair, so we also store
 * those into ``tokenStore`` and route the user to the dashboard.
 */
function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get('token') ?? '';

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (!token.trim()) {
      setErrorMessage('Missing reset token. Use the link from your email.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const tokens = await authApi.resetPassword(token.trim(), newPassword);
      tokenStore.set(tokens.access_token, tokens.refresh_token);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US4 — Password Reset</p>
          <h1>Set a new password</h1>
          <p className="page-description">
            Paste the token from your reset email and choose a new
            password. In dev with MailHog, the token is visible at
            http://localhost:8025.
          </p>
        </div>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <label>
          Reset token
          <input
            type="text"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste the token from the email link"
            required
          />
          <span className="helper-text">
            The link in the email already includes this token in the URL.
          </span>
        </label>

        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
        </label>

        <label>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
        </label>

        <button
          className="primary-link auth-submit-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Resetting…' : 'Reset password'}
        </button>

        {errorMessage && (
          <p className="error-message" role="alert">
            {errorMessage}
          </p>
        )}

        <p className="auth-helper-text">
          Need a new link? <Link to="/forgot-password">Request one</Link>.
        </p>
      </form>
    </section>
  );
}

export default ResetPasswordPage;
