import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';

function RegisterPage() {
  const { register } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get('displayName') || '').trim();
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');
    const inviteToken = String(formData.get('inviteToken') || '').trim();

    if (!fullName) {
      setErrorMessage('Display name is required.');
      return;
    }

    if (!emailPattern.test(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    if (!inviteToken) {
      setErrorMessage('Invite token is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ email, password, full_name: fullName, invite_token: inviteToken });
      setSuccessMessage('Registration successful! Please check your email and verify your account at /verify-email.');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMessage(err.detail);
      } else {
        setErrorMessage('Unable to connect to server.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Invite-Only Access</p>
          <h1>Register</h1>
          <p className="page-description">
            Create an account with a valid invite token. The backend requires a real invite token from an admin.
          </p>
        </div>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <label htmlFor="register-display-name">
          Display Name
          <input
            id="register-display-name"
            type="text"
            name="displayName"
            defaultValue=""
            required
          />
        </label>

        <label htmlFor="register-email">
          Email
          <input
            id="register-email"
            type="email"
            name="email"
            defaultValue=""
            required
            pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
            title="Please enter a valid email address."
          />
        </label>

        <label htmlFor="register-invite-token">
          Invite Token
          <input
            id="register-invite-token"
            type="text"
            name="inviteToken"
            defaultValue=""
            required
            title="Enter a valid invite token from your admin invite email."
          />
        </label>

        <label htmlFor="register-password">
          Password
          <input
            id="register-password"
            type="password"
            name="password"
            defaultValue=""
            required
            minLength={8}
          />
        </label>

        <button
          className="primary-link auth-submit-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Registering...' : 'Register'}
        </button>

        {errorMessage && <p className="form-error">{errorMessage}</p>}
        {successMessage && <p className="success-message">{successMessage}</p>}

        <p className="auth-helper-text">
          Already have an account? <Link to="/login">Login here</Link>.
        </p>
      </form>
    </section>
  );
}

export default RegisterPage;
