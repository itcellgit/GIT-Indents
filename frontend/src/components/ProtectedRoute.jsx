import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_DASHBOARDS } from '../constants/roles';

const ProtectedRoute = ({ children, allowedRoles, allowCoordinatorStaff = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
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
