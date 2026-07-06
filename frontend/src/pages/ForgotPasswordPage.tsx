// Import React runtime hook for local page state.
import { useState } from 'react';

// Import React type only for form submit event typing.
// This is required because verbatimModuleSyntax is enabled.
import type { FormEvent } from 'react';

// Strong email validation pattern for forgot-password form.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ForgotPasswordPage
 *
 * Frontend issue covered:
 * - #89 Create Reset Password UI.
 *
 * Current behavior:
 * - Frontend mock/demo page only.
 * - Shows generic success message after valid email submit.
 *
 * Future backend behavior:
 * - Submit email to backend endpoint: POST /api/v1/auth/forgot-password.
 */
export default function ForgotPasswordPage() {
  // Store email typed by the user.
  const [email, setEmail] = useState('');

  // Store validation or mock backend error messages.
  const [errorMessage, setErrorMessage] = useState('');

  // Store generic success message after reset request.
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * Handle forgot-password form submission.
   *
   * Security note:
   * - The success message is generic.
   * - It does not reveal whether the email exists.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Clear old messages before processing the form.
    setErrorMessage('');
    setSuccessMessage('');

    // Normalize email before validation.
    const normalizedEmail = email.trim().toLowerCase();

    // Reject incomplete emails like rion@e.
    if (!emailPattern.test(normalizedEmail)) {
      setErrorMessage('Please enter a valid email address, such as name@example.com.');
      return;
    }

    // Mock success message for R1 frontend demo.
    setSuccessMessage(
      'If an account exists for that email, a password reset link has been sent.',
    );
    setEmail('');
  }

  return (
    <section className="page-section">
      {/* Page header explains the password reset request workflow. */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Password Help</p>
          <h1>Forgot Password</h1>
          <p className="page-description">
            Enter your email address and we will send a password reset link if the
            account exists.
          </p>
        </div>
      </div>

      {/* Forgot password form covers issue #89. */}
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Request Password Reset</h2>

        <label htmlFor="forgot-password-email">
          Email Address
          <input
            id="forgot-password-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
            pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
            title="Please enter a valid email address, such as name@example.com."
          />
        </label>

        <button type="submit" className="primary-button">
          Send Reset Link
        </button>

        {/* Error and success messages are shown below the form button. */}
        {errorMessage && <p className="form-error">{errorMessage}</p>}
        {successMessage && <p className="form-success">{successMessage}</p>}

        <p className="auth-helper-text">
          Demo note: this page is frontend mock behavior. Backend integration can send
          the real reset email later.
        </p>
      </form>
    </section>
  );
}