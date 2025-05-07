const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Adjust path if your middleware is elsewhere
const userController = require('../controllers/userController'); // We'll create this next
const upload = require('../middleware/upload'); // We'll create this for file uploads

// @route   PUT api/users/update-email
// @desc    Update user email
// @access  Private
router.put('/update-email', auth, userController.updateEmail);

// @route   PUT api/users/update-password
// @desc    Update user password
// @access  Private
router.put('/update-password', auth, userController.updatePassword);

// @route   POST api/users/update-picture
// @desc    Update user profile picture
// @access  Private
// 'profilePicture' is the field name the frontend sends in FormData
router.post('/update-picture', auth, upload.single('profilePicture'), userController.updateProfilePicture);

module.exports = router;