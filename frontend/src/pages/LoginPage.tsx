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
 * Email validation note:
 * - HTML input type="email" only checks for an "@" symbol.
 * - Without extra validation, values like "rion@e" can still pass.
 * - This page adds both a pattern attribute and a JS check to require
 *   a full email format like "name@example.com".
 *
 * Future backend behavior:
 * - Replace this with real login API and AuthContext.
 */
function LoginPage() {
  const navigate = useNavigate();

  /**
   * Requires:
   * - text before @
   * - text after @
   * - a dot after the domain
   * - text after the dot
   *
   * Valid examples:
   * - yafei@example.com
   * - student@hawaii.edu
   *
   * Invalid examples:
   * - rion@e
   * - a@b
   * - test@
   */
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim();

    // Extra JS validation for reviewers/testing.
    // This prevents mock login from accepting incomplete emails like "rion@e".
    if (!emailPattern.test(email)) {
      alert('Please enter a valid email address, such as name@example.com.');
      return;
    }

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
          <input
            type="email"
            name="email"
            defaultValue="yafei@example.com"
            required
            pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
            title="Please enter a valid email address, such as name@example.com."
          />
        </label>

        <label>
          Password
          <input
            type="password"
            name="password"
            defaultValue="password123"
            required
          />
        </label>

        <button className="primary-link auth-submit-button" type="submit">
          Login
        </button>

        <p className="auth-helper-text">
          Demo only: this login uses mock frontend authentication.
        </p>

        <p className="auth-helper-text">
          Need an account? <Link to="/register">Register here</Link>.
        </p>
      </form>
    </section>
  );
}

export default LoginPage;