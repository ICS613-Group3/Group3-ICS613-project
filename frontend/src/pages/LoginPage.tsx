import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { authApi } from '../api/auth';
import { ApiRequestError } from '../api/client';

/**
 * LoginPage
 *
 * Current behavior:
 * - Validates the email and password fields.
 * - Sends credentials to POST /api/v1/auth/login.
 * - Stores JWT access and refresh tokens through authApi.login().
 * - Redirects the authenticated user to the dashboard.
 *
 * Frontend issues covered:
 * - #81 Create the login UI.
 * - #83 Display an error for an unverified account.
 * - #85 Display a generic invalid-login message.
 * - #89 Provide a forgot-password link.
 * - #110 Display an account-not-found message.
 */
function LoginPage() {
  const navigate = useNavigate();

  // Inline form state.
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Temporary compatibility with the existing AppLayout navigation.
  // We will replace this with JWT-based navigation in a later step.
  const mockAuthKey = 'mockAuthStatus';

  // Require a complete email address such as name@example.com.
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Submit credentials to the FastAPI backend.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage('');
    setIsSubmitting(true);

    // Read and normalize the form fields.
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '')
      .trim()
      .toLowerCase();
    const password = String(formData.get('password') || '');

    // Perform frontend validation before making the API request.
    if (!emailPattern.test(email)) {
      setErrorMessage(
        'Please enter a valid email address, such as name@example.com.',
      );
      setIsSubmitting(false);
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Password is required.');
      setIsSubmitting(false);
      return;
    }

    try {
      // POST /api/v1/auth/login
      // authApi.login() automatically stores both JWT tokens.
      await authApi.login({
        email,
        password,
      });

      // Keep the current AppLayout navigation working temporarily.
      localStorage.setItem(mockAuthKey, 'logged-in');
      window.dispatchEvent(new Event('mock-auth-change'));

      // Redirect after successful authentication.
      navigate('/dashboard');
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const detail = error.detail.toLowerCase();

        // Handle an account that still needs email verification.
        if (detail.includes('verify') || detail.includes('pending')) {
          setErrorMessage(
            'Your account is pending email verification. Please verify your email or request a new verification email.',
          );
        } else if (error.status === 401 || error.status === 404) {
          // Use a generic response so account existence is not exposed.
          setErrorMessage('Invalid email or password.');
        } else if (error.status === 429) {
          setErrorMessage(
            'Too many login attempts. Please wait and try again.',
          );
        } else {
          setErrorMessage(
            error.detail || 'Login failed. Please try again.',
          );
        }
      } else {
        setErrorMessage(
          'Unable to connect to the server. Please try again.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-section">
      {/* Page heading. */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Member Access</p>
          <h1>Login</h1>
          <p className="page-description">
            Sign in to access the Neighborhood Tool Sharing application.
          </p>
        </div>
      </div>

      {/* Login form. */}
      <form className="auth-card" onSubmit={handleSubmit}>
        <label htmlFor="login-email">
          Email
          <input
            id="login-email"
            type="email"
            name="email"
            defaultValue="member02@example.com"
            required
            pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
            title="Please enter a valid email address, such as name@example.com."
            autoComplete="email"
          />
        </label>

        <label htmlFor="login-password">
          Password
          <input
            id="login-password"
            type="password"
            name="password"
            defaultValue="devpass123"
            required
            autoComplete="current-password"
          />
        </label>

        <button
          className="primary-link auth-submit-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>

        {/* API error message. */}
        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        <p className="auth-helper-text">
          Demo accounts use the password <strong>devpass123</strong>.
        </p>

        <p className="auth-helper-text">
          Forgot your password?{' '}
          <Link to="/forgot-password">Reset password here</Link>.
        </p>

        <p className="auth-helper-text">
          Need an account? <Link to="/register">Register here</Link>.
        </p>
      </form>
    </section>
  );
}

export default LoginPage;
