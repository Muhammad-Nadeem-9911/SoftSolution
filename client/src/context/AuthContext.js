// d:\Zoom-Clone-Mern\client\src\context\AuthContext.js
import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [_internalUser, _setInternalUser] = useState(null); // Internal state for user
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadUser = useCallback(async (authToken) => {
    if (!authToken) {
      console.log('[AuthContext loadUser] No authToken provided. Clearing user and setting loading to false.');
      _setInternalUser(null); // Directly set internal state
      setIsAuthenticated(false);
      setLoading(false); // Ensure loading is false if we return early
      return;
    }
    console.log('[AuthContext loadUser] AuthToken provided. Setting loading to true and fetching user.');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Failed to load user');
      const userData = await res.json();
      // CRITICAL: Set all auth-related states before setting loading to false
      _setInternalUser(userData); // Set internal user state
      setIsAuthenticated(true);
      console.log('[AuthContext loadUser] User loaded:', userData);
      // Token is already set from the initial useEffect or login, so no need to setToken(authToken) here again unless it changes
    } catch (error) {
      console.error('Load User Error:', error.message);
      localStorage.removeItem('token');
      setToken(null);
      _setInternalUser(null); // Clear internal user state
      setIsAuthenticated(false);
    } finally {
      console.log('[AuthContext loadUser] loadUser finished. Setting loading to false.');
      setLoading(false);
    }
  }, []); // No dependencies needed as all setters are stable
  
  // Custom setUser function to be exposed, which also manages isAuthenticated
  const setUser = useCallback((userData) => {
    _setInternalUser(userData);
    setIsAuthenticated(!!userData); // Automatically set isAuthenticated based on userData presence
    if (userData) {
      console.log('[AuthContext setUser] User context updated via exposed setUser:', userData);
    } else {
      console.log('[AuthContext setUser] User context cleared via exposed setUser.');
    }
    // Note: This setUser does not manage 'loading' state. Operations like login/loadUser do.
  }, []); // No dependencies needed as all setters are stable
  
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    console.log('[AuthContext useEffect] Initializing. Stored token:', storedToken);
    if (storedToken) {
      setToken(storedToken);
      loadUser(storedToken);
    } else {
      console.log('[AuthContext useEffect] No stored token. Clearing user, auth status, and setting loading to false.');
      _setInternalUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, [loadUser]);

  useEffect(() => {
    console.log('[AuthContext] Internal user state changed to (useEffect [_internalUser]):', _internalUser);
  }, [_internalUser]);

  const login = useCallback((newToken, userDataFromLogin) => {
    console.log('[AuthContext login] Called with token and user data:', userDataFromLogin);
    localStorage.setItem('token', newToken);
    setToken(newToken);
    // setLoading(true); // Optionally set loading to true if login involves async operations before user data is ready
    if (userDataFromLogin) {
      setUser(userDataFromLogin); // Use the new exposed setUser, it handles _internalUser and isAuthenticated
      console.log('[AuthContext login] User data provided with login. Setting loading to false.');
      setLoading(false);
    } else {
      // If userDataFromLogin is not provided, loadUser will handle setting user and loading state.
      loadUser(newToken);
    }
  }, [loadUser, setUser]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null); // Use the new exposed setUser, it handles _internalUser and isAuthenticated;
    setLoading(false);
    console.log('User logged out');
    navigate('/auth');
  }, [navigate, setUser]);

  const value = useMemo(() => {
    console.log('[AuthContext useMemo] Re-evaluating context value. User:', _internalUser, 'Token:', token ? 'Exists' : 'Missing', 'IsAuth:', isAuthenticated, 'Loading:', loading);
    const contextValue = {
      token,
      user: _internalUser, // Expose the internal user state
      isAuthenticated,
      loading,
      login,
      logout,
      setUser, // Exposing the direct setUser from useState
      loadUser
    };
    return contextValue;
  }, [token, _internalUser, isAuthenticated, loading, login, logout, setUser, loadUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
