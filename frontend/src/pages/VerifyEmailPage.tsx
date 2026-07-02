import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, authApi, tokenStore } from '../api/client';
import { useAuth } from '../context/authContextValue';

/**
 * VerifyEmailPage
 *
 * US2 — verify a user's email address using the token emailed to them.
 * The link in the email looks like ``/verify-email?token=<token>``; we
 * read the token from the query string, call
 * ``POST /auth/verify-email``, and on success the backend returns a
 * fresh token pair. We store those tokens, fetch ``/auth/me`` to
 * refresh the user, and route to the dashboard.
 */
function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'pending' | 'success' | 'error'>(
    token ? 'pending' : 'error',
  );
  const [errorMessage, setErrorMessage] = useState(token ? '' : 'No token provided.');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const tokens = await authApi.verifyEmail(token);
        tokenStore.set(tokens.access_token, tokens.refresh_token);
        await refreshProfile();
        if (cancelled) return;
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 1500);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Verification failed.');
        }
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, navigate, refreshProfile]);

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US2 — Email Verification</p>
          <h1>Verify your email</h1>
        </div>
      </div>

      <div className="auth-card">
        {status === 'pending' && (
          <p role="status">Verifying your email…</p>
        )}
        {status === 'success' && (
          <>
            <p className="success-message" role="status">
              Email verified! Redirecting to the dashboard…
            </p>
            <p className="auth-helper-text">
              <Link to="/dashboard">Continue manually</Link>
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="error-message" role="alert">
              {errorMessage}
            </p>
            <p className="auth-helper-text">
              If your link expired, request a new one below.
            </p>
            <ResendForm />
          </>
        )}
      </div>
    </section>
  );
}

/**
 * ResendForm
 *
 * A small inline form to request a fresh verification email. Lives in
 * this file because it only makes sense on the verify-email page.
 */
function ResendForm() {
  const [email, setEmail] = useState('');
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSentAt(null);
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    setIsSending(true);
    try {
      await authApi.resendVerification(email.trim());
      setSentAt(new Date().toLocaleTimeString());
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to resend verification email.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="resend-form">
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <button type="submit" disabled={isSending}>
        {isSending ? 'Sending…' : 'Resend verification email'}
      </button>
      {sentAt && (
        <p className="success-message" role="status">
          Sent at {sentAt}. Check MailHog at http://localhost:8025 in dev.
        </p>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export default VerifyEmailPage;
