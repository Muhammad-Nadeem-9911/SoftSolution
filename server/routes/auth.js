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
  async (req, res) => { // Corrected arrow function syntax
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role } = req.body; // Allow role specification if needed, otherwise remove it
        const lowercasedEmail = email.toLowerCase();

    try {
      // Check if user already exists (by email or username)
      // Use lowercasedEmail for checking
      let existingUser = await User.findOne({ $or: [{ email: lowercasedEmail }, { username }] });      
      if (existingUser) {
        return res.status(400).json({ msg: 'User already exists with that email or username' });
      }

      // Create new user instance (in memory, not saved yet)
      const newUser = new User({
        username,
        email: lowercasedEmail, // Store email in lowercase
        password,
        role: role || 'user', // Default to 'user' if not provided or restrict role setting
      });

      // Password will be hashed by the pre-save hook in User.js

      // Generate email verification token (method is on the user instance)
      const verificationTokenPlain = newUser.createEmailVerificationToken();
      // isVerified defaults to false. verificationToken (hashed) and verificationTokenExpires are set by the method.

      // Send verification email
      const verifyURL = `${process.env.FRONTEND_URL}/verify-email/${verificationTokenPlain}`;
      const emailHtml = `
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 20px 0 30px 0;" align="center">
              <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; border: 1px solid #cccccc; background-color: #ffffff;">
                <tr>
                  <td align="center" bgcolor="#007bff" style="padding: 40px 0 30px 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                    Welcome to SoftSolution!
                 </td>
                </tr>
                <tr>
                  <td bgcolor="#ffffff" style="padding: 40px 30px 40px 30px;">
                    <h1 style="font-size: 24px; margin: 0 0 20px 0;">Hi ${newUser.username},</h1>
                    <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 24px;">Thank you for registering. Please verify your email address to complete your signup by clicking the button below:</p>
                    <p style="text-align: center; margin: 20px 0;"><a href="${verifyURL}" target="_blank" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">Verify Your Email</a></p>
                    <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 24px;">This verification link will expire in 10 minutes.</p>
                    <p style="margin: 0; font-size: 16px; line-height: 24px;">If you did not create an account, please ignore this email.</p>
                  </td>
                </tr>
                <tr>
                  <td bgcolor="#eeeeee" style="padding: 30px 30px; text-align: center; font-size: 14px; color: #555555;">
                    &copy; ${new Date().getFullYear()} MeetSphere. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      `;

      // Attempt to send verification email BEFORE saving the user
      await sendEmail({
        email: newUser.email,
        subject: 'SoftSolution - Email Verification Required',
        html: emailHtml,
      });

      // If email sending was successful, NOW save the user to the database
      await newUser.save({ validateBeforeSave: false }); // Password hashing happens via pre-save hook

      // Respond with success
      res.status(201).json({ 
        msg: 'Registration successful! Please check your email to verify your account.' 
      });

    } catch (err) {
      console.error('Signup Error:', err.message, err.stack ? err.stack : '');
      // If email sending failed or user saving failed, the user is not registered.
      res.status(500).json({ msg: 'Registration failed. There was an issue sending the verification email or saving your account. Please try again later.' });
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
  async (req, res) => { // Corrected arrow function syntax
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
        console.log('[Login Route] User not found:', req.body.email); // Add log
        return res.status(400).json({ msg: 'Invalid Credentials' });
      }

      // Compare submitted password with hashed password in DB
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log('[Login Route] Invalid password for:', req.body.email); // Add log
        return res.status(400).json({ msg: 'Invalid Credentials' });
      }

      // Check if user is verified
      if (!user.isVerified) {
        return res.status(401).json({ msg: 'Please verify your email address to log in. Check your inbox for a verification link.' });
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
router.get('/me', authMiddleware, async (req, res) => { // Corrected arrow function syntax
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
router.post('/forgot-password', async (req, res) => { // Corrected arrow function syntax
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
router.post('/reset-password/:token', async (req, res) => { // Corrected arrow function syntax
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

// @route   GET api/auth/verify-email/:token
// @desc    Verify user's email address
// @access  Public
router.get('/verify-email/:token', async (req, res) => {
  try {
    const verificationTokenPlain = req.params.token;

    // Hash the token from the URL to match the one stored in the DB
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationTokenPlain)
      .digest('hex');

    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpires: { $gt: Date.now() }, // Check if token is not expired
    });

    if (!user) {
      return res.status(400).json({ msg: 'Verification token is invalid or has expired. Please try registering again or request a new verification email.' });
    }

    user.isVerified = true;
    user.verificationToken = undefined; // Clear the token
    user.verificationTokenExpires = undefined; // Clear expiry
    await user.save({ validateBeforeSave: false }); // Save changes

    res.status(200).json({ msg: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    console.error('Email verification error:', err.message);
    res.status(500).json({ msg: 'Error verifying email. Please try again later.' });
  }
});

// @route   POST api/auth/resend-verification
// @desc    Resend email verification link
// @access  Public
router.post('/resend-verification', [
  check('email', 'Please include a valid email').isEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists for security reasons
      return res.status(200).json({ msg: 'If an account with that email exists and is unverified, a new verification link has been sent.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ msg: 'This account is already verified. You can log in.' });
    }

    // Generate a new verification token
    const verificationTokenPlain = user.createEmailVerificationToken(); // This method is on the User model
    await user.save({ validateBeforeSave: false }); // Save the new token and expiry

    const verifyURL = `${process.env.FRONTEND_URL}/verify-email/${verificationTokenPlain}`;
    // Using the improved HTML email template
    const emailHtml = `
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding: 20px 0 30px 0;" align="center">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; border: 1px solid #cccccc; background-color: #ffffff;">
              <tr>
                <td align="center" bgcolor="#007bff" style="padding: 40px 0 30px 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                  SoftSolution Email Verification
                </td>
              </tr>
              <tr>
                <td bgcolor="#ffffff" style="padding: 40px 30px 40px 30px;">
                  <h1 style="font-size: 24px; margin: 0 0 20px 0;">Hi ${user.username},</h1>
                  <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 24px;">You requested a new verification link for your MeetSphere account. Please click the button below to verify your email address:</p>
                  <p style="text-align: center; margin: 20px 0;"><a href="${verifyURL}" target="_blank" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">Verify Your Email</a></p>
                  <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 24px;">This verification link will expire in 10 minutes.</p>
                  <p style="margin: 0; font-size: 16px; line-height: 24px;">If you did not request this, please ignore this email.</p>
                </td>
              </tr>
              <tr>
                <td bgcolor="#eeeeee" style="padding: 30px 30px; text-align: center; font-size: 14px; color: #555555;">
                  &copy; ${new Date().getFullYear()} MeetSphere. All rights reserved.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    `;

    await sendEmail({
      email: user.email,
      subject: 'SoftSolution - New Email Verification Link',
      html: emailHtml,
    });

    res.status(200).json({ msg: 'A new verification link has been sent to your email address. Please check your inbox.' });
  } catch (err) {
    console.error('Resend verification error:', err.message);
    // Check if the error is from sendEmail utility
    if (err.message.includes('Email could not be sent')) {
        return res.status(500).json({ msg: 'Failed to send verification email. Please try again later or contact support.' });
    }
    res.status(500).json({ msg: 'Server error. Please try again later.' });
  }
});

module.exports = router;