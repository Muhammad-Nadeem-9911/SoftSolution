// d:\Zoom-Clone-Mern\server\middleware\authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust path if your User model is elsewhere

const authMiddleware = async (req, res, next) => {
  // Logs you provided indicate this part is working:
  // console.log('[Auth Middleware] Checking headers...');
  const authHeader = req.header('Authorization');
  // console.log('[Auth Middleware] Authorization Header:', authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'No token, authorization denied. Header format should be "Bearer <token>".' });
  }
  const token = authHeader.split(' ')[1];
  // console.log('[Auth Middleware] Extracted Token:', token);

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log('[Auth Middleware] Token verified. User payload:', decoded.user);

    // ---- ADD/MODIFY LOGS HERE ----
    console.log('[Auth Middleware] Attempting to fetch user from DB with ID:', decoded.user.id);
    req.user = await User.findById(decoded.user.id).select('-password');

    if (!req.user) {
      console.error('[Auth Middleware] User not found in DB for ID:', decoded.user.id);
      return res.status(401).json({ msg: 'User associated with token not found.' }); // Important to send response
    }
    console.log('[Auth Middleware] User fetched from DB and attached to req.user:', req.user._id, req.user.role);
    console.log('[Auth Middleware] Calling next().');
    next();
    // ---- END OF ADDED/MODIFIED LOGS ----

  } catch (err) {
    console.error('[Auth Middleware] Token verification or user fetch error:', err.message, err.stack);
    res.status(401).json({ msg: 'Token is not valid or user fetch failed.' });
  }
};

module.exports = authMiddleware;
