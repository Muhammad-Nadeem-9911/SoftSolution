import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom'; // Import useLocation
import { useAuth } from '../context/AuthContext';

// Optional: Add a simple loading component or style
const LoadingIndicator = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#1a1a1a', color: '#e0e0e0' }}>
    Loading...
  </div>
);

// Component to protect routes
// Optional: Add 'requiredRole' prop for role-based access control later
const ProtectedRoute = ({ requiredRole }) => { // Accept requiredRole prop
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation(); // Import useLocation if not already

  // 1. Handle the loading state from AuthContext first.
  if (loading) {
    console.log(`[ProtectedRoute] Path: ${location.pathname}. AuthContext is loading. Waiting...`);
    // Show loading indicator while checking auth status
    return <LoadingIndicator />;
  }

  // 2. After loading is false, check for authentication.
  if (!isAuthenticated) {
    // If not authenticated, redirect to the login page
    console.log(`[ProtectedRoute] Path: ${location.pathname}. Not authenticated. Redirecting to /auth.`);
    return <Navigate to="/auth" replace />; 
  }
  // 3. At this point, loading is false and isAuthenticated is true.
  // The user object and its role MUST be available. If not, it's an issue with AuthContext state updates.
  if (!user || typeof user.role === 'undefined') {
    console.error(`[ProtectedRoute] Path: ${location.pathname}. CRITICAL STATE INCONSISTENCY: Authenticated but user object or user.role is missing. User: ${JSON.stringify(user)}. This indicates an issue in AuthContext's loading sequence. Forcing loading display.`);
    return <LoadingIndicator />; // Fallback to loading, as state is inconsistent
  }
  // 4. Now, we are sure: loading=false, isAuthenticated=true, user exists, and user.role is defined.
  console.log(`[ProtectedRoute] Path: ${location.pathname}. Final Check. User Role: '${user.role}', Required Role: '${requiredRole}'`);  
  
  // Check role if requiredRole is provided
  if (requiredRole) {
    const userRole = user.role;
    let hasPermission = false;

    if (requiredRole === 'user') {
      hasPermission = ['user', 'manager', 'admin'].includes(userRole);
    } else if (requiredRole === 'manager') {
      hasPermission = ['manager', 'admin'].includes(userRole);
    } else if (requiredRole === 'admin') {
      hasPermission = userRole === 'admin';
    } else {
      // If requiredRole is something else, assume exact match needed (or handle as error)
      hasPermission = userRole === requiredRole;
    }

    if (!hasPermission) {
      console.warn(`[ProtectedRoute] Path: ${location.pathname}. ROLE MISMATCH: User role '${userRole}' does not meet required role '${requiredRole}'. Redirecting...`);
      // Redirect to a suitable page based on their actual role, or a generic unauthorized page
      const fallbackDashboard = userRole === 'admin' ? '/admin/dashboard' : userRole === 'manager' ? '/manager/dashboard' : '/user/dashboard';
      return <Navigate to={fallbackDashboard} replace />;
    }
  }

  // If authenticated (and authorized), render the child route component
  console.log(`[ProtectedRoute] Path: ${location.pathname}. Access GRANTED.`);
  return <Outlet />; // Renders the nested route defined in App.js
};

export default ProtectedRoute;