import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import BrowseToolsPage from '../pages/BrowseToolsPage';
import CreateToolPage from '../pages/CreateToolPage';
import DashboardPage from '../pages/DashboardPage';
import EditToolPage from '../pages/EditToolPage';
import LoginPage from '../pages/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import RegisterPage from '../pages/RegisterPage';
import ReservationDetailPage from '../pages/ReservationDetailPage';
import ReservationsPage from '../pages/ReservationsPage';
import ReviewPage from '../pages/ReviewPage';
import ToolDetailPage from '../pages/ToolDetailPage';

/**
 * AppRoutes
 *
 * This file controls the main frontend routes.
 *
 * Current R1 frontend routes include:
 * - Dashboard
 * - Browse Tools
 * - Create Tool
 * - Tool Detail
 * - Edit Tool
 * - Reservations Dashboard
 * - Reservation Detail
 * - US24 Review Page
 *
 * Note:
 * These pages currently use mock frontend data.
 * Backend API integration will be connected later.
 */
function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Default route sends users to the dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Main member pages */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tools" element={<BrowseToolsPage />} />

        {/* Tool listing workflow */}
        <Route path="/tools/new" element={<CreateToolPage />} />
        <Route path="/tools/:toolId" element={<ToolDetailPage />} />
        <Route path="/tools/:toolId/edit" element={<EditToolPage />} />

        {/* Reservation workflow */}
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route
          path="/reservations/:reservationId"
          element={<ReservationDetailPage />}
        />

        {/* 
          US24 Review route

          Example:
          /reservations/reservation-4/review

          For the mock demo, reservation-4 is RETURNED,
          so it should allow review submission.
        */}
        <Route
          path="/reservations/:reservationId/review"
          element={<ReviewPage />}
        />

        {/* Auth pages */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Fallback page */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
