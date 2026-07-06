// Import React runtime hooks for local page state.
import { useState } from 'react';

// Import React type only for form submit event typing.
// This is required because verbatimModuleSyntax is enabled.
import type { FormEvent } from 'react';

// Import routing helper to read token from URL query string.
import { useSearchParams } from 'react-router-dom';

// Strong email validation pattern for resend verification email form.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * VerifyEmailPage
 *
 * Frontend issues covered:
 * - #77 Create the Submit button for the verification token.
 * - #79 Display UI to resend the verification email.
 *
 * Current behavior:
 * - Frontend mock/demo page only.
 * - Accepts any token except empty token or special demo invalid tokens.
 *
 * Future backend behavior:
 * - Submit token to backend endpoint: POST /api/v1/auth/verify-email.
 * - Resend email through backend endpoint: POST /api/v1/auth/resend-verification.
 */
export default function VerifyEmailPage() {
  // Read token from URL, for example: /verify-email?token=abc123
  const [searchParams] = useSearchParams();

  // Store the verification token field.
  const [token, setToken] = useState(searchParams.get('token') ?? '');

  // Store the resend email field.
  const [resendEmail, setResendEmail] = useState('');

  // Store error messages for invalid token or invalid email.
  const [errorMessage, setErrorMessage] = useState('');

  // Store success messages for verify or resend actions.
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * Handle mock email verification submit.
   *
   * Demo rules:
   * - Empty token shows required token message.
   * - "expired" or "invalid" shows invalid/expired token message.
   * - Anything else succeeds.
   */
  function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Clear old messages before processing the form.
    setErrorMessage('');
    setSuccessMessage('');

    // Normalize token input before validation.
    const normalizedToken = token.trim();

    // Reject empty token.
    if (!normalizedToken) {
      setErrorMessage('Verification token is required.');
      return;
    }

    // Mock invalid/expired token cases for frontend demo testing.
    if (
      normalizedToken.toLowerCase() === 'expired' ||
      normalizedToken.toLowerCase() === 'invalid'
    ) {
      setErrorMessage(
        'This verification link is invalid or expired. Please resend the verification email.',
      );
      return;
    }

    // Mock success result.
    setSuccessMessage(
      'Email verified successfully. Your account is now active. You can log in or continue to your profile setup.',
    );
  }

  /**
   * Handle mock resend verification email submit.
   *
   * Demo rules:
   * - Requires a complete email like name@example.com.
   * - Shows generic success message to avoid account enumeration.
   */
  function handleResendSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Clear old messages before processing the resend request.
    setErrorMessage('');
    setSuccessMessage('');

    // Normalize email before validation.
    const normalizedEmail = resendEmail.trim().toLowerCase();

    // Reject incomplete emails like rion@e.
    if (!emailPattern.test(normalizedEmail)) {
      setErrorMessage('Please enter a valid email address, such as name@example.com.');
      return;
    }

    // Show generic success message.
    // Real backend should not reveal whether the email exists.
    setSuccessMessage(
      'If that email has a pending account, a new verification email has been sent.',
    );
    setResendEmail('');
  }

  return (
    <section className="page-section">
      {/* Page header explains the email verification workflow. */}
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

      {/* Verification token form covers issue #77. */}
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

        <button type="submit" className="primary-button">
          Verify Email
        </button>

        <p className="auth-helper-text">
          Demo test: use <strong>expired</strong> or <strong>invalid</strong> to show
          the expired-token message.
        </p>
      </form>

      {/* Resend verification form covers issue #79. */}
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

        <button type="submit" className="secondary-button">
          Resend Verification Email
        </button>
      </form>

      {/* Shared message area for both forms. */}
      {errorMessage && <p className="form-error">{errorMessage}</p>}
      {successMessage && <p className="form-success">{successMessage}</p>}
    </section>
  );
}