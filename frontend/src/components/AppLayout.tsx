import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

// Import real backend authentication functions and token helpers.
import { authApi } from '../api/auth';
import { clearTokens, hasTokens } from '../api/client';

// Notifications still use mock data until notification API integration is completed.
import { mockNotifications } from '../data/mockData';

/**
 * AppLayout
 *
 * Shared application layout containing:
 * - Project header
 * - Navigation
 * - Authentication-aware links
 * - Notification badge
 * - Child page content through <Outlet />
 *
 * Authentication behavior:
 * - Real API login stores JWT access and refresh tokens.
 * - Logged-in navigation is shown when valid tokens are stored.
 * - Logout calls the backend and clears local tokens.
 *
 * Temporary compatibility:
 * - mockAuthStatus is still recognized because some pages, such as
 *   registration and profile pages, have not yet been connected to the API.
 * - Notifications still use mock data and localStorage.
 */
function AppLayout() {
  // React Router navigation for redirecting after logout.
  const navigate = useNavigate();

  // Temporary localStorage key used by remaining mock authentication pages.
  const mockAuthKey = 'mockAuthStatus';

  // localStorage key used by the mock notification read state.
  const notificationReadStateKey = 'mockNotificationReadState';

  /**
   * Read the frontend-only notification state from localStorage.
   */
  function getStoredNotificationReadState(): Record<string, boolean> {
    const storedValue = localStorage.getItem(notificationReadStateKey);

    if (!storedValue) {
      return {};
    }

    try {
      return JSON.parse(storedValue) as Record<string, boolean>;
    } catch {
      return {};
    }
  }

  /**
   * Calculate the unread notification count.
   *
   * This currently combines:
   * - Default notification values from mockData.ts
   * - Read-state overrides saved by NotificationsPage
   */
  function getUnreadNotificationCount(): number {
    const storedReadState = getStoredNotificationReadState();

    return mockNotifications.filter((notification) => {
      const isRead =
        storedReadState[notification.id] ?? notification.read;

      return !isRead;
    }).length;
  }

  /**
   * Authentication state.
   *
   * A user is treated as logged in when:
   * - Real JWT tokens are stored, or
   * - The temporary mockAuthStatus flag exists
   */
  const [isLoggedIn, setIsLoggedIn] = useState(
    () =>
      hasTokens() ||
      localStorage.getItem(mockAuthKey) === 'logged-in',
  );

  // Store the current unread notification count for the navigation badge.
  const [unreadNotificationCount, setUnreadNotificationCount] =
    useState(getUnreadNotificationCount);

  /**
   * Keep navigation synchronized with authentication changes.
   *
   * auth-change:
   * - Used for real API authentication changes.
   *
   * mock-auth-change:
   * - Temporarily used by pages that still use mock authentication.
   *
   * storage:
   * - Detects authentication changes made in another browser tab.
   */
  useEffect(() => {
    const syncAuth = () => {
      const authenticated =
        hasTokens() ||
        localStorage.getItem(mockAuthKey) === 'logged-in';

      setIsLoggedIn(authenticated);
    };

    // Listen for real API authentication changes.
    window.addEventListener('auth-change', syncAuth);

    // Temporarily listen for remaining mock authentication changes.
    window.addEventListener('mock-auth-change', syncAuth);

    // Listen for localStorage updates from other browser tabs.
    window.addEventListener('storage', syncAuth);

    // Synchronize state when the layout first mounts.
    syncAuth();

    // Remove listeners when the component unmounts.
    return () => {
      window.removeEventListener('auth-change', syncAuth);
      window.removeEventListener('mock-auth-change', syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  /**
   * Keep the notification badge synchronized with mock notification changes.
   *
   * This will later be replaced by notificationsApi.
   */
  useEffect(() => {
    const syncNotificationCount = () => {
      setUnreadNotificationCount(getUnreadNotificationCount());
    };

    // Listen for notification changes made in the current browser tab.
    window.addEventListener(
      'mock-notifications-change',
      syncNotificationCount,
    );

    // Listen for notification changes made in another browser tab.
    window.addEventListener('storage', syncNotificationCount);

    // Calculate the current count when the layout mounts.
    syncNotificationCount();

    // Remove listeners when the component unmounts.
    return () => {
      window.removeEventListener(
        'mock-notifications-change',
        syncNotificationCount,
      );
      window.removeEventListener('storage', syncNotificationCount);
    };
  }, []);

  /**
   * Return the appropriate CSS class for active navigation links.
   */
  const getNavLinkClass = ({
    isActive,
  }: {
    isActive: boolean;
  }): string =>
    isActive ? 'nav-link active' : 'nav-link';

  /**
   * Log out the current user.
   *
   * Process:
   * 1. Notify the backend when JWT tokens exist.
   * 2. Clear local access and refresh tokens.
   * 3. Clear the temporary mock authentication flag.
   * 4. Update the navigation.
   * 5. Redirect to the login page.
   *
   * Local cleanup still occurs if the backend logout request fails.
   */
  const handleLogout = async (): Promise<void> => {
    try {
      // Call POST /api/v1/auth/logout only for a real API session.
      if (hasTokens()) {
        await authApi.logout();
      }
    } catch (error) {
      // Logout should still complete locally if the server is unavailable.
      console.warn(
        'Backend logout failed. Local authentication data will still be cleared.',
        error,
      );
    } finally {
      // Remove real API access and refresh tokens.
      clearTokens();

      // Remove temporary mock authentication status.
      localStorage.removeItem(mockAuthKey);

      // Notify the current browser tab that authentication changed.
      window.dispatchEvent(new Event('auth-change'));
      window.dispatchEvent(new Event('mock-auth-change'));

      // Return the user to the login page.
      navigate('/login');
    }
  };

  return (
    <div className="app-shell">
      {/* Application header containing branding and navigation. */}
      <header className="app-header">
        {/* Project branding. */}
        <div>
          <p className="eyebrow">ICS 613 Group 3</p>
          <h1>Neighborhood Tool Sharing</h1>
        </div>

        {/* Authentication-aware top navigation. */}
        <nav className="app-nav" aria-label="Main navigation">
          {isLoggedIn ? (
            <>
              {/* Member dashboard. */}
              <NavLink
                className={getNavLinkClass}
                to="/dashboard"
              >
                Dashboard
              </NavLink>

              {/* Browse Tools dropdown. */}
              <div className="nav-dropdown">
                <NavLink
                  className="nav-link nav-dropdown-toggle"
                  to="/tools"
                >
                  Browse Tools
                </NavLink>

                <div className="nav-dropdown-menu">
                  {/* Available tools. */}
                  <NavLink
                    className="nav-dropdown-item"
                    to="/tools"
                  >
                    Available Tools
                  </NavLink>

                  {/* Returned tools. */}
                  <NavLink
                    className="nav-dropdown-item"
                    to="/tools?view=returned"
                  >
                    Returned Tools
                  </NavLink>

                  {/* Create a new tool listing. */}
                  <NavLink
                    className="nav-dropdown-item"
                    to="/tools/new"
                  >
                    Add New Tools
                  </NavLink>
                </div>
              </div>

              {/* Reservation workflow. */}
              <NavLink
                className={getNavLinkClass}
                to="/reservations"
              >
                Reservations
              </NavLink>

              {/* Review history. */}
              <NavLink
                className={getNavLinkClass}
                to="/reviews/history"
              >
                Review History
              </NavLink>

              {/* Notifications with the current unread badge. */}
              <NavLink
                className={getNavLinkClass}
                to="/notifications"
              >
                <span className="notification-nav-label">
                  Notifications

                  {unreadNotificationCount > 0 && (
                    <span className="nav-notification-badge">
                      {unreadNotificationCount}
                    </span>
                  )}
                </span>
              </NavLink>

              {/* Profile editing. */}
              <NavLink
                className={getNavLinkClass}
                to="/profile/edit"
              >
                Profile
              </NavLink>

              {/* Account deletion. */}
              <NavLink
                className={getNavLinkClass}
                to="/account/delete"
              >
                Delete Account
              </NavLink>

              {/* Admin invitation management. */}
              <NavLink
                className={getNavLinkClass}
                to="/admin/invites"
              >
                Admin Invites
              </NavLink>

              {/* Admin listing management. */}
              <NavLink
                className={getNavLinkClass}
                to="/admin/listings"
              >
                Admin Listings
              </NavLink>

              {/* Real logout action. */}
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
              {/* Public login page. */}
              <NavLink
                className={getNavLinkClass}
                to="/login"
              >
                Login
              </NavLink>

              {/* Public registration page. */}
              <NavLink
                className={getNavLinkClass}
                to="/register"
              >
                Register
              </NavLink>
            </>
          )}
        </nav>
      </header>

      {/* Render the current child route. */}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;