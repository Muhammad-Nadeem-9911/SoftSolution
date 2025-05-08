import React, { useEffect, useState, useRef } from 'react'; // Import useRef
import { useParams, useNavigate, Link } from 'react-router-dom'; 
import axios from 'axios'; // Or use fetch
import { FaSpinner, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import './VerifyEmailPage.css'; // You'll create this CSS file

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const VerifyEmailPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [verificationStatus, setVerificationStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('Verifying your email, please wait...');
  const [resendEmail, setResendEmail] = useState(''); // For the email input on error
  const [resendMessage, setResendMessage] = useState(''); // For messages related to resending
  const verificationAttemptedRef = useRef(false); // Ref to track if an API call attempt has been made
  const navigateTimeoutRef = useRef(null); // Ref to store the timeout ID for navigation

  useEffect(() => {
    // Clear any pending navigation timeout when the component mounts or dependencies change
    // This is important if the effect re-runs (e.g., due to StrictMode or token change)
    if (navigateTimeoutRef.current) {
      clearTimeout(navigateTimeoutRef.current);
    }

    console.log('[VerifyEmailPage] useEffect triggered. Token:', token);
    if (!token) {
      console.log('[VerifyEmailPage] No token found.');
      setMessage('Invalid verification link.');
      setVerificationStatus('error');
      setResendMessage(''); // Clear any previous resend messages
      verificationAttemptedRef.current = true; // Mark as attempted even if no token
      return;
    }

    if (verificationAttemptedRef.current) {
      console.log('[VerifyEmailPage] Verification already attempted, skipping API call.');
      return;
      setResendMessage(''); // Clear any previous resend messages
    }

    const verifyToken = async () => {
      console.log('[VerifyEmailPage] verifyToken called.');
      verificationAttemptedRef.current = true; // Mark that an attempt is being made
      try {
        // This is where you call your backend endpoint
        console.log(`[VerifyEmailPage] Making API call to verify token: ${token}`);
        const response = await axios.get(`${API_BASE_URL}/api/auth/verify-email/${token}`);
        console.log('[VerifyEmailPage] API call successful. Response:', response);
        setMessage(response.data.msg || 'Email verified successfully! You can now log in.');
        setVerificationStatus('success');
        setResendMessage(''); // Clear resend message on success
        // Optionally, redirect after a short delay
        // Ensure any previous timeout is cleared before setting a new one
        if (navigateTimeoutRef.current) {
          clearTimeout(navigateTimeoutRef.current);
        }
        navigateTimeoutRef.current = setTimeout(() => {
          console.log('[VerifyEmailPage] Navigating to /auth after successful verification.');
          navigate('/auth', { state: { message: response.data.msg || 'Email verified successfully! Please log in.' } });
        }, 3000);
      } catch (err) {
        console.error('[VerifyEmailPage] API call failed. Error object:', err);
        const errorMessage = err.response?.data?.msg || 'Email verification failed. The link may be invalid or expired.';
        // If an error occurs (e.g., from a second StrictMode call), cancel any pending navigation
        if (navigateTimeoutRef.current) {
          clearTimeout(navigateTimeoutRef.current);
          navigateTimeoutRef.current = null;
        }
        console.log(`[VerifyEmailPage] Setting error message: "${errorMessage}"`);
        setMessage(errorMessage);
        setResendMessage(''); // Clear any previous resend messages
        setVerificationStatus('error');
      }
    };

    verifyToken();

    // Cleanup function for the useEffect
    return () => {
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
      }
    };
  }, [token, navigate]); // Dependencies for the main effect

  // Log when message or status changes to see the sequence
  useEffect(() => {
    console.log(`[VerifyEmailPage] State update: message="${message}", verificationStatus="${verificationStatus}"`);
  }, [message, verificationStatus]);

  const handleResendVerificationLink = async (e) => {
    e.preventDefault(); // Prevent form submission if wrapped in a form
    if (!resendEmail) {
      setResendMessage('Please enter your email address.');
      return;
    }
    setResendMessage('Sending...');
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/resend-verification`, { email: resendEmail });
      setResendMessage(response.data.msg || 'New verification link sent. Please check your email.');
      // Optionally clear the email input after successful send
      // setResendEmail('');
    } catch (err) {
      setResendMessage(err.response?.data?.msg || 'Failed to send new verification link. Please try again.');
      console.error('Resend Verification Error:', err);
    }
  };

  return (
    <div className="verify-email-container">
      <div className="verify-email-box">
        {verificationStatus === 'verifying' && (
          <>
            <FaSpinner className="spinner-icon" />
            <h2>Verifying...</h2>
          </>
        )}
        {verificationStatus === 'success' && (
          <>
            <FaCheckCircle className="success-icon" />
            <h2>Verification Successful!</h2>
          </>
        )}
        {verificationStatus === 'error' && (
          <>
            <FaTimesCircle className="error-icon" />
            <h2>Verification Failed</h2>
          </>
        )}
        <p className="verification-message">{message}</p>

        {/* Resend verification option on error */}
        {verificationStatus === 'error' && (
          <div className="resend-verification-section">
            <p>If your link has expired or is invalid, you can request a new one.</p>
            <input
              type="email"
              placeholder="Enter your email address"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              className="resend-email-input" /* Add styling for this input */
            />
            <button onClick={handleResendVerificationLink} className="auth-button resend-button">
              Resend Verification Link
            </button>
            {resendMessage && <p className="resend-message">{resendMessage}</p>}
          </div>
        )}

        {verificationStatus !== 'verifying' && (
          <Link to="/auth" className="auth-button">
            Go to Login
          </Link>
        )}

      </div>
    </div>
  );
};

export default VerifyEmailPage;
