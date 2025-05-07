import React, { useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import './ResetPassword.css'; // Import the CSS file

function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { token } = useParams(); // Get token from URL
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        setLoading(true);

        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
            const response = await axios.post(`${apiUrl}/api/auth/reset-password/${token}`, { password });
            setMessage(response.data.message + ' Redirecting to login...');
            // Redirect to login page after a short delay
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'An error occurred. The link might be invalid or expired.';
            setError(errorMessage);
            console.error("Reset Password Error:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="reset-password-container">
            <div className="reset-password-form-container">
                <div>
                    <h2>
                    Reset Your Password
                    </h2>
                    <p className="description">
                        Enter your new password below.
                    </p>
                </div>
                <form className="reset-password-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <div>
                        <label htmlFor="password">New Password</label>
                        <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                placeholder="New Password"
                                value={password} // Keep value and onChange
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading || !!message} // Disable if loading or success
                            />
                        </div>
                        </div>
                        <div className="form-group"> {/* Separate group for confirm password */}
                            <label htmlFor="confirm-password">Confirm New Password</label>
                            <input
                                id="confirm-password"
                                name="confirm-password"
                                type="password"
                                required
                                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                placeholder="Confirm New Password"
                                value={confirmPassword} // Keep value and onChange
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={loading || !!message} // Disable if loading or success
                            />
                    </div>

                    {message && <p className="message">{message}</p>}
                    {error && <p className="error-message">{error}</p>}

                    <div>
                        <button
                            type="submit"
                            className="auth-button" // Use shared button style
                            disabled={loading || !!message} // Disable if loading or success
                        >
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </div>
                </form>
                 {!message && ( // Only show back to login if not successful yet
                    <div>
                    <Link to="/auth" className="back-link"> {/* Point back to /auth */}
                         Back to Login
                        </Link>
                    </div>
                 )}
            </div>
        </div>
    );
}

export default ResetPassword;