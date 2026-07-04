import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import BrowseToolsPage from '../pages/BrowseToolsPage';
import CreateToolPage from '../pages/CreateToolPage';
import DashboardPage from '../pages/DashboardPage';
import EditToolPage from '../pages/EditToolPage';
import LoginPage from '../pages/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import NotificationsPage from '../pages/NotificationsPage';
import RegisterPage from '../pages/RegisterPage';
import ReservationDetailPage from '../pages/ReservationDetailPage';
import ReservationsPage from '../pages/ReservationsPage';
import ReviewHistoryPage from '../pages/ReviewHistoryPage';
import ReviewPage from '../pages/ReviewPage';
import ToolDetailPage from '../pages/ToolDetailPage';
// Import the Admin Invites page for frontend issues #62, #63, and #64.
import AdminInvitesPage from '../pages/AdminInvitesPage';

/**
 * AppRoutes
 *
 * Main frontend route map for the R1 demo.
 *
 * Current R1 behavior:
 * - Uses mock frontend pages and mock data.
 * - Keeps the route structure close to the planned app architecture.
 *
 * Future backend behavior:
 * - Protected routes and real auth can be added around these routes.
 * - Mock pages can be connected to backend API services later.
 */
function AppRoutes() {
  return (
    <Routes>
      {/* Shared layout wrapper for all app pages */}
      <Route element={<AppLayout />}>
        {/* Default route sends users to the dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Main member dashboard */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Tool browsing and tool management routes */}
        <Route path="/tools" element={<BrowseToolsPage />} />
        <Route path="/tools/new" element={<CreateToolPage />} />
        <Route path="/tools/:toolId" element={<ToolDetailPage />} />
        <Route path="/tools/:toolId/edit" element={<EditToolPage />} />

        {/* Reservation workflow routes */}
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route
          path="/reservations/:reservationId"
          element={<ReservationDetailPage />}
        />
        <Route
          path="/reservations/:reservationId/review"
          element={<ReviewPage />}
        />

        {/* Review history route for US25 */}
        <Route path="/reviews/history" element={<ReviewHistoryPage />} />

        {/* Notification center route to prevent Dashboard card 404 */}
        <Route path="/notifications" element={<NotificationsPage />} />

        {/* Admin invite management route for frontend issues #62, #63, and #64 */}
        <Route path="/admin/invites" element={<AdminInvitesPage />} />

        {/* Mock authentication routes for R1 frontend demo */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Catch-all route for unknown pages */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
