import { Navigate, Route, Routes } from 'react-router-dom';

// Import shared layout wrapper.
import AppLayout from '../components/AppLayout';

// Import admin pages.
import AdminCategoriesPage from '../pages/AdminCategoriesPage';
import AdminInvitesPage from '../pages/AdminInvitesPage';
import AdminListingsPage from '../pages/AdminListingsPage';
import AdminMembersPage from '../pages/AdminMembersPage';
import AdminModerationIndividualProfile from '../pages/AdminModerationIndividualProfile';
import AdminModerationProfiles from '../pages/AdminModerationProfiles';
import AdminModerationReportsPage from '../pages/AdminModerationReportsPage';
import AdminReportedListingsPage from '../pages/AdminReportedListingsPage';
import AdminReportsPage from '../pages/AdminReportsPage';
import AdminReservationPage from '../pages/AdminReservationPage';
import ModerationHistoryPage from '../pages/ModerationHistoryPage';

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
import PublicMemberProfilePage from '../pages/PublicMemberProfilePage';

// Import main app pages.
import BrowseToolsPage from '../pages/BrowseToolsPage';
import CreateToolPage from '../pages/CreateToolPage';
import DashboardPage from '../pages/DashboardPage';
import EditToolPage from '../pages/EditToolPage';
import MessageThreadPage from '../pages/MessageThreadPage';
import MyToolsPage from '../pages/MyToolsPage';
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

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();

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

  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />;
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

        {/* Public member profile. */}
        <Route path="/members/:memberId" element={<RequireAuth><PublicMemberProfilePage /></RequireAuth>} />

        {/* Account deletion. */}
        <Route path="/account/delete" element={<RequireAuth><AccountDeletionPage /></RequireAuth>} />

        {/* Tool browsing and management. */}
        <Route path="/tools" element={<RequireAuth><BrowseToolsPage /></RequireAuth>} />
        <Route path="/tools/mine" element={<RequireAuth><MyToolsPage /></RequireAuth>} />
        <Route path="/tools/new" element={<RequireAuth><CreateToolPage /></RequireAuth>} />
        <Route path="/tools/:toolId" element={<RequireAuth><ToolDetailPage /></RequireAuth>} />
        <Route path="/tools/:toolId/edit" element={<RequireAuth><EditToolPage /></RequireAuth>} />

        {/* Reservation workflow. */}
        <Route path="/reservations" element={<RequireAuth><ReservationsPage /></RequireAuth>} />
        <Route path="/reservations/:reservationId" element={<RequireAuth><ReservationDetailPage /></RequireAuth>} />
        <Route path="/reservations/:reservationId/messages" element={<RequireAuth><MessageThreadPage /></RequireAuth>} />
        <Route path="/reservations/:reservationId/review" element={<RequireAuth><ReviewPage /></RequireAuth>} />

        {/* Review history. */}
        <Route path="/reviews/history" element={<RequireAuth><ReviewHistoryPage /></RequireAuth>} />

        {/* Notifications. */}
        <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />

        {/* Admin routes. */}
        <Route path="/admin/members" element={<RequireAdmin><AdminMembersPage /></RequireAdmin>} />
        <Route path="/admin/invites" element={<RequireAdmin><AdminInvitesPage /></RequireAdmin>} />
        <Route path="/admin/listings" element={<RequireAdmin><AdminListingsPage /></RequireAdmin>} />
        <Route path="/admin/reported" element={<RequireAdmin><AdminReportedListingsPage /></RequireAdmin>} />
        <Route path="/admin/reports" element={<RequireAdmin><AdminReportsPage /></RequireAdmin>} />
        <Route path="/admin/categories" element={<RequireAdmin><AdminCategoriesPage /></RequireAdmin>} />
        <Route path="/admin/reservations" element={<RequireAdmin><AdminReservationPage /></RequireAdmin>} />
        <Route path="/admin/moderation" element={<RequireAdmin><AdminModerationProfiles /></RequireAdmin>} />
        <Route path="/admin/moderation/history" element={<RequireAdmin><ModerationHistoryPage /></RequireAdmin>} />
        <Route path="/admin/moderation/reports" element={<RequireAdmin><AdminModerationReportsPage /></RequireAdmin>} />
        <Route path="/admin/moderation/:memberId" element={<RequireAdmin><AdminModerationIndividualProfile /></RequireAdmin>} />

        {/* Catch-all for unknown pages. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
