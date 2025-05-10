import React, { useEffect, useState } from 'react'; // Import useEffect and useState
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate
import { FiLogOut, FiUser, FiChevronDown, FiUsers, FiVideo, FiLogIn } from 'react-icons/fi'; // Removed FiPlusSquare
// import BackgroundAnimation from './BackgroundAnimation'; // Remove import
import './ManagerDashboard.css'; // Import the new CSS

function ManagerDashboard() {
    const { user, logout } = useAuth(); // Removed userUpdateCount
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = React.useState(false);
    const navigate = useNavigate();
    const [roomIdInput, setRoomIdInput] = useState('');
    const [joinError, setJoinError] = useState(''); // Optional: for displaying errors

    useEffect(() => {
        // This effect logs whenever the user object OR the update count changes.
        console.log('[ManagerDashboard useEffect] User object from context changed:', user);
    }, [user]); // Only depend on user

    const toggleProfileDropdown = () => {
        setIsProfileDropdownOpen(prev => !prev);
    };

    const handleJoinMeeting = () => {
      if (roomIdInput.trim()) {
        navigate(`/room/${roomIdInput.trim()}`); // Ensure your meeting route is /room/:roomId
      } else {
        setJoinError('Please enter a Room ID to join.');
        setTimeout(() => setJoinError(''), 3000); // Clear error after 3 seconds
      }
    };

    return (
        <div 
            className="dashboard-page" 
            key={user?._updatedAt || user?.id} // Force re-mount if user object's forced update timestamp changes or user id changes
        >
            {/* <BackgroundAnimation /> */} {/* Remove component usage */}
            <header className="dashboard-header">
                <img
                    src="/assets/images/logo1.png"
                    alt="MeetSphere Logo"
                    className="header-logo"
                />
                <div className="header-right">
                    <div className="profile-dropdown-container">
                        <button onClick={toggleProfileDropdown} className="profile-trigger-button">
                            {console.log("[ManagerDashboard Render] Profile Pic URL for img tag:", user?.profilePictureUrl)}
                            
                            {user?.profilePictureUrl ? (
                            <img
                            key={`${user.profilePictureUrl}?${new Date().getTime()}`} // Force key change
                            src={`${user.profilePictureUrl}?${new Date().getTime()}`} // Force re-fetch
                            alt="Profile"
                            className="profile-picture-icon" />
                            ) : (
                                <FiUser className="profile-picture-icon default-icon" />
                            )}

                            <span className="profile-username"><strong>{user?.username || 'Manager'}</strong></span>
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
                <h1>Manager Dashboard</h1>
                <p>Welcome, Manager {user?.username || 'User'}! Manage users and their roles.</p>

                <section className="dashboard-section manager-actions">
                    <h2><FiUsers /> Role Management</h2>
                    <p>View existing users, update their roles (e.g., user, admin), or delete user accounts.</p>
                    <Link to="/manager/manage-users" className="dashboard-button primary">
                        Manage Users
                    </Link>
                </section>

                {/* Join or Create Meeting Section */}
                <section className="dashboard-section">
                  <h2><FiVideo /> Join a Meeting</h2>
                  <p>Enter an existing Room ID to join a meeting.</p>
                  
                  {joinError && <p style={{ color: '#dc3545', marginBottom: '15px' }}>{joinError}</p>}

                  <div className="join-room-controls">
                    <input
                      type="text"
                      className="dashboard-input"
                      placeholder="Enter Room ID"
                      value={roomIdInput}
                      onChange={(e) => setRoomIdInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleJoinMeeting()}
                    />
                    <button
                      onClick={handleJoinMeeting}
                      className="dashboard-button"
                      title="Join Existing Meeting"
                    >
                      <FiLogIn /> Join
                    </button>
                  </div>
                </section>
            </main>
        </div>
    );
}

export default ManagerDashboard;