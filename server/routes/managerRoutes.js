// d:\Zoom-Clone-Mern\server\routes\managerRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); // Adjust path if your auth middleware is elsewhere
const authorizeRole = require('../middleware/authorizeRole');

const {
  getManageableUsers,
  updateUserRoleByManager,
  deleteUserByManager
} = require('../controllers/managerActionsController');

// All routes in this file will first be protected by authMiddleware
// and then by authorizeRole(['manager'])
router.use(authMiddleware);
router.use(authorizeRole(['manager']));

// @route   GET /api/manager/users
// @desc    Get all users manageable by a manager (i.e., 'user' roles)
// @access  Private (Manager)
router.get('/users', getManageableUsers);

// @route   PUT /api/manager/users/:userId/role
// @desc    Update a 'user's role (manager can only set to 'user')
// @access  Private (Manager)
router.put('/users/:userId/role', updateUserRoleByManager);

// @route   DELETE /api/manager/users/:userId
// @desc    Delete a 'user' account
// @access  Private (Manager)
router.delete('/users/:userId', deleteUserByManager);

module.exports = router;