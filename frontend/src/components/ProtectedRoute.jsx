import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_DASHBOARDS } from '../constants/roles';
import ChangePasswordModal from './ChangePasswordModal';

const ProtectedRoute = ({ children, allowedRoles, allowCoordinatorStaff = false }) => {
  const { user, loading, impersonation, refreshUser, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin reset this user's password: nothing else renders until they set their
  // own (the backend blocks every other API call meanwhile). Not shown to an
  // admin impersonating the user — the backend doesn't block them either.
  if (user.mustChangePassword && !impersonation?.active) {
    return (
      <div className="min-h-screen bg-slate-100">
        <ChangePasswordModal forced onSuccess={refreshUser} onLogout={logout} />
      </div>
    );
  }

  const currentRole = user?.role;
  const isAllowedRole = allowedRoles?.includes(currentRole);
  const isCoordinatorStaffAccess = allowCoordinatorStaff && Boolean(user?.isCoordinatorStaff);

  // Role not allowed
  if (allowedRoles && !isAllowedRole && !isCoordinatorStaffAccess) {
    const targetDashboard = ROLE_DASHBOARDS[currentRole] || '/login';
    return <Navigate to={targetDashboard} replace />;
  }

  return children;
};

export default ProtectedRoute;
