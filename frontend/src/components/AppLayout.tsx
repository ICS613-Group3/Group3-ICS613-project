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
 * - If user is not logged in, show only Login and Register.
 * - If user is logged in, show member navigation and Logout.
 *
 * Important:
 * - This is frontend-only mock auth.
 * - Later, real AuthContext/backend auth can replace localStorage.
 */
function AppLayout() {
  // React Router navigation for redirecting after mock logout.
  const navigate = useNavigate();

  // localStorage key used by LoginPage and RegisterPage for mock auth.
  const mockAuthKey = 'mockAuthStatus';

  /**
   * Mock login state.
   *
   * If localStorage contains mockAuthStatus = "logged-in",
   * the user sees member-only nav links.
   */
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem(mockAuthKey) === 'logged-in',
  );

  /**
   * Listen for mock login/register/logout changes.
   *
   * LoginPage and RegisterPage dispatch "mock-auth-change"
   * after mock login/register.
   *
   * Logout also dispatches the same event after clearing localStorage.
   */
  useEffect(() => {
    const syncMockAuth = () => {
      setIsLoggedIn(localStorage.getItem(mockAuthKey) === 'logged-in');
    };

    // Listen for same-tab mock auth changes.
    window.addEventListener('mock-auth-change', syncMockAuth);

    // Listen for localStorage changes from another browser tab.
    window.addEventListener('storage', syncMockAuth);

    // Clean up listeners when layout unmounts.
    return () => {
      window.removeEventListener('mock-auth-change', syncMockAuth);
      window.removeEventListener('storage', syncMockAuth);
    };
  }, []);

  /**
   * Shared NavLink class helper.
   *
   * React Router gives us isActive.
   * Active links receive both "nav-link" and "active".
   */
  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav-link active' : 'nav-link';

  /**
   * Mock logout for R1 frontend demo.
   *
   * This clears the mock login flag, updates the nav,
   * and redirects the user back to Login.
   */
  const handleLogout = () => {
    localStorage.removeItem(mockAuthKey);
    window.dispatchEvent(new Event('mock-auth-change'));
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {/* App header with project title and top navigation. */}
      <header className="app-header">
        {/* Project branding. */}
        <div>
          <p className="eyebrow">ICS 613 Group 3</p>
          <h1>Neighborhood Tool Sharing</h1>
        </div>

        {/* Top navigation. */}
        <nav className="app-nav" aria-label="Main navigation">
          {isLoggedIn ? (
            <>
              {/* Member dashboard link. */}
              <NavLink className={getNavLinkClass} to="/dashboard">
                Dashboard
              </NavLink>

              {/* Browse Tools dropdown. */}
              <div className="nav-dropdown">
                <NavLink className="nav-link nav-dropdown-toggle" to="/tools">
                  Browse Tools
                </NavLink>

                {/* Tool-related dropdown links. */}
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

              {/* Reservation workflow link. */}
              <NavLink className={getNavLinkClass} to="/reservations">
                Reservations
              </NavLink>

              {/* Review history link. */}
              <NavLink className={getNavLinkClass} to="/reviews/history">
                Review History
              </NavLink>

              {/* Notifications link. */}
              <NavLink className={getNavLinkClass} to="/notifications">
                Notifications
              </NavLink>

              {/* Profile edit link for frontend issue #102. */}
              <NavLink className={getNavLinkClass} to="/profile/edit">
                Profile
              </NavLink>

              {/* Account deletion link for frontend issues #105 and #107. */}
              <NavLink className={getNavLinkClass} to="/account/delete">
                Delete Account
              </NavLink>

              {/* Admin invite management link for frontend issues #62, #63, and #64. */}
              <NavLink className={getNavLinkClass} to="/admin/invites">
                Admin Invites
              </NavLink>

              {/* US11 admin listing controls link. */}
              <NavLink className={getNavLinkClass} to="/admin/listings">
                Admin Listings
              </NavLink>

              {/* Logout action button styled like a nav tab. */}
              <button
                className="nav-link nav-button"
                type="button"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              {/* Public login link. */}
              <NavLink className={getNavLinkClass} to="/login">
                Login
              </NavLink>

              {/* Public register link. */}
              <NavLink className={getNavLinkClass} to="/register">
                Register
              </NavLink>
            </>
          )}
        </nav>
      </header>

      {/* Page content rendered by React Router child routes. */}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;