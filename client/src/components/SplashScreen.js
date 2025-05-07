import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SplashScreen.css'; // We'll create this CSS file next

const SplashScreen = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Navigate to the auth page after 5 seconds
    const timer = setTimeout(() => {
      navigate('/auth');
    }, 5000); // 5000 milliseconds = 5 seconds

    // Cleanup the timer if the component unmounts early
    return () => clearTimeout(timer);
  }, [navigate]); // Dependency array includes navigate

  return (
    <div className="splash-container">
      <div className="splash-content">
        {/* Replace the div below with your actual logo image */}
        <img
          src="/assets/images/logo.png" // Path relative to the public folder
          alt="MeetSphere Logo"          // Important for accessibility! Describe your logo.
          className="splash-logo"        // Keep the class for styling
        />
        <h1 className="splash-title"></h1> {/* Your App Name */}
        <p className="splash-tagline">Connect, Collaborate, Create</p> {/* Your Tagline */}
        {/* Optional: Add a simple loading animation */}
        <div className="splash-loader"></div>
      </div>
    </div>
  );
};

export default SplashScreen;