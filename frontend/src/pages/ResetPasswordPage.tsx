// Import React runtime hook for local page state.
import { useState } from 'react';

// Import React type only for form submit event typing.
// This is required because verbatimModuleSyntax is enabled.
import type { FormEvent } from 'react';

// Import routing helper to read reset token from URL query string.
import { useSearchParams } from 'react-router-dom';

/**
 * ResetPasswordPage
 *
 * Frontend issues covered:
 * - #91 Create the Create-New-Password UI.
 * - #93 Display message like "Request a new reset email".
 *
 * Current behavior:
 * - Frontend mock/demo page only.
 * - Accepts any token except empty token or special demo invalid tokens.
 *
 * Future backend behavior:
 * - Submit token + new password to backend endpoint: POST /api/v1/auth/reset-password.
 */
export default function ResetPasswordPage() {
  // Read token from URL, for example: /reset-password?token=abc123
  const [searchParams] = useSearchParams();

  // Store reset token field.
  const [token, setToken] = useState(searchParams.get('token') ?? '');

  // Store new password field.
  const [newPassword, setNewPassword] = useState('');

  // Store confirm password field.
  const [confirmPassword, setConfirmPassword] = useState('');

  // Store validation or mock backend error messages.
  const [errorMessage, setErrorMessage] = useState('');

  // Store success message after password reset.
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * Handle create-new-password form submission.
   *
   * Demo rules:
   * - Empty token is rejected.
   * - "expired" or "invalid" shows request-new-reset-email message.
   * - Password must be at least 8 characters.
   * - Confirm password must match.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Clear old messages before processing the reset form.
    setErrorMessage('');
    setSuccessMessage('');

    // Normalize token before validation.
    const normalizedToken = token.trim();

    // Reject empty reset token.
    if (!normalizedToken) {
      setErrorMessage('Password reset token is required.');
      return;
    }

    // Issue #93: show request-new-reset-email message for invalid/expired token.
    if (
      normalizedToken.toLowerCase() === 'expired' ||
      normalizedToken.toLowerCase() === 'invalid'
    ) {
      setErrorMessage(
        'This reset link is invalid, expired, or already used. Please request a new reset email.',
      );
      return;
    }

    // Require a basic minimum password length for frontend demo validation.
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }

    // Require password confirmation to match.
    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation password must match.');
      return;
    }

    // Mock success result.
    setSuccessMessage(
      'Password reset successfully. Please return to the login page and sign in with your new password.',
    );

    // Clear password fields after mock success.
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <section className="page-section">
      {/* Page header explains the create-new-password workflow. */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Password Reset</p>
          <h1>Create New Password</h1>
          <p className="page-description">
            Enter your reset token and choose a new password for your account.
          </p>
        </div>
      </div>

      {/* Create-new-password form covers issues #91 and #93. */}
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Reset Your Password</h2>

        <label htmlFor="reset-token">
          Reset Token
          <input
            id="reset-token"
            type="text"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste reset token"
            required
          />
        </label>

        <label htmlFor="new-password">
          New Password
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
          />
        </label>

        <label htmlFor="confirm-password">
          Confirm New Password
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter new password"
            required
            minLength={8}
          />
        </label>

        <button type="submit" className="primary-button">
          Create New Password
        </button>

        {/* Error message includes request-new-reset-email message for expired token. */}
        {errorMessage && <p className="form-error">{errorMessage}</p>}

        {/* Success message confirms mock password reset. */}
        {successMessage && <p className="form-success">{successMessage}</p>}

        <p className="auth-helper-text">
          Demo test: use <strong>expired</strong> or <strong>invalid</strong> as the
          token to show the request-new-reset-email message.
        </p>
      </form>
    </section>
  );
}