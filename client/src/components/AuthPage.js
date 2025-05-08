import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Import useAuth hook
import { useNavigate, useLocation } from 'react-router-dom'; // Import useNavigate and useLocation
import { Link } from 'react-router-dom'; // Import Link
import './AuthPage.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const AuthPage = () => {
  const { login } = useAuth(); // Get the login function from context
  const [isLogin, setIsLogin] = useState(true); // Toggle between Login and Signup
  const [formData, setFormData] = useState({
    username: '', // Only for signup
    email: '',
    password: '',
  });
  const [error, setError] = useState(''); // To display potential errors
  const [successMessage, setSuccessMessage] = useState(''); // For general success messages
  const [loading, setLoading] = useState(false); // To show loading state
  const navigate = useNavigate(); // Initialize useNavigate
  const location = useLocation(); // To get state from navigation (e.g., after email verification)

  // Display message passed from VerifyEmailPage
  useState(() => { if (location.state?.message) { setSuccessMessage(location.state.message); navigate(location.pathname, { replace: true, state: {} }); } }, [location.state, navigate]);

  const { username, email, password } = formData;

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const switchMode = () => {
    setIsLogin((prevIsLogin) => !prevIsLogin);
    setFormData({ username: '', email: '', password: '' }); // Reset form on switch
    setError(''); // Clear errors on switch
    setSuccessMessage(''); // Clear success message on switch
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    setLoading(true);
    setSuccessMessage('');

    const url = isLogin ? `${API_BASE_URL}/api/auth/login` : `${API_BASE_URL}/api/auth/signup`;
    const body = isLogin
      ? JSON.stringify({ email, password })
      : JSON.stringify({ username, email, password });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body,
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle errors from backend (like validation errors or user exists)
        const errorMsg = data.errors ? data.errors[0].msg : data.msg || 'An error occurred';
        throw new Error(errorMsg);
      }

      if (isLogin) {
        // --- LOGIN SUCCESS ---
        login(data.token, data.user); // Pass user object to context
        console.log("Login successful. Data received from API:", data);
        // Navigation will be handled by App.js useEffect based on authentication state
      } else {
        // --- SIGNUP SUCCESS ---
        // Don't log in. Show a message to verify email.
        setSuccessMessage(data.msg || 'Registration successful! Please check your email to verify your account.');
        // Optionally, reset the form fields after successful signup
        setFormData({ username: '', email: '', password: '' });
        console.log("Signup successful. Message from API:", data.msg);
      }

    } catch (err) {
      console.error('Auth Error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form-container"> {/* Keep this container */}
        <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
        <form onSubmit={onSubmit} className="auth-form"> {/* Add class to form */}
          {successMessage && <p className="success-message">{successMessage}</p>}
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input // Apply input styling implicitly via CSS
                type="text"
                name="username"
                value={username}
                onChange={onChange}
                required={!isLogin} // Required only for signup
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input // Apply input styling implicitly via CSS
              type="email"
              name="email"
              value={email}
              onChange={onChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input // Apply input styling implicitly via CSS
              type="password"
              name="password"
              value={password}
              onChange={onChange}
              required
              minLength={isLogin ? undefined : 6} // Min length validation only for signup
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <div> {/* Wrap button for consistent spacing if needed */}
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Processing...' : isLogin ? 'Login' : 'Sign Up'}
            </button>
          </div>
        </form>
        {/* Forgot Password Link - Styled as a switch button */}
        {isLogin && ( // Only show on the Login form
            <Link to="/forgot-password" className="switch-button"> {/* Keep switch-button style */}
                Forgot your password?
            </Link>
        )}
        <button onClick={switchMode} className="switch-button"> {/* Keep switch-button style */}
        {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
};

export default AuthPage;