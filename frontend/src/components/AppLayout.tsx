import { useNavigate } from 'react-router-dom';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/authContextValue';

/**
 * AppLayout
 *
 * Shared layout for:
 * - Header
 * - Top navigation
 * - Page content through <Outlet />
 *
 * Reads auth state from ``AuthContext`` instead of localStorage so it
 * stays in sync with the API client (token refresh, logout, etc.).
 */
function AppLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, isInitializing, user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
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
            <span className="nav-link nav-dropdown-toggle">Browse Tools</span>

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

              <NavLink className="nav-dropdown-item" to="/tools/me">
                My Listings
              </NavLink>
            </div>
          </div>

          <NavLink className="nav-link" to="/reservations">
            Reservations
          </NavLink>

          <NavLink className="nav-link" to="/reviews/history">
            Review History
          </NavLink>

          {isInitializing ? null : isAuthenticated ? (
            <>
              <div className="nav-dropdown">
                <span className="nav-link nav-dropdown-toggle">
                  {user?.full_name ?? user?.email ?? 'Account'}
                </span>
                <div className="nav-dropdown-menu nav-dropdown-menu-right">
                  <NavLink className="nav-dropdown-item" to="/profile">
                    Profile
                  </NavLink>
                  <NavLink className="nav-dropdown-item" to="/notifications">
                    Notifications
                  </NavLink>
                  {user?.is_admin && (
                    <>
                      <NavLink className="nav-dropdown-item" to="/admin/listings">
                        Admin · Listings
                      </NavLink>
                      <NavLink className="nav-dropdown-item" to="/admin/invites">
                        Admin · Invites
                      </NavLink>
                      <NavLink className="nav-dropdown-item" to="/admin/audit-log">
                        Admin · Audit Log
                      </NavLink>
                    </>
                  )}
                  <button
                    type="button"
                    className="nav-dropdown-item nav-dropdown-button"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              </div>
            </>
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
