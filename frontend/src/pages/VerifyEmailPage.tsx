import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { authApi } from '../api/auth';
import { ApiRequestError } from '../api/client';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [resendEmail, setResendEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedToken = token.trim();
    if (!normalizedToken) {
      setErrorMessage('Verification token is required.');
      return;
    }

    setIsVerifying(true);
    try {
      await authApi.verifyEmail({ token: normalizedToken });
      setSuccessMessage(
        'Email verified successfully. Your account is now active. You can log in or continue to your profile setup.',
      );
    } catch (err: unknown) {
      const msg = err instanceof ApiRequestError ? err.detail : 'Verification failed.';
      setErrorMessage(msg);
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResendSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedEmail = resendEmail.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail)) {
      setErrorMessage('Please enter a valid email address, such as name@example.com.');
      return;
    }

    setIsResending(true);
    try {
      await authApi.resendVerification({ email: normalizedEmail });
      setSuccessMessage(
        'If that email has a pending account, a new verification email has been sent.',
      );
      setResendEmail('');
    } catch (err: unknown) {
      const msg = err instanceof ApiRequestError ? err.detail : 'Request failed.';
      setErrorMessage(msg);
    } finally {
      setIsResending(false);
    }
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Account Verification</p>
          <h1>Verify Email Address</h1>
          <p className="page-description">
            Enter the verification token from your email, or request a new verification
            email if your link expired.
          </p>
        </div>
      </div>

      <form className="auth-card" onSubmit={handleVerifySubmit}>
        <h2>Submit Verification Token</h2>

        <label htmlFor="verification-token">
          Verification Token
          <input
            id="verification-token"
            type="text"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste verification token"
            required
          />
        </label>

        <button type="submit" className="primary-button" disabled={isVerifying}>
          {isVerifying ? 'Verifying...' : 'Verify Email'}
        </button>
      </form>

      <form className="auth-card" onSubmit={handleResendSubmit}>
        <h2>Resend Verification Email</h2>

        <label htmlFor="resend-email">
          Email Address
          <input
            id="resend-email"
            type="email"
            value={resendEmail}
            onChange={(event) => setResendEmail(event.target.value)}
            placeholder="name@example.com"
            required
            pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
            title="Please enter a valid email address, such as name@example.com."
          />
        </label>

        <button type="submit" className="secondary-button" disabled={isResending}>
          {isResending ? 'Sending...' : 'Resend Verification Email'}
        </button>
      </form>

      {errorMessage && <p className="form-error">{errorMessage}</p>}
      {successMessage && <p className="form-success">{successMessage}</p>}
    </section>
  );
}
