// d:\Zoom-Clone-Mern\server\middleware\authorizeRole.js

/**
 * Middleware to authorize users based on their roles.
 * @param {string[]} allowedRoles - An array of roles allowed to access the route.
 */
const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ msg: 'Forbidden: User role not found.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ msg: 'Forbidden: You do not have permission to perform this action.' });
    }
    next();
  };
};

module.exports = authorizeRole;