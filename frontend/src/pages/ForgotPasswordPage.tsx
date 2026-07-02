import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, authApi } from '../api/client';
import { isValidEmail } from '../utils/validation';

/**
 * ForgotPasswordPage
 *
 * US4 — request a password-reset email. The backend always returns 200
 * whether or not the email exists (anti-enumeration). In dev with
 * MailHog, the reset email and its token are visible at
 * http://localhost:8025.
 */
function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.forgotPassword(trimmed);
      setSuccessMessage(
        'If an account with that email exists, a reset link has been sent. Check your inbox (in dev: MailHog at http://localhost:8025).',
      );
      setEmail('');
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else setErrorMessage('Failed to request password reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US4 — Password Reset</p>
          <h1>Forgot password</h1>
          <p className="page-description">
            Enter the email address on your account. We'll send you a
            one-time link to set a new password.
          </p>
        </div>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <button
          className="primary-link auth-submit-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending…' : 'Send reset link'}
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
          Remembered it? <Link to="/login">Back to login</Link>.
        </p>
      </form>
    </section>
  );
}

export default ForgotPasswordPage;
