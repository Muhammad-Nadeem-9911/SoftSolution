const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const User = require('../models/User'); // Assuming your model is here
const crypto = require('crypto'); // Built-in crypto module for token generation
const sendEmail = require('../utils/sendEmail'); // Import the email utility
const authMiddleware = require('../middleware/auth'); // Import the middleware

// TODO: Move this secret to environment variables for production!
const JWT_SECRET = process.env.JWT_SECRET || 'SuperSecretKey123@'; // Use the same secret as in middleware
const JWT_EXPIRES_IN = '1h'; // Token expiry time

// @route   POST api/auth/signup
// @desc    Register a new user
// @access  Public
router.post(
  '/signup',
  [
    // Input validation
    check('username', 'Username is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
    // Optional: Add role validation if you allow specifying role during signup (usually not recommended)
    // check('role', 'Invalid role specified').optional().isIn(['admin', 'user'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role } = req.body; // Allow role specification if needed, otherwise remove it

    try {
      // Check if user already exists (by email or username)
      let user = await User.findOne({ $or: [{ email }, { username }] });
      
      if (user) {
        return res.status(400).json({ msg: 'User already exists with that email or username' });
      }

      // Create new user instance
      user = new User({
        username,
        email,
        password,
        role: role || 'user', // Default to 'user' if not provided or restrict role setting
      });

      // Hash password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);

      // Save user to database
      await user.save();

      // Create JWT payload
      const payload = {
        user: {
          id: user.id,
          role: user.role,
          // You might want to include username and email here if needed by the frontend immediately after signup
          // username: user.username,
          // email: user.email,
        },
      };

      // Sign the token
      jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }, (err, token) => {
        if (err) {
          // If jwt.sign fails, send a JSON error response from within the callback
          console.error('JWT Sign Error:', err.message);
          return res.status(500).json({ msg: 'Error signing token' });
        }
        // On success, send back the token AND the user object
        // The frontend AuthPage.js expects data.user for redirection
        const userResponse = { id: user.id, username: user.username, email: user.email, role: user.role };
        res.json({ token, user: userResponse });
      });
    } catch (err) {
      console.error('Signup Error:', err.message);
      res.status(500).json({ msg: 'Server error during signup' }); // Send JSON response
    }
  }
);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    console.log('[Login Route] Received login request for:', req.body.email); // Add log

    const { email, password } = req.body;

    try {
      // Check for user by email
      let user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ msg: 'Invalid Credentials' });
        console.log('[Login Route] User not found:', req.body.email); // Add log
      }

      // Compare submitted password with hashed password in DB
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: 'Invalid Credentials' });
        console.log('[Login Route] Invalid password for:', req.body.email); // Add log
      }

      // Create JWT payload
      const payload = {
        user: {
          id: user.id,
          role: user.role,
        },
      };

      // Sign the token
      console.log('[Login Route] Credentials valid, signing token for:', req.body.email); // Add log
      jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }, (err, token) => {
        if (err) {
          console.error('JWT Sign Error on Login:', err.message);
          return res.status(500).json({ msg: 'Error signing token' });
        }
        console.log('[Login Route] Token signed successfully, sending response.'); // Add log
        // Send back the token AND the user object for the frontend
        // Exclude password from the user object sent back
        const userResponse = { _id: user._id, id: user.id, username: user.username, email: user.email, role: user.role, profilePictureUrl: user.profilePictureUrl };
        res.json({ token, user: userResponse });
      });
    } catch (err) {
      console.error('Login Error:', err.message);
      res.status(500).json({ msg: 'Server error during login' });
    }
  }
);

// @route   GET api/auth/me
// @desc    Get logged in user's data (protected)
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // req.user is attached by the authMiddleware
    // Find user by ID from token payload, exclude password
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
        return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user); // Return user data (id, username, email, role, createdAt)
  } catch (err) {
    console.error('Get Me Error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST api/auth/forgot-password
// @desc    Request password reset link
// @access  Public
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
      return res.status(400).json({ message: 'Please provide an email address.' });
  }

  try {
      // 1. Find user by email
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
          // Important: Don't reveal if the user exists or not for security
          console.log(`[Forgot Password] Attempt for non-existent email: ${email}`);
          return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
      }

      // 2. Generate the random reset token
      const resetToken = crypto.randomBytes(20).toString('hex');

      // 3. Hash token and set to user model (store hashed version for security)
      user.resetPasswordToken = crypto
          .createHash('sha256')
          .update(resetToken)
          .digest('hex');

      // 4. Set token expire time (e.g., 15 minutes from now)
      user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

      await user.save();

      // 5. Create reset URL (adjust CLIENT_URL as needed)
      // Ensure CLIENT_URL is set in your .env!
      const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

      // 6. Create email message
      const message = `You are receiving this email because you (or someone else) requested a password reset for your account.\n\nPlease click on the following link, or paste it into your browser to complete the process:\n\n${resetUrl}\n\nThis link is valid for 15 minutes.\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n`;

      try {
          await sendEmail({
              email: user.email,
              subject: 'Password Reset Request',
              message,
          });

          console.log(`[Forgot Password] Reset email sent to: ${user.email}`);
          res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });

      } catch (emailErr) {
          console.error('[Forgot Password] Email sending error:', emailErr);
          // Clear the token fields if email fails to prevent unusable tokens
          user.resetPasswordToken = undefined;
          user.resetPasswordExpires = undefined;
          await user.save();
          res.status(500).json({ msg: 'Error sending password reset email. Please try again later.' });
      }

  } catch (err) {
      console.error('[Forgot Password] Server error:', err);
      res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST api/auth/reset-password/:token
// @desc    Reset password using token
// @access  Public
router.post('/reset-password/:token', async (req, res) => {
  const { password } = req.body;

  if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Please enter a new password with 6 or more characters.' });
  }

  try {
      // 1. Hash the token from the URL to match the one stored in DB
      const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

      // 2. Find user by hashed token and check if token is still valid (not expired)
      const user = await User.findOne({
          resetPasswordToken: hashedToken,
          resetPasswordExpires: { $gt: Date.now() }, // Check if expiry date is greater than now
      });

      if (!user) {
          return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
      }

      // 3. Set the new password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);

      // 4. Clear the reset token fields
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;

      await user.save();

      // Optional: Send confirmation email

      res.json({ message: 'Password has been reset successfully.' });

  } catch (err) {
      console.error('[Reset Password] Server error:', err);
      res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;