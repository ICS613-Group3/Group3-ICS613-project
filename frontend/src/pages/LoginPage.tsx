// Import React runtime hook for showing inline login error messages.
import { useState } from 'react';

// Import React type only for form submit event typing.
// This is required because verbatimModuleSyntax is enabled.
import type { FormEvent } from 'react';

// Import Link for navigation links and useNavigate for mock login redirect.
import { Link, useNavigate } from 'react-router-dom';

/**
 * LoginPage
 *
 * Current R1 behavior:
 * - Mock login only.
 * - Saves login status to localStorage.
 * - Updates AppLayout nav so Login/Register disappear and Logout appears.
 *
 * Frontend issues covered:
 * - #81 Create the login UI.
 * - #83 Display an error message for email not verified / pending account.
 * - #85 Display a generic error message for invalid login.
 * - #89 Provides a link to the Forgot Password page.
 * - #110 Display a generic account not found / deleted account message.
 *
 * Email validation note:
 * - HTML input type="email" only checks for an "@" symbol.
 * - Without extra validation, values like "rion@e" can still pass.
 * - This page adds both a pattern attribute and a JS check to require
 *   a full email format like "name@example.com".
 *
 * Future backend behavior:
 * - Replace this with real login API and AuthContext.
 * - Replace demo trigger emails with backend API error responses.
 */
function LoginPage() {
  // React Router navigation after successful mock login.
  const navigate = useNavigate();

  // Inline error message shown inside the login card.
  const [errorMessage, setErrorMessage] = useState('');

  // localStorage key used by AppLayout to show logged-in navigation.
  const mockAuthKey = 'mockAuthStatus';

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

  /**
   * Mock login submit handler.
   *
   * Demo test emails:
   * - pending@example.com shows email-not-verified / pending-account message.
   * - deleted@example.com shows account not found / deleted-account message.
   * - invalid@example.com shows generic invalid login message.
   *
   * Any other valid email with a non-empty password logs in successfully.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Clear old error before validating the new login attempt.
    setErrorMessage('');

    // Read form values from the login form.
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '')
      .trim()
      .toLowerCase();
    const password = String(formData.get('password') || '');

    // Extra JS validation for reviewers/testing.
    // This prevents mock login from accepting incomplete emails like "rion@e".
    if (!emailPattern.test(email)) {
      setErrorMessage('Please enter a valid email address, such as name@example.com.');
      return;
    }

    // Extra password validation for the mock demo.
    if (!password.trim()) {
      setErrorMessage('Password is required.');
      return;
    }

    // Issue #83:
    // Mock backend response for an account that has not verified email yet.
    if (email === 'pending@example.com') {
      setErrorMessage(
        'Your account is pending email verification. Please verify your email or request a new verification email.',
      );
      return;
    }

    // Issue #110:
    // Mock backend response for an account that does not exist or was deleted.
    if (email === 'deleted@example.com' || email === 'notfound@example.com') {
      setErrorMessage(
        'Account not found. Please check your email address or contact support if you recently deleted your account.',
      );
      return;
    }

    // Issue #85:
    // Mock invalid login test case.
    // This gives reviewers a way to test the generic invalid-login message.
    if (email === 'invalid@example.com' || password === 'wrongpassword') {
      setErrorMessage('Invalid email or password.');
      return;
    }

    // Mock successful login.
    // This keeps the existing frontend-only login behavior.
    localStorage.setItem(mockAuthKey, 'logged-in');

    // Notify AppLayout so the nav changes without refreshing the page.
    window.dispatchEvent(new Event('mock-auth-change'));

    // Redirect the logged-in mock user to the dashboard.
    navigate('/dashboard');
  };

  return (
    <section className="page-section">
      {/* Page header for the login screen. */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Member Access</p>
          <h1>Login</h1>
          <p className="page-description">
            Mock login for the R1 frontend demo.
          </p>
        </div>
      </div>

      {/* Login form card. */}
      <form className="auth-card" onSubmit={handleSubmit}>
        {/* Email input with stronger validation than type="email" alone. */}
        <label htmlFor="login-email">
          Email
          <input
            id="login-email"
            type="email"
            name="email"
            defaultValue="yafei@example.com"
            required
            pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
            title="Please enter a valid email address, such as name@example.com."
          />
        </label>

        {/* Password input for mock login. */}
        <label htmlFor="login-password">
          Password
          <input
            id="login-password"
            type="password"
            name="password"
            defaultValue="password123"
            required
          />
        </label>

        {/* Login submit button. */}
        <button className="primary-link auth-submit-button" type="submit">
          Login
        </button>

        {/* Inline error message for issues #83, #85, and #110. */}
        {errorMessage && <p className="form-error">{errorMessage}</p>}

        {/* Demo note explains this is frontend-only mock authentication. */}
        <p className="auth-helper-text">
          Demo only: this login uses mock frontend authentication.
        </p>

        {/* Forgot password link for frontend issue #89. */}
        <p className="auth-helper-text">
          Forgot your password?{' '}
          <Link to="/forgot-password">Reset password here</Link>.
        </p>

        {/* Register link for users who do not have an account. */}
        <p className="auth-helper-text">
          Need an account? <Link to="/register">Register here</Link>.
        </p>

        {/* Demo helper text for reviewers to test error states. */}
        <p className="auth-helper-text">
          Demo error tests: use <strong>pending@example.com</strong>,{' '}
          <strong>deleted@example.com</strong>, <strong>invalid@example.com</strong>,
          or password <strong>wrongpassword</strong>.
        </p>
      </form>
    </section>
  );
}

export default LoginPage;