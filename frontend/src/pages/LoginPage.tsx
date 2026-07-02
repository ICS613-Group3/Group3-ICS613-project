import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../context/authContextValue';
import { EMAIL_PATTERN, isValidEmail } from '../utils/validation';

/**
 * LoginPage
 *
 * Real backend login via ``POST /auth/login``. On success, ``AuthContext``
 * stores the token pair and fetches ``GET /auth/me``. Errors are mapped
 * from the backend's ``ApiError`` so the user sees the backend's
 * ``detail`` message (e.g. "Invalid email or password", 429 throttle
 * messages, etc.).
 */
function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setErrorMessage('Please enter a valid email address (e.g. you@example.com).');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmed, password);
      navigate('/dashboard');
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
          <p className="eyebrow">Member Access</p>
          <h1>Login</h1>
          <p className="page-description">
            Sign in to your Neighborhood Tool Sharing account.
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
            autoComplete="current-password"
            required
          />
        </label>

        <button
          className="primary-link auth-submit-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing in…' : 'Login'}
        </button>

        {errorMessage && (
          <p className="error-message" role="alert">
            {errorMessage}
          </p>
        )}

        <p className="auth-helper-text">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <p className="auth-helper-text">
          Need an account? <Link to="/register">Register here</Link>.
        </p>
        <p className="auth-helper-text auth-helper-text-muted">
          Demo accounts: <code>admin@example.com</code>,
          {' '}<code>member01@example.com</code>,
          {' '}<code>member02@example.com</code> — password{' '}
          <code>devpass123</code> (after running <code>scripts/seed_dev.py</code>).
        </p>
      </form>
    </section>
  );
}

export default LoginPage;
