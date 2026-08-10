import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import FacultyDashboard from './pages/FacultyDashboard';
import NonTeachingDashboard from './pages/NonTeachingDashboard';
import AdminDashboard from './pages/AdminDashboard';
import HODDashboard from './pages/HODDashboard';
import PrincipalDashboard from './pages/PrincipalDashboard';
import MaintainerDashboard from './pages/MaintainerDashboard';
import ReceptionistDashboard from './pages/ReceptionistDashboard';
import HallBookingsPage from './pages/ReceptionistDashboard/HallBooking';
import VehicleBookingsPage from './pages/ReceptionistDashboard/VehicleBooking';
import TransportationDashboard from './pages/Transportation';
import BusBookingsPage from './pages/Transportation/BusBooking';
import BookIndentPage from './pages/BookIndent';
import CoordinatorDetails from './pages/AdminDashboard/CoordinatorDetails';
import OfficeStationaryDashboard from './pages/OfficeStationaryDashboard';
import StationaryIndentCreate from './pages/StationaryIndentCreate';
import Profile from './pages/Profile';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import GlobalLoader from './components/GlobalLoader';
import { ROLES } from './constants/roles';

function App() {
  return (
    <AuthProvider>
      <GlobalLoader />
      <Router>
        <div className="App min-h-screen">
        <Routes>
          {/* Redirect raw root to login */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={[ROLES.FACULTY]}>
              <FacultyDashboard />
            </ProtectedRoute>
          } />
          <Route path="/non-teaching-dashboard" element={
            <ProtectedRoute allowedRoles={[ROLES.NON_TEACHING, ROLES.OFFICE_STATIONARY]}>
              <NonTeachingDashboard />
            </ProtectedRoute>
          } />
          <Route path="/office-stationary-dashboard" element={
            <ProtectedRoute allowedRoles={[ROLES.OFFICE_STATIONARY]} allowCoordinatorStaff={true}>
              <OfficeStationaryDashboard />
            </ProtectedRoute>
          } />
          <Route path="/stationary-indent-create" element={
            <ProtectedRoute allowedRoles={[ROLES.FACULTY, ROLES.NON_TEACHING]} allowCoordinatorStaff={true}>
              <StationaryIndentCreate />
            </ProtectedRoute>
          } />
          <Route path="/admin-dashboard" element={
            <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin-dashboard/coordinators/:id" element={
            <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
              <CoordinatorDetails />
            </ProtectedRoute>
          } />
          <Route path="/hod-dashboard" element={
            <ProtectedRoute allowedRoles={[ROLES.HOD]}>
              <HODDashboard />
            </ProtectedRoute>
          } />
          <Route path="/principal-dashboard" element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <PrincipalDashboard />
            </ProtectedRoute>
          } />
          <Route path="/maintainer-dashboard" element={
            <ProtectedRoute allowedRoles={[ROLES.MAINTAINER]}>
              <MaintainerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/receptionist-dashboard" element={
            <ProtectedRoute allowedRoles={[ROLES.RECEPTIONIST]}>
              <ReceptionistDashboard />
            </ProtectedRoute>
          } />
          <Route path="/hall-bookings" element={
            <ProtectedRoute allowedRoles={[ROLES.FACULTY, ROLES.NON_TEACHING, ROLES.RECEPTIONIST]}>
              <HallBookingsPage />
            </ProtectedRoute>
          } />
          <Route path="/vehicle-bookings" element={
            <ProtectedRoute allowedRoles={[ROLES.FACULTY, ROLES.NON_TEACHING, ROLES.RECEPTIONIST]}>
              <VehicleBookingsPage />
            </ProtectedRoute>
          } />
          <Route path="/transportation-dashboard" element={
            <ProtectedRoute allowedRoles={[ROLES.TRANSPORT]}>
              <TransportationDashboard />
            </ProtectedRoute>
          } />
          <Route path="/bus-bookings" element={
            <ProtectedRoute allowedRoles={[ROLES.FACULTY, ROLES.NON_TEACHING, ROLES.TRANSPORT]}>
              <BusBookingsPage />
            </ProtectedRoute>
          } />
          <Route path="/book-indents" element={
            <ProtectedRoute allowedRoles={[ROLES.FACULTY]}>
              <BookIndentPage />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute allowedRoles={[ROLES.FACULTY, ROLES.HOD, ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.NON_TEACHING, ROLES.OFFICE_STATIONARY, ROLES.RECEPTIONIST, ROLES.TRANSPORT]}>
              <Profile />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
    </AuthProvider>
  );
}

export default App;
