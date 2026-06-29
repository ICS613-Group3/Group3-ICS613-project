import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * RegisterPage
 *
 * Current R1 behavior:
 * - Mock registration only.
 * - After submit, user is treated as logged in.
 *
 * Future backend behavior:
 * - Replace this with real register API and AuthContext.
 */
function RegisterPage() {
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
          <p className="eyebrow">Create Account</p>
          <h1>Register</h1>
          <p className="page-description">
            Mock registration for the R1 frontend demo.
          </p>
        </div>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <label>
          Display Name
          <input type="text" defaultValue="Yafei Wang" required />
        </label>

        <label>
          Email
          <input type="email" defaultValue="yafei@example.com" required />
        </label>

        <label>
          Password
          <input type="password" defaultValue="password123" required />
        </label>

        <button className="primary-link auth-submit-button" type="submit">
          Register
        </button>

        <p className="auth-helper-text">
          Already have an account? <Link to="/login">Login here</Link>.
        </p>
      </form>
    </section>
  );
}

export default RegisterPage;
