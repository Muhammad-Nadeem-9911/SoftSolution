import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Import useAuth hook
import { useNavigate } from 'react-router-dom'; // Import useNavigate
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
  const [loading, setLoading] = useState(false); // To show loading state
  const navigate = useNavigate(); // Initialize useNavigate

  const { username, email, password } = formData;

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const switchMode = () => {
    setIsLogin((prevIsLogin) => !prevIsLogin);
    setFormData({ username: '', email: '', password: '' }); // Reset form on switch
    setError(''); // Clear errors on switch
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    setLoading(true);

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

      // --- SUCCESS ---
      // Assuming your login function in AuthContext can also take the user object
      // If it only takes token, you might need to adjust AuthContext or handle user state here.
      login(data.token, data.user); // Pass user object to context if it handles it
      
      // --- Add these console logs for debugging ---
      console.log("Data received from API:", data);
      console.log("User object from API data:", data.user);
      console.log("User role from API data:", data.user?.role); // Use optional chaining just in case data.user is undefined
      // Navigation will now be handled by an effect in App.js or AuthContext
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