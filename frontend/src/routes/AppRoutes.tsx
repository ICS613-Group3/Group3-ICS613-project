import { Navigate, Route, Routes } from 'react-router-dom';

// Import shared layout wrapper.
import AppLayout from '../components/AppLayout';

// Import admin pages.
import AdminInvitesPage from '../pages/AdminInvitesPage';
import AdminListingsPage from '../pages/AdminListingsPage';
import AdminMembersPage from '../pages/AdminMembersPage';

// Import authentication and account pages.
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import VerifyEmailPage from '../pages/VerifyEmailPage';

// Import account deletion page.
import AccountDeletionPage from '../pages/AccountDeletionPage';

// Import profile pages.
import EditProfilePage from '../pages/EditProfilePage';
import ProfileSetupPage from '../pages/ProfileSetupPage';

// Import main app pages.
import BrowseToolsPage from '../pages/BrowseToolsPage';
import CreateToolPage from '../pages/CreateToolPage';
import DashboardPage from '../pages/DashboardPage';
import EditToolPage from '../pages/EditToolPage';
import NotFoundPage from '../pages/NotFoundPage';
import NotificationsPage from '../pages/NotificationsPage';
import ReservationDetailPage from '../pages/ReservationDetailPage';
import ReservationsPage from '../pages/ReservationsPage';
import ReviewHistoryPage from '../pages/ReviewHistoryPage';
import ReviewPage from '../pages/ReviewPage';
import ToolDetailPage from '../pages/ToolDetailPage';

// Auth guard component.
import { useAuth } from '../context/useAuth';
import type { ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <section className="page-section">
        <div className="page-header">
          <h1>Loading...</h1>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * AppRoutes
 *
 * Route map integrating with backend API.
 * Public routes: login, register, forgot-password, reset-password, verify-email.
 * Protected routes: everything else (wrapped in RequireAuth).
 */
function AppRoutes() {
  return (
    <Routes>
      {/* Shared layout wrapper for all app pages. */}
      <Route element={<AppLayout />}>
        {/* Public auth routes — no auth required. */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* Protected routes — require authentication. */}
        <Route path="/" element={<RequireAuth><Navigate to="/dashboard" replace /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />

        {/* Profile routes. */}
        <Route path="/profile/setup" element={<RequireAuth><ProfileSetupPage /></RequireAuth>} />
        <Route path="/profile/edit" element={<RequireAuth><EditProfilePage /></RequireAuth>} />

        {/* Account deletion. */}
        <Route path="/account/delete" element={<RequireAuth><AccountDeletionPage /></RequireAuth>} />

        {/* Tool browsing and management. */}
        <Route path="/tools" element={<RequireAuth><BrowseToolsPage /></RequireAuth>} />
        <Route path="/tools/new" element={<RequireAuth><CreateToolPage /></RequireAuth>} />
        <Route path="/tools/:toolId" element={<RequireAuth><ToolDetailPage /></RequireAuth>} />
        <Route path="/tools/:toolId/edit" element={<RequireAuth><EditToolPage /></RequireAuth>} />

        {/* Reservation workflow. */}
        <Route path="/reservations" element={<RequireAuth><ReservationsPage /></RequireAuth>} />
        <Route path="/reservations/:reservationId" element={<RequireAuth><ReservationDetailPage /></RequireAuth>} />
        <Route path="/reservations/:reservationId/review" element={<RequireAuth><ReviewPage /></RequireAuth>} />

        {/* Review history. */}
        <Route path="/reviews/history" element={<RequireAuth><ReviewHistoryPage /></RequireAuth>} />

        {/* Notifications. */}
        <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />

        {/* Admin routes. */}
        <Route path="/admin/members" element={<RequireAuth><AdminMembersPage /></RequireAuth>} />
        <Route path="/admin/invites" element={<RequireAuth><AdminInvitesPage /></RequireAuth>} />
        <Route path="/admin/listings" element={<RequireAuth><AdminListingsPage /></RequireAuth>} />

        {/* Catch-all for unknown pages. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
