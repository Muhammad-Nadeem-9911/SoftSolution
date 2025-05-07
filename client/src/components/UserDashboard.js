import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Import Link
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { FiLogOut, FiLogIn, FiUser, FiChevronDown } from 'react-icons/fi'; // Import FiUser, FiChevronDown icons
import './UserDashboard.css'; // Import the CSS file
// import BackgroundAnimation from './BackgroundAnimation'; // Remove import

const UserDashboard = () => {
  const { user, logout } = useAuth(); // Get user info and logout function
  const [roomIdInput, setRoomIdInput] = useState('');
  const navigate = useNavigate();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false); // State for dropdown

  const handleJoinRoom = () => {
    if (roomIdInput.trim()) {
      console.log(`Attempting to join room: ${roomIdInput.trim()}`);
      navigate(`/room/${roomIdInput.trim()}`);
    } else {
      alert('Please enter a Room ID to join.');
    }
  };

  // Toggle profile dropdown
  const toggleProfileDropdown = () => {
    setIsProfileDropdownOpen(prev => !prev);
  };

  return (
    <div className="dashboard-page">
      {/* <BackgroundAnimation /> */} {/* Remove component usage */}
      <header className="dashboard-header">
        <img // Update the src attribute here
            src="/assets/images/logo1.png"
            alt="MeetSphere Logo"
            className="header-logo" // Use the same class
        />
        <div className="header-right"> {/* Group welcome and logout */}
            {/* Profile Dropdown Area */}
            <div className="profile-dropdown-container">
                <button onClick={toggleProfileDropdown} className="profile-trigger-button">
                    {/* Conditionally render profile picture or icon */}
                    {user?.profilePictureUrl ? (
                        <img
                            key={`${user.profilePictureUrl}?${new Date().getTime()}`} // Force key change
                            src={`${user.profilePictureUrl}?${new Date().getTime()}`} // Force re-fetch
                            alt="Profile"
                            className="profile-picture-icon" />
                    ) : (
                        <FiUser className="profile-picture-icon default-icon" />
                    )}
                    <span className="profile-username"><strong>{user?.username || 'User'}</strong></span>
                    <FiChevronDown className={`dropdown-arrow ${isProfileDropdownOpen ? 'open' : ''}`} />
                </button>
                {isProfileDropdownOpen && (
                    <div className="profile-dropdown-menu">
                        <Link to="/profile" className="dropdown-item" onClick={() => setIsProfileDropdownOpen(false)}>View Profile</Link>
                        <button onClick={() => { logout(); setIsProfileDropdownOpen(false); }} className="dropdown-item logout">
                            <FiLogOut /> Logout
                        </button>
                    </div>
                )}
            </div>
        </div>
      </header>

      <main className="dashboard-main">
        <h1>User Dashboard</h1>

        <section className="dashboard-section">
          <h2><FiLogIn /> Join Room</h2>
          <p>Enter the ID of an existing meeting room to join.</p>
          <div className="join-room-controls">
            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              className="dashboard-input"
            />
            <button onClick={handleJoinRoom} className="dashboard-button">
              Join Room
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default UserDashboard;