import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');

    if (!emailPattern.test(email)) {
      setErrorMessage('Please enter a valid email address, such as name@example.com.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Password is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 429) {
          setErrorMessage(err.detail);
        } else {
          setErrorMessage('Invalid email or password.');
        }
      } else {
        setErrorMessage('Unable to connect to server. Make sure the backend is running on port 8000.');
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
            Sign in to Neighborhood Tool Sharing. Demo accounts: admin@example.com / member01@example.com / member02@example.com
          </p>
        </div>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <label htmlFor="login-email">
          Email
          <input
            id="login-email"
            type="email"
            name="email"
            defaultValue=""
            required
            pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
            title="Please enter a valid email address."
          />
        </label>

        <label htmlFor="login-password">
          Password
          <input
            id="login-password"
            type="password"
            name="password"
            defaultValue=""
            required
          />
        </label>

        <button
          className="primary-link auth-submit-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing in...' : 'Login'}
        </button>

        {errorMessage && <p className="form-error">{errorMessage}</p>}

        <p className="auth-helper-text">
          Forgot your password?{' '}
          <Link to="/forgot-password">Reset password here</Link>.
        </p>

        <p className="auth-helper-text">
          Need to verify your email?{' '}
          <Link to="/verify-email">Verify here</Link>.
        </p>

        <p className="auth-helper-text">
          Need an account? <Link to="/register">Register here</Link>.
        </p>
      </form>
    </section>
  );
}

export default LoginPage;
