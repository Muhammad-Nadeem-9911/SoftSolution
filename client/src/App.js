// === Frontend: App.js ===
// Remove imports related to meeting logic for now
import React, { useEffect, useState } from 'react'; // Import useEffect, useState
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'; // Add useNavigate, useLocation
import { useAuth } from './context/AuthContext'; // Assuming AuthContext is here
// Import the new page components
import SplashScreen from './components/SplashScreen';
import AuthPage from './components/AuthPage';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import ProtectedRoute from './components/ProtectedRoute'; // Import ProtectedRoute
import MeetingRoom from './components/MeetingRoom'; // Import MeetingRoom
import ProfileSettings from './components/ProfileSettings'; // Import ProfileSettings
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';
import VerifyEmailPage from './components/Auth/VerifyEmailPage'; // Import VerifyEmailPage
import ManagerDashboard from './components/ManagerDashboard';
import ManageUsers from './components/ManageUsers';
// import MeetingRoom from './components/MeetingRoom';

// Remove socket instance creation from here for now, it will likely move into AuthContext or MeetingRoom
// const socket = io('http://localhost:5000'); 

const App = () => {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [initialRedirectAttempted, setInitialRedirectAttempted] = useState(false);

  useEffect(() => {
    
    if (!loading && isAuthenticated && user) {
      // This block executes when the user is authenticated and user data is loaded.
      if (!initialRedirectAttempted) {
        // This inner block runs only ONCE per authenticated session after initial loading.
        const isOnAuthOrSplash = location.pathname === '/auth' || location.pathname === '/';
        // Only perform initial redirect if on auth/splash page
        if (isOnAuthOrSplash) {
          console.log(`[App.js Effect] User authenticated on Auth/Splash. Role: ${user.role}. Attempting redirect...`);
          // Ensure user.role is defined before making a decision
          if (typeof user.role !== 'undefined') {
            if (user.role === 'manager') {
              navigate('/manager/dashboard', { replace: true });
              console.log('[App.js Effect] Decision: Navigate to /manager/dashboard');
            } else if (user.role === 'admin') {
              navigate('/admin/dashboard', { replace: true });
              console.log('[App.js Effect] Decision: Navigate to /admin/dashboard');
            } else { // Default for 'user' role or any other defined role
              navigate('/user/dashboard', { replace: true });
              console.log('[App.js Effect] Decision: Navigate to /user/dashboard (role was not manager or admin, or was user)');
            }
          } else {
            console.warn("[App.js Effect] User authenticated but user.role is undefined. Not redirecting yet. AuthContext might still be settling.");
            // If user.role is undefined here, we might not want to redirect yet,
            // or default to user dashboard if that's the safest fallback.
            // For now, let's avoid redirecting if role is undefined to see if AuthContext settles.
          }
        }
        // Crucially, set this flag to true AFTER the first time this logic is processed for an authenticated user,
        // regardless of whether a redirect from /auth or / actually happened.
        setInitialRedirectAttempted(true); 
      }
    } else if (!isAuthenticated && !loading) {
      // If user logs out or session expires, reset the flag
      console.log("[App.js Effect] User not authenticated or session ended. Resetting initialRedirectAttempted.");
      setInitialRedirectAttempted(false);
    } else if (!loading && !isAuthenticated && // This condition is for unauthenticated users on protected paths
               (location.pathname.startsWith('/manager') || 
                location.pathname.startsWith('/admin') || 
                location.pathname.startsWith('/user') ||
                location.pathname === '/profile')) {
      // If not loading, not authenticated, and on a protected path, ProtectedRoute will handle redirect to /auth.
      // No explicit navigation needed here for that case.
    }
  }, [isAuthenticated, user, loading, navigate, location.pathname, initialRedirectAttempted]); // Removed location.state

  // New Router Setup
  return (
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmailPage />} /> {/* Add verification route */}
        {/* Protected Routes */}
        {/* Admin Route */}
        <Route element={<ProtectedRoute requiredRole="admin" />}>
          <Route path="/admin/dashboard" element={<AdminDashboard key={user?._updatedAt || user?.id} />} />
        </Route>
        {/* Manager Route */}
        <Route element={<ProtectedRoute requiredRole="manager" />}>
        <Route path="/manager/dashboard" element={<ManagerDashboard key={user?._updatedAt || user?.id} />} />
        
        {/* Simplified route for ManageUsers, outer ProtectedRoute already handles role check */}
        <Route path="/manager/manage-users" element={<ManageUsers />} />
        </Route>

        {/* General User Routes - accessible by any authenticated user (user, manager, admin) */}
        {/* If a specific role like 'user' is the minimum, specify it. */}
        {/* If truly any authenticated user, no requiredRole is needed, or you can be explicit with a base role. */}
          {/* For MeetingRoom, typically any authenticated user who has the room ID should be able to join. */}
        {/* So, no specific role or a base 'user' role that includes admin/manager is appropriate. */}
        <Route element={<ProtectedRoute />}> {/* OR <ProtectedRoute requiredRole="user" /> if your ProtectedRoute handles hierarchy */} 
          <Route path="/user/dashboard" element={<UserDashboard key={user?._updatedAt || user?.id} />} />
          <Route path="/room/:roomId" element={<MeetingRoom />} />
          <Route path="/profile" element={<ProfileSettings />} /> {/* Add Profile route */}
        </Route>
        {/* Optional: Add a catch-all route for 404 */}
        <Route path="*" element={<Navigate to="/" replace />} /> {/* Redirect unknown paths to splash */}
      </Routes>
  );
};




export default App;
