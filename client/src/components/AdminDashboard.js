import React, { useState } from 'react'; // Import useState
import { useNavigate, Link } from 'react-router-dom'; // Import Link here
import { v4 as uuidV4 } from 'uuid'; // Import UUID generator
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { FiLogOut, FiPlusSquare, FiLogIn, FiUser, FiChevronDown } from 'react-icons/fi'; // Import FiUser, FiChevronDown icons
import './AdminDashboard.css'; // Import the CSS file
// import BackgroundAnimation from './BackgroundAnimation'; // Remove import

const AdminDashboard = () => {
  const { user, logout } = useAuth(); // Get user info and logout function
  const [roomIdInput, setRoomIdInput] = useState(''); // State for join input
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false); // State for dropdown
  const navigate = useNavigate();


  // Function to create a new room
  const createNewRoom = () => {
    const newRoomId = uuidV4(); // Generate a unique room ID
    console.log(`Creating new room: ${newRoomId}`);
    navigate(`/room/${newRoomId}`); // Navigate to the new room URL
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
            className="header-logo" // Add a class for styling
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
                    <span className="profile-username"><strong>{user?.username || 'Admin'}</strong></span>
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
        <h1>Admin Dashboard</h1>

        <section className="dashboard-section">
          <h2><FiPlusSquare /> Create Room</h2>
          <p>Start a new meeting session.</p>
          <button onClick={createNewRoom} className="dashboard-button primary">
            Create New Meeting Room
          </button>
        </section>

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
            <button
              onClick={() => { if (roomIdInput.trim()) navigate(`/room/${roomIdInput.trim()}`); else alert('Please enter a Room ID'); }}
              className="dashboard-button"
            >
              Join Room
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminDashboard;