import { useState } from 'react';
import type { FormEvent } from 'react';

import { authApi } from '../api/auth';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail)) {
      setErrorMessage('Please enter a valid email address, such as name@example.com.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.forgotPassword({ email: normalizedEmail });
      setSuccessMessage(
        'If an account exists for that email, a password reset link has been sent.',
      );
      setEmail('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="page-section">
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

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send Reset Link'}
        </button>

        {errorMessage && <p className="form-error">{errorMessage}</p>}
        {successMessage && <p className="form-success">{successMessage}</p>}
      </form>
    </section>
  );
}
