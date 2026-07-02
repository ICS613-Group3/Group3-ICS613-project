import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import AdminAuditLogPage from '../pages/AdminAuditLogPage';
import AdminInvitesPage from '../pages/AdminInvitesPage';
import AdminListingsPage from '../pages/AdminListingsPage';
import BrowseToolsPage from '../pages/BrowseToolsPage';
import CreateToolPage from '../pages/CreateToolPage';
import DashboardPage from '../pages/DashboardPage';
import EditToolPage from '../pages/EditToolPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import LoginPage from '../pages/LoginPage';
import MyToolsPage from '../pages/MyToolsPage';
import NotFoundPage from '../pages/NotFoundPage';
import NotificationsPage from '../pages/NotificationsPage';
import ProfilePage from '../pages/ProfilePage';
import RegisterPage from '../pages/RegisterPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import ReservationDetailPage from '../pages/ReservationDetailPage';
import ReservationsPage from '../pages/ReservationsPage';
import ReviewHistoryPage from '../pages/ReviewHistoryPage';
import ReviewPage from '../pages/ReviewPage';
import ToolDetailPage from '../pages/ToolDetailPage';
import VerifyEmailPage from '../pages/VerifyEmailPage';
import { useAuth } from '../context/authContextValue';
import type { ReactElement } from 'react';

/**
 * Guard wrapper that redirects unauthenticated users to /login.
 *
 * ``requireAuth`` (default true) means "you must be signed in".
 * When false, signed-in users are bounced to the dashboard — useful
 * for /login and /register so already-authenticated users don't see
 * the form again.
 */
function RequireAuth({
  children,
  requireAuth = true,
}: {
  children: ReactElement;
  requireAuth?: boolean;
}) {
  const { isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) {
    return (
      <section className="page-section">
        <p>Loading…</p>
      </section>
    );
  }
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!requireAuth && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

/**
 * Admin-only wrapper. Renders the children only if the current user has
 * ``is_admin=true``. Non-admins are bounced to the dashboard.
 */
function RequireAdmin({ children }: { children: ReactElement }) {
  const { user, isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) {
    return (
      <section className="page-section">
        <p>Loading…</p>
      </section>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Default route sends users to the dashboard */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />

        {/* Tools (R1.B: US8–US12) */}
        <Route
          path="/tools"
          element={
            <RequireAuth>
              <BrowseToolsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tools/new"
          element={
            <RequireAuth>
              <CreateToolPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tools/me"
          element={
            <RequireAuth>
              <MyToolsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tools/:toolId"
          element={
            <RequireAuth>
              <ToolDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tools/:toolId/edit"
          element={
            <RequireAuth>
              <EditToolPage />
            </RequireAuth>
          }
        />

        {/* Reservations (R1.B: US13–US21) */}
        <Route
          path="/reservations"
          element={
            <RequireAuth>
              <ReservationsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/reservations/:reservationId"
          element={
            <RequireAuth>
              <ReservationDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/reservations/:reservationId/review"
          element={
            <RequireAuth>
              <ReviewPage />
            </RequireAuth>
          }
        />

        {/* Reviews (R1.B: US24–US25) */}
        <Route
          path="/reviews/history"
          element={
            <RequireAuth>
              <ReviewHistoryPage />
            </RequireAuth>
          }
        />

        {/* Profile (R1.A: US5–US7) */}
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />

        {/* Notifications (R1.C) */}
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />

        {/* Admin (R1.A invites + R1.C audit log + US11 listing management) */}
        <Route
          path="/admin/listings"
          element={
            <RequireAdmin>
              <AdminListingsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/invites"
          element={
            <RequireAdmin>
              <AdminInvitesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/audit-log"
          element={
            <RequireAdmin>
              <AdminAuditLogPage />
            </RequireAdmin>
          }
        />

        {/* Auth pages — already-signed-in users get bounced. */}
        <Route
          path="/login"
          element={
            <RequireAuth requireAuth={false}>
              <LoginPage />
            </RequireAuth>
          }
        />
        <Route
          path="/register"
          element={
            <RequireAuth requireAuth={false}>
              <RegisterPage />
            </RequireAuth>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <RequireAuth requireAuth={false}>
              <ForgotPasswordPage />
            </RequireAuth>
          }
        />
        <Route
          path="/reset-password"
          element={
            <RequireAuth requireAuth={false}>
              <ResetPasswordPage />
            </RequireAuth>
          }
        />
        <Route
          path="/verify-email"
          element={
            <RequireAuth requireAuth={false}>
              <VerifyEmailPage />
            </RequireAuth>
          }
        />

        {/* Fallback page */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
