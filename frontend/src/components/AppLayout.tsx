import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

/**
 * AppLayout
 *
 * Shared layout for:
 * - Header
 * - Top navigation
 * - Page content through <Outlet />
 *
 * Current R1 mock auth behavior:
 * - If user is not logged in, show Login and Register.
 * - If user is logged in, hide Login/Register and show Logout.
 *
 * Important:
 * - This is frontend-only mock auth.
 * - Later, Ivan's real AuthContext/backend auth can replace localStorage.
 */
function AppLayout() {
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem('mockAuthStatus') === 'logged-in',
  );

  /**
   * Listen for mock login/register/logout changes.
   * LoginPage and RegisterPage will dispatch this event after mock login.
   */
  useEffect(() => {
    const syncMockAuth = () => {
      setIsLoggedIn(localStorage.getItem('mockAuthStatus') === 'logged-in');
    };

    window.addEventListener('mock-auth-change', syncMockAuth);

    return () => {
      window.removeEventListener('mock-auth-change', syncMockAuth);
    };
  }, []);

  /**
   * Mock logout for R1 frontend demo.
   */
  const handleLogout = () => {
    localStorage.removeItem('mockAuthStatus');
    window.dispatchEvent(new Event('mock-auth-change'));
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">ICS 613 Group 3</p>
          <h1>Neighborhood Tool Sharing</h1>
        </div>

        <nav className="app-nav">
          <NavLink className="nav-link" to="/dashboard">
            Dashboard
          </NavLink>

          <div className="nav-dropdown">
            <NavLink className="nav-link nav-dropdown-toggle" to="/tools">
              Browse Tools
            </NavLink>

            <div className="nav-dropdown-menu">
              <NavLink className="nav-dropdown-item" to="/tools">
                Available Tools
              </NavLink>

              <NavLink className="nav-dropdown-item" to="/tools?view=returned">
                Returned Tools
              </NavLink>

              <NavLink className="nav-dropdown-item" to="/tools/new">
                Add New Tools
              </NavLink>
            </div>
          </div>

          <NavLink className="nav-link" to="/reservations">
            Reservations
          </NavLink>

          <NavLink className="nav-link" to="/reviews/history">
            Review History
          </NavLink>

          {isLoggedIn ? (
            <button className="nav-link nav-button" type="button" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <>
              <NavLink className="nav-link" to="/login">
                Login
              </NavLink>

              <NavLink className="nav-link" to="/register">
                Register
              </NavLink>
            </>
          )}
        </nav>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
