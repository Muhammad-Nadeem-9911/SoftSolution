const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Import User model if you need to fetch user data here

// TODO: Move this secret to environment variables for production!
const JWT_SECRET = process.env.JWT_SECRET || 'SuperSecretKey123@'; // Make sure this matches the secret used in routes/auth.js

module.exports = function(req, res, next) {
  console.log('[Auth Middleware] Checking headers...'); // Add log
  // Get token from the Authorization header
  const authHeader = req.header('Authorization');
  console.log('[Auth Middleware] Authorization Header:', authHeader); // Log the header value
  const token = authHeader?.replace('Bearer ', ''); // Extract token after 'Bearer '
  console.log('[Auth Middleware] Extracted Token:', token); // Log the extracted token

  // Check if no token was extracted
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Add user payload (id, role) from token to request object
    // It's often better to attach just the ID and maybe role,
    // and fetch full user details in the route handler if needed.
    // Make sure the payload structure matches how you created it in routes/auth.js
    req.user = decoded.user; // Assuming payload is { user: { id: '...', role: '...' } }
    console.log('[Auth Middleware] Token verified. User payload:', req.user); // Log payload

    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};