import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { mockNotifications } from '../data/mockData';

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
 * Task 4 notification behavior:
 * - Shows unread notification count beside the Notifications nav link.
 * - Listens for localStorage changes from NotificationsPage.
 *
 * Important:
 * - This is frontend-only mock auth and mock notification behavior.
 * - Later, real AuthContext/backend auth can replace localStorage.
 */
function AppLayout() {
  // React Router navigation for redirecting after mock logout.
  const navigate = useNavigate();

  // localStorage key used by LoginPage and RegisterPage for mock auth.
  const mockAuthKey = 'mockAuthStatus';

  // localStorage key used by NotificationsPage for frontend-only read state.
  const notificationReadStateKey = 'mockNotificationReadState';

  /**
   * getStoredNotificationReadState
   *
   * Reads frontend-only notification read state from localStorage.
   */
  function getStoredNotificationReadState() {
    const storedValue = localStorage.getItem(notificationReadStateKey);

    if (!storedValue) {
      return {} as Record<string, boolean>;
    }

    try {
      return JSON.parse(storedValue) as Record<string, boolean>;
    } catch {
      return {} as Record<string, boolean>;
    }
  }

  /**
   * getUnreadNotificationCount
   *
   * Calculates unread notification count using:
   * - mockData.ts default read values
   * - localStorage override from NotificationsPage
   */
  function getUnreadNotificationCount() {
    const storedReadState = getStoredNotificationReadState();

    return mockNotifications.filter((notification) => {
      const isRead = storedReadState[notification.id] ?? notification.read;
      return !isRead;
    }).length;
  }

  /**
   * Mock login state.
   *
   * If localStorage contains mockAuthStatus = "logged-in",
   * the user sees member-only nav links.
   */
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem(mockAuthKey) === 'logged-in',
  );

  // Store unread notification count for the nav badge.
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(
    getUnreadNotificationCount,
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
   * Listen for notification read/unread changes.
   *
   * NotificationsPage dispatches "mock-notifications-change"
   * after marking notifications read or resetting the demo.
   */
  useEffect(() => {
    const syncNotificationCount = () => {
      setUnreadNotificationCount(getUnreadNotificationCount());
    };

    // Listen for same-tab notification changes.
    window.addEventListener('mock-notifications-change', syncNotificationCount);

    // Listen for localStorage changes from another tab.
    window.addEventListener('storage', syncNotificationCount);

    // Set the latest count when layout mounts.
    syncNotificationCount();

    // Clean up listeners when layout unmounts.
    return () => {
      window.removeEventListener(
        'mock-notifications-change',
        syncNotificationCount,
      );
      window.removeEventListener('storage', syncNotificationCount);
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

              {/* Notifications link with unread badge. */}
              <NavLink className={getNavLinkClass} to="/notifications">
                <span className="notification-nav-label">
                  Notifications
                  {unreadNotificationCount > 0 && (
                    <span className="nav-notification-badge">
                      {unreadNotificationCount}
                    </span>
                  )}
                </span>
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