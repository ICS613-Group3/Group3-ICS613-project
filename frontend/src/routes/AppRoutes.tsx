import { Navigate, Route, Routes } from 'react-router-dom';

// Import shared layout wrapper.
import AppLayout from '../components/AppLayout';

// Import admin pages.
import AdminInvitesPage from '../pages/AdminInvitesPage';

// Import authentication and account pages.
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import VerifyEmailPage from '../pages/VerifyEmailPage';

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

/**
 * AppRoutes
 *
 * Main frontend route map for the R1 demo.
 *
 * Current R1 behavior:
 * - Uses mock frontend pages and mock data.
 * - Keeps the route structure close to the planned app architecture.
 *
 * New frontend issue coverage:
 * - #62, #63, #64: Admin invite management page.
 * - #77, #79: Verify email page and resend verification email UI.
 * - #89: Forgot password / reset password request UI.
 * - #91, #93: Create new password page and invalid reset-token message.
 *
 * Future backend behavior:
 * - Protected routes and real auth can be added around these routes.
 * - Mock pages can be connected to backend API services later.
 */
function AppRoutes() {
  return (
    <Routes>
      {/* Shared layout wrapper for all app pages. */}
      <Route element={<AppLayout />}>
        {/* Default route sends users to the dashboard. */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Main member dashboard route. */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Tool browsing and tool management routes. */}
        <Route path="/tools" element={<BrowseToolsPage />} />
        <Route path="/tools/new" element={<CreateToolPage />} />
        <Route path="/tools/:toolId" element={<ToolDetailPage />} />
        <Route path="/tools/:toolId/edit" element={<EditToolPage />} />

        {/* Reservation workflow routes. */}
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route
          path="/reservations/:reservationId"
          element={<ReservationDetailPage />}
        />
        <Route
          path="/reservations/:reservationId/review"
          element={<ReviewPage />}
        />

        {/* Review history route for US25 / issue #109 support. */}
        <Route path="/reviews/history" element={<ReviewHistoryPage />} />

        {/* Notification center route to prevent Dashboard card 404. */}
        <Route path="/notifications" element={<NotificationsPage />} />

        {/* Admin invite management route for frontend issues #62, #63, and #64. */}
        <Route path="/admin/invites" element={<AdminInvitesPage />} />

        {/* Mock authentication routes for R1 frontend demo. */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Email verification route for frontend issues #77 and #79. */}
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* Forgot password route for frontend issue #89. */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Create-new-password route for frontend issues #91 and #93. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Catch-all route for unknown pages. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;