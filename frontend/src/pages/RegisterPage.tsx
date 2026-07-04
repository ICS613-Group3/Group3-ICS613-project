import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * RegisterPage
 *
 * Current R1 behavior:
 * - Mock registration only.
 * - Saves login status to localStorage after registration.
 * - Updates AppLayout nav so Login/Register disappear and Logout appears.
 *
 * Email validation note:
 * - HTML input type="email" only checks basic email format.
 * - Extra pattern and JS validation are added so incomplete emails
 *   like "rion@e" do not pass.
 *
 * Future backend behavior:
 * - Replace this with real invite-token registration API and AuthContext.
 */
function RegisterPage() {
  // React Router navigation after mock registration succeeds.
  const navigate = useNavigate();

  /**
   * Email pattern for R1 frontend validation.
   *
   * Requires:
   * - something before @
   * - something after @
   * - a dot after the domain
   * - something after the dot
   *
   * Valid: yafei@example.com
   * Invalid: rion@e
   */
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Handles mock registration form submission.
   *
   * This validates the email first, then stores mock login status.
   * Later, this block can be replaced with a real backend API call.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Read the submitted email from the form.
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim();

    // Stop registration if the email does not match full email format.
    if (!emailPattern.test(email)) {
      alert('Please enter a valid email address, such as name@example.com.');
      return;
    }

    // Save mock login state for the R1 frontend demo.
    localStorage.setItem('mockAuthStatus', 'logged-in');

    // Tell AppLayout to refresh the nav links.
    window.dispatchEvent(new Event('mock-auth-change'));

    // After mock registration, send user to dashboard.
    navigate('/dashboard');
  };

  return (
    <section className="page-section">
      {/* Page title and short description */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Invite-Only Access</p>
          <h1>Register</h1>
          <p className="page-description">
            Mock registration for the R1 frontend demo.
          </p>
        </div>
      </div>

      {/* Mock registration form */}
      <form className="auth-card" onSubmit={handleSubmit}>
        {/* Display name field */}
        <label>
          Display Name
          <input
            type="text"
            name="displayName"
            defaultValue="Yafei Wang"
            required
          />
        </label>

        {/* Email field with stronger validation */}
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

        {/* Password field for mock demo only */}
        <label>
          Password
          <input
            type="password"
            name="password"
            defaultValue="password123"
            required
          />
        </label>

        {/* Submit button */}
        <button className="primary-link auth-submit-button" type="submit">
          Register
        </button>

        {/* Demo-only note */}
        <p className="auth-helper-text">
          Demo only: this registration uses mock frontend authentication.
        </p>

        {/* Link back to login */}
        <p className="auth-helper-text">
          Already have an account? <Link to="/login">Login here</Link>.
        </p>
      </form>
    </section>
  );
}

export default RegisterPage;