import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role not allowed
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Strict Authorization: Redirect to the user's appropriate dashboard
    const roleRoutes = {
      'Admin': '/admin-dashboard',
      'Principal': '/principal-dashboard',
      'HOD': '/hod-dashboard',
      'Maintainer': '/maintainer-dashboard',
      'Faculty': '/dashboard',
      'Non-Teaching': '/non-teaching-dashboard'
    };
    
    const targetDashboard = roleRoutes[user.role] || '/login';
    return <Navigate to={targetDashboard} replace />; 
  }

  return children;
};

export default ProtectedRoute;
