// Import React runtime hook for showing inline registration error messages.
import { useState } from 'react';

// Import React type only for form submit event typing.
// This is required because verbatimModuleSyntax is enabled.
import type { FormEvent } from 'react';

// Import Link for navigation links and useNavigate for mock registration redirect.
import { Link, useNavigate } from 'react-router-dom';

/**
 * RegisterPage
 *
 * Current R1 behavior:
 * - Mock registration only.
 * - Saves login status to localStorage after registration.
 * - Updates AppLayout nav so Login/Register disappear and Logout appears.
 *
 * Frontend issues covered:
 * - #71 Create Register UI.
 * - #74 Show message "the invite is invalid".
 *
 * Email validation note:
 * - HTML input type="email" only checks basic email format.
 * - Extra pattern and JS validation are added so incomplete emails
 *   like "rion@e" do not pass.
 *
 * Invite validation note:
 * - This page uses mock invite-token validation for the R1 frontend demo.
 * - Later, the backend should validate the invite token.
 *
 * Future backend behavior:
 * - Replace this with real invite-token registration API and AuthContext.
 */
function RegisterPage() {
  // React Router navigation after mock registration succeeds.
  const navigate = useNavigate();

  // Inline error message shown inside the registration card.
  const [errorMessage, setErrorMessage] = useState('');

  // localStorage key used by AppLayout to show logged-in navigation.
  const mockAuthKey = 'mockAuthStatus';

  /**
   * Email pattern for R1 frontend validation.
   *
   * Requires:
   * - something before @
   * - something after @
   * - a dot after the domain
   * - something after the dot
   *
   * Valid:
   * - yafei@example.com
   * - student@hawaii.edu
   *
   * Invalid:
   * - rion@e
   * - a@b
   * - test@
   */
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Mock valid invite tokens.
   *
   * These tokens are only for frontend demo testing.
   * Real invite validation should happen in the backend.
   */
  const validInviteTokens = new Set([
    'INVITE-DEMO-001',
    'INVITE-DEMO-002',
    'DEMO-VALID',
  ]);

  /**
   * Mock invalid invite token messages.
   *
   * Reviewers can type these values into the Invite Token field
   * to test the issue #74 invalid invite message.
   */
  const invalidInviteMessages: Record<string, string> = {
    invalid: 'This invite is invalid. Please ask an admin for a new invite.',
    expired: 'This invite has expired. Please ask an admin for a new invite.',
    revoked: 'This invite has been revoked. Please ask an admin for a new invite.',
    used: 'This invite has already been used.',
  };

  /**
   * Handles mock registration form submission.
   *
   * Steps:
   * 1. Read display name, email, password, and invite token.
   * 2. Validate required fields.
   * 3. Validate full email format.
   * 4. Validate invite token for issue #74.
   * 5. Save mock login status.
   * 6. Redirect to dashboard.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Clear old error before validating the new registration attempt.
    setErrorMessage('');

    // Read the submitted values from the form.
    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get('displayName') || '').trim();
    const email = String(formData.get('email') || '')
      .trim()
      .toLowerCase();
    const password = String(formData.get('password') || '');
    const inviteToken = String(formData.get('inviteToken') || '').trim();

    // Stop registration if display name is missing.
    if (!displayName) {
      setErrorMessage('Display name is required.');
      return;
    }

    // Stop registration if the email does not match full email format.
    if (!emailPattern.test(email)) {
      setErrorMessage('Please enter a valid email address, such as name@example.com.');
      return;
    }

    // Stop registration if password is missing.
    if (!password.trim()) {
      setErrorMessage('Password is required.');
      return;
    }

    // Stop registration if invite token is missing.
    if (!inviteToken) {
      setErrorMessage('Invite token is required.');
      return;
    }

    // Normalize invite token for mock validation.
    const normalizedInviteToken = inviteToken.toUpperCase();
    const lowerInviteToken = inviteToken.toLowerCase();

    // Issue #74:
    // Show a specific invalid invite message for demo invalid cases.
    if (invalidInviteMessages[lowerInviteToken]) {
      setErrorMessage(invalidInviteMessages[lowerInviteToken]);
      return;
    }

    // Issue #74:
    // Show a generic invalid invite message for unknown invite tokens.
    if (!validInviteTokens.has(normalizedInviteToken)) {
      setErrorMessage('This invite is invalid. Please ask an admin for a new invite.');
      return;
    }

    // Save mock login state for the R1 frontend demo.
    localStorage.setItem(mockAuthKey, 'logged-in');

    // Tell AppLayout to refresh the nav links.
    window.dispatchEvent(new Event('mock-auth-change'));

    // After mock registration, send user to dashboard.
    navigate('/dashboard');
  };

  return (
    <section className="page-section">
      {/* Page title and short description. */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Invite-Only Access</p>
          <h1>Register</h1>
          <p className="page-description">
            Mock registration for the R1 frontend demo.
          </p>
        </div>
      </div>

      {/* Mock registration form. */}
      <form className="auth-card" onSubmit={handleSubmit}>
        {/* Display name field. */}
        <label htmlFor="register-display-name">
          Display Name
          <input
            id="register-display-name"
            type="text"
            name="displayName"
            defaultValue="Yafei Wang"
            required
          />
        </label>

        {/* Email field with stronger validation. */}
        <label htmlFor="register-email">
          Email
          <input
            id="register-email"
            type="email"
            name="email"
            defaultValue="yafei@example.com"
            required
            pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
            title="Please enter a valid email address, such as name@example.com."
          />
        </label>

        {/* Invite token field for invite-only registration. */}
        <label htmlFor="register-invite-token">
          Invite Token
          <input
            id="register-invite-token"
            type="text"
            name="inviteToken"
            defaultValue="INVITE-DEMO-001"
            required
            title="Enter a valid invite token from your admin invite email."
          />
        </label>

        {/* Password field for mock demo only. */}
        <label htmlFor="register-password">
          Password
          <input
            id="register-password"
            type="password"
            name="password"
            defaultValue="password123"
            required
          />
        </label>

        {/* Submit button. */}
        <button className="primary-link auth-submit-button" type="submit">
          Register
        </button>

        {/* Inline error message for issue #74 and other frontend validation. */}
        {errorMessage && <p className="form-error">{errorMessage}</p>}

        {/* Demo-only note. */}
        <p className="auth-helper-text">
          Demo only: this registration uses mock frontend authentication.
        </p>

        {/* Demo helper text for reviewers to test invalid invite messages. */}
        <p className="auth-helper-text">
          Demo invite tests: use <strong>invalid</strong>, <strong>expired</strong>,{' '}
          <strong>revoked</strong>, or <strong>used</strong> as the invite token.
        </p>

        {/* Link back to login. */}
        <p className="auth-helper-text">
          Already have an account? <Link to="/login">Login here</Link>.
        </p>
      </form>
    </section>
  );
}

export default RegisterPage;