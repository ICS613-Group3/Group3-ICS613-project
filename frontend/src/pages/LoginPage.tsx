import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * LoginPage
 *
 * Current R1 behavior:
 * - Mock login only.
 * - Saves login status to localStorage.
 * - Updates AppLayout nav so Login/Register disappear and Logout appears.
 *
 * Future backend behavior:
 * - Replace this with real login API and AuthContext.
 */
function LoginPage() {
  const navigate = useNavigate();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    localStorage.setItem('mockAuthStatus', 'logged-in');
    window.dispatchEvent(new Event('mock-auth-change'));

    navigate('/dashboard');
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Member Access</p>
          <h1>Login</h1>
          <p className="page-description">
            Mock login for the R1 frontend demo.
          </p>
        </div>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" defaultValue="yafei@example.com" required />
        </label>

        <label>
          Password
          <input type="password" defaultValue="password123" required />
        </label>

        <button className="primary-link auth-submit-button" type="submit">
          Login
        </button>

        <p className="auth-helper-text">
          Need an account? <Link to="/register">Register here</Link>.
        </p>
      </form>
    </section>
  );
}

export default LoginPage;
