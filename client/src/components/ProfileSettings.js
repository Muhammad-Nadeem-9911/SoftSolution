import React, { useState, useEffect } from 'react'; // Removed unused useContext
import axios from 'axios'; // Assuming you use axios for API calls
import { useAuth } from '../context/AuthContext'; // Import the useAuth hook instead
import { Link, useNavigate } from 'react-router-dom'; // Import Link and useNavigate
import './ProfileSettings.css';
import { FaUserCircle, FaEnvelope, FaLock, FaCamera, FaSpinner, FaUserEdit, FaUserTag, FaArrowLeft, FaTrash } from 'react-icons/fa'; // Added FaArrowLeft and FaTrash
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ProfileSettings = () => {
  const { user, setUser, logout } = useAuth(); // Use the useAuth hook, add logout
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
  const [isDeletingAccount, setIsDeletingAccount] = useState(false); // Loading state for account deletion
  const [deleteConfirmAlert, setDeleteConfirmAlert] = useState({
    isVisible: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Delete',
    cancelText: 'Cancel',
  });
  const navigate = useNavigate(); // For redirection

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

  const showDeleteConfirmationAlert = (config) => {
    setDeleteConfirmAlert({
      isVisible: true,
      title: config.title || 'Confirm Deletion',
      message: config.message || 'Are you sure?',
      type: config.type || 'warning', // Default to warning, can be overridden
      onConfirm: config.onConfirm,
      confirmText: config.confirmText || 'Delete',
      cancelText: config.cancelText || 'Cancel',
    });
  };

  const closeDeleteConfirmationAlert = () => {
    setDeleteConfirmAlert(prev => ({ ...prev, isVisible: false, onConfirm: null }));
  };

  const handleDeleteAccount = async () => {
    setMessage('');
    setError('');

    showDeleteConfirmationAlert({
      title: 'Confirm Account Deletion',
      message: 'Are you absolutely sure you want to delete your account? This action is permanent and cannot be undone. All your data will be removed.',
      type: 'error', // Use 'error' type for destructive action styling
      confirmText: 'Yes, Delete My Account',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setIsDeletingAccount(true);
        try {
          const token = localStorage.getItem('token');
          const response = await axios.delete(`${API_BASE_URL}/api/users/account`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMessage(response.data.message || 'Account deleted successfully. You will be logged out.');
          // Wait a bit for the message to be seen, then logout and redirect
          setTimeout(() => {
            logout(); // Call logout from AuthContext
            navigate('/auth'); // Redirect to login/auth page
          }, 2000);
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to delete account. Please try again.');
          setIsDeletingAccount(false); // Only set back to false on error
        }
        // No finally here for setIsDeletingAccount(false) because successful deletion leads to navigation
      },
    });
  };

  const anyLoading = loadingPicture || loadingEmail || loadingPassword || isDeletingAccount;




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
              {profilePicture && <button type="submit" className="profile-button primary" disabled={anyLoading}>
                {loadingPicture ? <><FaSpinner className="spinner" /> Uploading...</> : 'Upload New Picture'}
              </button>}
            </form>
          </div> {/* Close picture-section */}

          {/* New Role Section */}
            <div className="profile-section">
            <h2><FaUserTag /> Role</h2> {/* Added Icon */}
              <div className="info-item">Your current role is: <strong>{user?.role}</strong></div>
              <p style={{ fontSize: '0.85rem', color: '#a0a0a0' }}>User roles cannot be changed from this page.</p>
            </div>
            {/* End New Role Section */}

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
              <button type="submit" className="profile-button primary" disabled={anyLoading}>
                {loadingEmail ? <><FaSpinner className="spinner" /> Updating...</> : 'Update Email'}
              </button>
            </form>
          </div>
        </div> {/* Close profile-left-column */}

        {/* Right Column */}
        <div className="profile-right-column">
          {/* Password Update Section */}
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
              <button type="submit" className="profile-button primary" disabled={anyLoading}>
                {loadingPassword ? <><FaSpinner className="spinner" /> Updating...</> : 'Update Password'}
              </button>
            </form>
            </div> {/* Close password profile-section */}

          {/* Danger Zone - Delete Account Section */}
          <div className="profile-section danger-zone">
            <h2><FaTrash /> Danger Zone</h2>
            <p>Deleting your account is permanent. All your data, including meeting history and profile information, will be removed and cannot be recovered.</p>
            <button
              onClick={handleDeleteAccount}
              className="profile-button danger" // Use a danger-themed button style
              disabled={anyLoading}
            >
              {isDeletingAccount ? <><FaSpinner className="spinner" /> Deleting Account...</> : 'Delete My Account'}
            </button>
          </div>

        </div> {/* Close profile-right-column */}

      </div> {/* Close profile-layout-container */}
      </div> {/* Close profile-content-area (Moved here) */}

      {/* Custom Confirmation Alert Modal for Deletion */}
      {deleteConfirmAlert.isVisible && (
        <div className="custom-alert-overlay" onClick={closeDeleteConfirmationAlert}>
          <div 
            className={`custom-alert-box custom-alert-${deleteConfirmAlert.type || 'warning'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="custom-alert-content">
              <h4>{deleteConfirmAlert.title}</h4>
              <p>{deleteConfirmAlert.message}</p>
            </div>
            <div className="custom-alert-actions">
              <button
                className="custom-alert-button cancel"
                onClick={closeDeleteConfirmationAlert}
              >
                {deleteConfirmAlert.cancelText}
              </button>
              <button
                className="custom-alert-button" // Default style is for confirm
                onClick={() => {
                  if (deleteConfirmAlert.onConfirm) deleteConfirmAlert.onConfirm();
                  closeDeleteConfirmationAlert(); // Close after confirm action is initiated
                }}
              >
                {deleteConfirmAlert.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSettings;