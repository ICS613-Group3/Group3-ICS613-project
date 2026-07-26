import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { authApi } from '../api/auth';
import { ApiRequestError } from '../api/client';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedToken = token.trim();
    if (!normalizedToken) {
      setErrorMessage('Password reset token is required.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation password must match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.resetPassword({
        token: normalizedToken,
        new_password: newPassword,
      });
      setSuccessMessage(
        'Password reset successfully. Please return to the login page and sign in with your new password.',
      );
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof ApiRequestError ? err.detail : 'Password reset failed.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Password Reset</p>
          <h1>Create New Password</h1>
          <p className="page-description">
            Enter your reset token and choose a new password for your account.
          </p>
        </div>
      </div>

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

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? 'Resetting...' : 'Create New Password'}
        </button>

        {errorMessage && <p className="form-error">{errorMessage}</p>}
        {successMessage && <p className="form-success">{successMessage}</p>}
      </form>
    </section>
  );
}
