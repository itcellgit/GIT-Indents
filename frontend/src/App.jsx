import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import FacultyDashboard from './pages/FacultyDashboard';
import AdminDashboard from './pages/AdminDashboard';
import HODDashboard from './pages/HODDashboard';
import PrincipalDashboard from './pages/PrincipalDashboard';
import MaintainerDashboard from './pages/MaintainerDashboard';
import Profile from './pages/Profile';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App min-h-screen">
        <Routes>
          {/* Redirect raw root to login */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['Faculty']}>
              <FacultyDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin-dashboard" element={
            <ProtectedRoute allowedRoles={['Admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/hod-dashboard" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <HODDashboard />
            </ProtectedRoute>
          } />
          <Route path="/principal-dashboard" element={
            <ProtectedRoute allowedRoles={['Principal']}>
              <PrincipalDashboard />
            </ProtectedRoute>
          } />
          <Route path="/maintainer-dashboard" element={
            <ProtectedRoute allowedRoles={['Maintainer']}>
              <MaintainerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute allowedRoles={['Faculty', 'HOD', 'Admin', 'Principal']}>
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
