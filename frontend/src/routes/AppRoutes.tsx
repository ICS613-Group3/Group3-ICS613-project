import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import BrowseToolsPage from '../pages/BrowseToolsPage';
import DashboardPage from '../pages/DashboardPage';
import LoginPage from '../pages/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import RegisterPage from '../pages/RegisterPage';
import ReservationDetailPage from '../pages/ReservationDetailPage';
import ReservationsPage from '../pages/ReservationsPage';
import ToolDetailPage from '../pages/ToolDetailPage';

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tools" element={<BrowseToolsPage />} />
        <Route path="/tools/:toolId" element={<ToolDetailPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/reservations/:reservationId" element={<ReservationDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
