import React, { useState, useEffect } from 'react'; // Removed unused useContext
import axios from 'axios'; // Assuming you use axios for API calls
import { useAuth } from '../context/AuthContext'; // Import the useAuth hook instead
import { Link } from 'react-router-dom'; // Import Link
import './ProfileSettings.css';
import { FaUserCircle, FaEnvelope, FaLock, FaCamera, FaSpinner, FaUserEdit, FaUserTag, FaArrowLeft } from 'react-icons/fa'; // Added FaArrowLeft
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ProfileSettings = () => {
  const { user, setUser } = useAuth(); // Use the useAuth hook
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadingPicture, setLoadingPicture] = useState(false); // Loading state for picture
  const [loadingEmail, setLoadingEmail] = useState(false);   // Loading state for email
  const [loadingPassword, setLoadingPassword] = useState(false); // Loading state for password

  useEffect(() => {
    console.log("[ProfileSettings useEffect [user]] Running. User from context:", user); // Log when this runs
    if (user) {
      setEmail(user.email || '');
      setProfilePicturePreview(user.profilePictureUrl || null); // Assuming user object has profilePictureUrl
    }
  }, [user]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePicture(file);
      setProfilePicturePreview(URL.createObjectURL(file));
    }
  };

  const handleUpdateProfilePicture = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoadingPicture(true); // Start loading
    if (!profilePicture) {
      setError('Please select a picture to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('profilePicture', profilePicture);

    try {
      const token = localStorage.getItem('token');
      console.log('[Update Picture] Token from localStorage:', token);
      // TODO: Replace with your actual API endpoint and authentication method
      // Ensure your backend returns the updated user object or at least the new picture URL
      const response = await axios.post(`${API_BASE_URL}/api/users/update-picture`, formData, { // Ensure this route exists and is correct
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setMessage('Profile picture updated successfully!');
      // Update user context with the new picture URL from the response
      if (response.data && response.data.user) { // Check for the user object in response
        const updatedUserData = response.data.user; // This is the correct variable
        console.log("[ProfileSettings PicUpdate] Calling context setUser with data from API:", updatedUserData);
        setUser(prevUser => { // It's good practice to update context before reload if other parts of the app might react instantly
          const newUser = { ...prevUser, ...updatedUserData, _updatedAt: Date.now() };
          console.log("[ProfileSettings PicUpdate] New user object for context:", newUser);
          return newUser;
        });
        console.log("[ProfileSettings PicUpdate] SUCCESS. Attempting to reload page NOW!");
        // The local preview will be updated by the useEffect listening to 'user'
        // setProfilePicturePreview(updatedUserData.profilePictureUrl); // Or keep for immediate local preview if desired
      }
      setProfilePicture(null); // Clear the file input state
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile picture.');
    } finally {
      setLoadingPicture(false); // Stop loading
    }
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoadingEmail(true); // Start loading
    // TODO: Add validation if needed
    try {
        const token = localStorage.getItem('token');
        console.log('[Update Email] Token from localStorage:', token);
        // TODO: Replace with your actual API endpoint and authentication method
        // Ensure your backend returns the updated user object or confirms the change
        const response = await axios.put(`${API_BASE_URL}/api/users/update-email`, { email }, { // Ensure this route exists and is correct
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        console.log('Axios Success Response:', response); // Log the successful response object
        setMessage('Email updated successfully!');
        setError(''); // Explicitly clear error on success
        if (response.data && response.data.user) {
          const updatedUserData = response.data.user;
          console.log("[ProfileSettings EmailUpdate] Calling context setUser with data from API:", updatedUserData);
          setUser(prevUser => { // Update context before reload
            const newUser = { ...prevUser, ...updatedUserData, _updatedAt: Date.now() };
            console.log("[ProfileSettings EmailUpdate] New user object for context:", newUser);
            return newUser;
          });
          console.log("[ProfileSettings EmailUpdate] SUCCESS. Attempting to reload page NOW!");
        }
    } catch (err) {
        console.error('Axios Error Caught:', err); // Log the full error object
        console.error('Axios Error Response:', err.response); // Log the response part of the error
        setError(err.response?.data?.message || 'Failed to update email.');
        setMessage(''); // Explicitly clear message on error
    } finally {
      setLoadingEmail(false); // Stop loading
    }
  };


 const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (!currentPassword || !newPassword) {
        setError('Please fill in all password fields.');
        return;
    }
    setLoadingPassword(true); // Start loading
    // TODO: Add password strength validation if needed

    try {
        const token = localStorage.getItem('token');
        console.log('[Update Password] Token from localStorage:', token);
        // TODO: Replace with your actual API endpoint and authentication method
        // Backend should verify currentPassword before updating
        await axios.put(`${API_BASE_URL}/api/users/update-password`, { currentPassword, newPassword }, { // Ensure this route exists and is correct
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setMessage('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        console.log("[ProfileSettings PasswordUpdate] SUCCESS. Attempting to reload page NOW!");
    } catch (err) {
        setError(err.response?.data?.message || 'Failed to update password. Check current password.');
    }
    finally {
      setLoadingPassword(false); // Stop loading
    } // Add missing closing brace for finally block
  }; // This brace closes the handleUpdatePassword function


  if (!user) {
    return <div className="profile-container">Loading profile...</div>; // Or redirect to login
  }

  return (
      <div className="profile-page"> {/* Outer container */}
      {/* Back to Dashboard Link */}
      <Link 
        to={
          user?.role === 'admin' ? '/admin/dashboard' :
          user?.role === 'manager' ? '/manager/dashboard' : 
          '/user/dashboard'
        } 
        className="back-to-dashboard-link"
      >
        <FaArrowLeft /> Back to Dashboard
      </Link>
      <div className="profile-content-area"> {/* Inner scrollable area */}      <h1><FaUserCircle /> Your Profile</h1>
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}

      {/* New Flex Container for Side-by-Side Layout */}
      <div className="profile-layout-container">

        {/* Left Column */}
        <div className="profile-left-column">
          {/* Profile Picture Section */}
          <div className="profile-section picture-section">
          <h2><FaCamera /> Profile Picture</h2> {/* Added Icon */}
          <div className="profile-picture-preview">
              {profilePicturePreview ? <img src={profilePicturePreview} alt="Profile Preview" /> : <FaUserCircle size={100} />}
            </div>
            <form onSubmit={handleUpdateProfilePicture}>
              <label htmlFor="profile-picture-upload" className="upload-button">
                <FaCamera /> Choose Picture
              </label>
              <input id="profile-picture-upload" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              {profilePicture && <button type="submit" className="profile-button primary" disabled={loadingPicture}>
                {loadingPicture ? <><FaSpinner className="spinner" /> Uploading...</> : 'Upload New Picture'}
              </button>}
            </form>
          </div> {/* Close picture-section */}

          {/* Account Info & Email Update Section */}
          <div className="profile-section">
          <h2><FaUserEdit /> Account Information</h2> {/* Added Icon */}
          <div className="info-item"><strong>Username:</strong> {user.username} (cannot be changed)</div>
            {/* Email Update Form */}
            <form onSubmit={handleUpdateEmail} className="profile-form">
              <div className="form-group">
                <label htmlFor="email"><FaEnvelope /> Email Address</label>
                <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <button type="submit" className="profile-button primary" disabled={loadingEmail}>
                {loadingEmail ? <><FaSpinner className="spinner" /> Updating...</> : 'Update Email'}
              </button>
            </form>
          </div>
        </div> {/* Close profile-left-column */}

        {/* Right Column */}
        <div className="profile-right-column">
          {/* Password Update Section */}{/* New Role Section */}
            <div className="profile-section">
            <h2><FaUserTag /> Role</h2> {/* Added Icon */}
              <div className="info-item">Your current role is: <strong>{user?.role}</strong></div>
              <p style={{ fontSize: '0.85rem', color: '#a0a0a0' }}>User roles cannot be changed from this page.</p>
            </div>
          <div className="profile-section">
            {/* Password Update Form */}
            <form onSubmit={handleUpdatePassword} className="profile-form">
              <h3><FaLock /> Change Password</h3>
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input type="password" id="currentPassword" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input type="password" id="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
              <button type="submit" className="profile-button primary" disabled={loadingPassword}>
                {loadingPassword ? <><FaSpinner className="spinner" /> Updating...</> : 'Update Password'}
              </button>
            </form>
            </div> {/* Close password profile-section */}

            </div> {/* Close profile-right-column */}

      </div> {/* Close profile-layout-container */}
      </div> {/* Close profile-content-area (Moved here) */}
    </div>
  );
};

export default ProfileSettings;