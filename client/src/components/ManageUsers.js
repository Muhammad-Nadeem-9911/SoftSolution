import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { FaUsers, FaUser, FaTrash, FaSpinner, FaArrowLeft, FaUserShield, FaUserTag, FaSearch, FaFilter } from 'react-icons/fa'; // Changed FaEdit to FaUser
import './ManageUsers.css'; // We'll create this CSS file next

// If MeetingRoom.css is not imported globally (e.g., in App.js or index.js),
// and its styles are not conflicting, you can import it here for the alert.
// import './MeetingRoom.css'; // Or ensure styles are globally available

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ManageUsers = () => {
  // Destructure loading state from useAuth and alias it to avoid naming conflict
  const { token, user: managerUser, loading: authContextLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [componentLoading, setComponentLoading] = useState(true); // Renamed from 'loading'
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState(''); // 'all', 'user', 'admin'
  const [displayedSearchTerm, setDisplayedSearchTerm] = useState(''); // For the input field value
  const debounceTimeoutRef = useRef(null);

  // State for custom confirmation alert
  const [alertConfig, setAlertConfig] = useState({
    isVisible: false,
    title: '',
    message: '',
    type: 'info', // 'info', 'success', 'error', 'warning'
    onConfirm: null,
    onCancel: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  });
  
  console.log('%c[ManageUsers Component] TOP LEVEL - Rendering. AuthContextLoading:', 'color: lime; font-weight: bold;', authContextLoading, 'ManagerUser:', managerUser, 'Token:', token ? 'Exists' : 'Missing');

  const fetchUsers = useCallback(async () => {
    console.log('%c[ManageUsers fetchUsers] CALLED. AuthContextLoading:', 'color: cyan;', authContextLoading, 'Token:', token ? 'Exists' : 'Missing', 'ManagerUser ID:', managerUser?._id);
    console.log('%c[ManageUsers fetchUsers] Search Term:', 'color: orange;', searchTerm, 'Role Filter:', roleFilter);

    if (authContextLoading) {
      console.log('%c[ManageUsers fetchUsers] Auth context is still loading. Aborting fetch.', 'color: orange;');
      // setComponentLoading(true); // Ensure component loading is true while auth is pending
      return; // Wait for auth to finish loading
    }

    if (!token || !managerUser?._id) {
      console.error('%c[ManageUsers fetchUsers] No token or managerUser ID available. Aborting fetch.', 'color: red;');
      setError('Authentication details are missing. Cannot fetch users.');
      setUsers([]); // Clear users if auth fails
      setComponentLoading(false);
      return;
    }
    setComponentLoading(true);
    setError('');
    try {
      const params = {};
      if (searchTerm) {
        params.search = searchTerm;
      }
      if (roleFilter && roleFilter !== 'all') {
        params.roleFilter = roleFilter;
      }
      console.log('%c[ManageUsers fetchUsers] Attempting axios.get to /api/manager/users with params:', 'color: cyan;', params);
      const response = await axios.get(`${API_BASE_URL}/api/manager/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params: params // Send search and filter as query parameters
      });
      console.log('%c[ManageUsers fetchUsers] API Response for /api/manager/users:', 'color: lightblue;', response);
      // Server already filters out the current manager.
      setUsers(response.data || []); // Ensure response.data is at least an empty array if null/undefined
    } catch (err) {
      setUsers([]); // Clear users on error
      setError(err.response?.data?.message || 'Failed to fetch users.');
      console.error("%c[ManageUsers fetchUsers] Fetch users error:", 'color: red;', err.response || err);
    } finally {
      setComponentLoading(false);
    }
  }, [token, managerUser, searchTerm, roleFilter, authContextLoading]); // Add authContextLoading

  useEffect(() => {
    // Only call fetchUsers if auth is not loading.
    // And if token and managerUser._id are available.
    if (!authContextLoading && token && managerUser?._id) {
        fetchUsers();
        console.log('%c[ManageUsers useEffect] Conditions met: Auth loaded, token and managerUser present. Calling fetchUsers.', 'color: green;');
    } else if (authContextLoading) {
        console.log('%c[ManageUsers useEffect] Auth context is loading. Setting componentLoading to true.', 'color: orange;');
        setComponentLoading(true);
    } else if (!authContextLoading && (!token || !managerUser?._id)) {
        // Auth is loaded, but token or managerUser is still missing.
        // This means AuthContext finished loading but didn't provide necessary details.
        // This is an error condition for this component.
        console.error('%c[ManageUsers useEffect] Auth loaded, but token or managerUser details are missing. Token:', 'color: red;', token ? 'Exists' : 'Missing', 'ManagerUser:', managerUser);
        setError('Authentication details are critically missing after auth loaded. Cannot fetch users.');
        setUsers([]); // Ensure users list is empty
        setComponentLoading(false); // Stop loading to display the error.
    }
}, [fetchUsers, authContextLoading, token, managerUser]); // Add token and managerUser to ensure effect re-runs when they are available

  // Handler for search input change with debouncing
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setDisplayedSearchTerm(value); // Update input field immediately

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setSearchTerm(value); // Update actual searchTerm for API call after delay
    }, 500); // 500ms delay
  };

  const handleRoleChange = async (userId, newRole) => {
    setMessage('');
    setError('');

    if (authContextLoading || !token) {
      setError('Authentication not ready. Please try again.');
      return;
    }
    setError('');
    if (!newRole) {
      setError('Please select a role.');
      return;
    }
    // Removed client-side restriction on role assignment,
    // as managers now have full power via backend.

    try {
      // API call to update role: PUT /api/users/:userId/role
      // For now, this is a placeholder. You'll need to implement the actual API call.
      console.log(`Attempting to change role for user ${userId} to ${newRole}`);
      await axios.put(`${API_BASE_URL}/api/manager/users/${userId}/role`, { role: newRole }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(`User ${userId}'s role updated to ${newRole}.`);
      fetchUsers(); // Re-fetch users to see changes
    } catch (err) {
      setError(err.response?.data?.message || `Failed to update role for user ${userId}.`);
      console.error("Update role error:", err);
    }
  };

  // Function to show the custom confirmation alert
  const showConfirmationAlert = (config) => {
    setAlertConfig({
      isVisible: true,
      title: config.title || 'Confirm Action',
      message: config.message || 'Are you sure?',
      type: config.type || 'warning',
      onConfirm: config.onConfirm,
      onCancel: config.onCancel,
      confirmText: config.confirmText || 'Confirm',
      cancelText: config.cancelText || 'Cancel',
    });
  };

  // Function to close the custom confirmation alert
  const closeAlert = () => {
    setAlertConfig(prev => ({ ...prev, isVisible: false, onConfirm: null, onCancel: null }));
  };


  const handleDeleteUser = async (userId, username) => {
    setMessage('');
    setError('');

    if (authContextLoading || !token) {
      setError('Authentication not ready. Please try again.');
      return;
    }

    showConfirmationAlert({
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete user "${username}" (ID: ${userId})? This action cannot be undone.`,
      type: 'error', // Using 'error' type for a destructive action
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          console.log(`Attempting to delete user ${userId}`);
          await axios.delete(`${API_BASE_URL}/api/manager/users/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMessage(`User ${username} (ID: ${userId}) deleted successfully.`);
          fetchUsers(); // Re-fetch users
          setTimeout(() => setMessage(''), 3000); // Clear message after 3s
        } catch (err) {
          setError(err.response?.data?.message || `Failed to delete user ${userId}.`);
          console.error("Delete user error:", err);
          setTimeout(() => setError(''), 3000); // Clear error after 3s
        }
      },
      onCancel: () => {
        // Optional: console.log('Deletion cancelled by user.');
      }
    });
  };

  console.log('%c[ManageUsers Component] Before return. AuthContextLoading:', 'color: lime; font-weight: bold;', authContextLoading, 'ComponentLoading:', componentLoading);

  if (authContextLoading || componentLoading) { // Check both loading states
    return (
        <div className="manage-users-container" style={{ textAlign: 'center', padding: '50px' }}>
            <FaSpinner className="spinner" /> {authContextLoading ? 'Authenticating...' : 'Loading users...'}
        </div>
    );
}
  return (
    <div className="manage-users-container">
      <Link to="/manager/dashboard" className="back-link"><FaArrowLeft /> Back to Dashboard</Link>
      <h1><FaUsers /> Manage Users</h1>
      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      <div className="filters-container">
        <div className="filter-group">
          <FaSearch className="filter-icon" />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={displayedSearchTerm} // Bind to displayedSearchTerm
            onChange={handleSearchChange} // Use the debounced handler
            className="search-input"
          />
        </div>
        <div className="filter-group">
          <FaFilter className="filter-icon" />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="role-filter-select">
            <option value="">All Roles (User/Manager/Admin)</option>
            <option value="user">User Only</option>
            <option value="manager">Manager Only</option>
            <option value="admin">Admin Only</option>
          </select>
        </div>
      </div>
      {/* Conditional rendering for the user list or loading state */}
      {componentLoading && !authContextLoading ? ( // Show this only if component is loading data, but auth is done
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <FaSpinner className="spinner" /> Loading users...
        </div>
      ) : !authContextLoading && users.length === 0 ? ( // Ensure auth is done before saying "no users"
        <p style={{ textAlign: 'center', padding: '20px' }}>No users found matching your criteria.</p>
      ) : (
        <>
          {console.log('%c[ManageUsers Component] Rendering main JSX. Users count:', 'color: lime; font-weight: bold;', users.length)}
          <div className="table-responsive-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Current Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>
                      {user.role === 'admin' && (
                        <span title="Admin" style={{ display: 'flex', alignItems: 'center' }}>
                          <FaUserShield style={{ marginRight: '5px' }} /> Admin
                        </span>
                      )}
                      {user.role === 'manager' && (
                        <span title="Manager" style={{ display: 'flex', alignItems: 'center' }}>
                          <FaUserTag style={{ marginRight: '5px' }} /> Manager
                        </span>
                      )}
                      {user.role === 'user' && (
                        <span title="User" style={{ display: 'flex', alignItems: 'center' }}>
                          <FaUser style={{ marginRight: '5px' }} /> User
                        </span>
                      )}
                    </td>
                    <td className="actions-cell">
                       {/* Determine if the current manager can modify this specific user row */}
                       {/* Based on current server logic, a manager can only modify users with role 'user' */}
                       {(() => {
                        const targetUser = user; // The user in the current row
                        // Manager can modify anyone except themselves.
                        const canManagerModifyTarget = targetUser._id !== managerUser._id; 
  
                        return (
                        <>
                          <select
                            value={targetUser.role} // Display current role
                            onChange={(e) => handleRoleChange(targetUser._id, e.target.value)}
                            className="role-select"
                            disabled={!canManagerModifyTarget} // Disable if manager cannot modify this target
                          >
                            {/* Manager now has full power to assign any of these roles */}
                            <option value="user">User</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button
                            onClick={() => handleDeleteUser(targetUser._id, targetUser.username)}
                            className="action-button delete-button"
                            title={canManagerModifyTarget ? "Delete User" : `Cannot delete self`}
                            disabled={!canManagerModifyTarget} // Disable if manager cannot modify this target
                          >
                            <FaTrash />
                          </button>
                        </>
                        ); // Close the return statement of the IIFE
                      })()} {/* Close the IIFE itself */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </> 
      )
    } {/* This closes the ternary operator's else block */}

      {/* Custom Confirmation Alert Modal */}
      {alertConfig.isVisible && (
        <div className="custom-alert-overlay" onClick={closeAlert}> {/* Closes on overlay click */}
          <div 
            className={`custom-alert-box custom-alert-${alertConfig.type}`}
            onClick={(e) => e.stopPropagation()} // Prevents closing when clicking inside the box
          >
            <div className="custom-alert-content">
              <h4>{alertConfig.title}</h4>
              <p>{alertConfig.message}</p>
            </div>
            <div className="custom-alert-actions">
              <button
                className="custom-alert-button cancel"
                onClick={() => {
                  if (alertConfig.onCancel) alertConfig.onCancel();
                  closeAlert();
                }}
              >
                {alertConfig.cancelText}
              </button>
              <button
                className="custom-alert-button" // Default style is for confirm
                onClick={() => {
                  if (alertConfig.onConfirm) alertConfig.onConfirm();
                  closeAlert();
                }}
              >
                {alertConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div> // This closes className="manage-users-container"
  ); // This closes the return statement
};

export default ManageUsers;