import { NavLink, Outlet } from 'react-router-dom';

/**
 * AppLayout
 *
 * This component controls the shared page layout:
 * - Top header
 * - Main navigation
 * - Page content through <Outlet />
 *
 * Update:
 * Browse Tools now has a hover dropdown menu:
 * - Available Tools
 * - Returned Tools
 * - Add New Tools
 */
function AppLayout() {
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

          {/*
            Browse Tools dropdown menu

            Current R1 mock behavior:
            - Available Tools opens the normal browse page.
            - Returned Tools opens Browse Tools with the returned-tools filter.
            - Add New Tools opens the US8 Create Tool page.

            Later backend behavior:
            - Returned Tools should load real returned reservations/tools from API.
          */}
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

          <NavLink className="nav-link" to="/login">
            Login
          </NavLink>

          <NavLink className="nav-link" to="/register">
            Register
          </NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
