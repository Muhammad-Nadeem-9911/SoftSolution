const mongoose=require('mongoose');
const crypto = require('crypto'); // Import crypto
const bcrypt = require('bcryptjs'); // For password hashing

const UserSchema = new mongoose.Schema({
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: { // Optional, but good practice
      type: String,
      required: true,
      lowercase: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'manager'], // Add 'manager' to the allowed roles
      default: 'user' // Default role for new users
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    
    profilePictureUrl: { // Add this field
      type: String,
      default: null, // Or a path to a default avatar if you have one
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    activeMeeting: {
      meetingId: { type: String, default: null }, // ID of the meeting they are in
      socketId: { type: String, default: null },  // WebSocket ID for this specific meeting session
      joinedAt: { type: Date, default: null }     // Timestamp when they joined
    },
    // Fields for email verification
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
    },
    verificationTokenExpires: {
      type: Date,
    },
  }, { timestamps: true }); // Added timestamps for createdAt and updatedAt by Mongoose

  // Hash password before saving if it's modified
  UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
      return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  });

  // Method to generate email verification token
  UserSchema.methods.createEmailVerificationToken = function() {
    const verificationTokenPlain = crypto.randomBytes(32).toString('hex');
    this.verificationToken = crypto.createHash('sha256').update(verificationTokenPlain).digest('hex');
    this.verificationTokenExpires = Date.now() + 10 * 60 * 1000; // Token expires in 10 minutes
    return verificationTokenPlain; // Return the unhashed token to send via email
  };
  
  const User = mongoose.model('User', UserSchema);
  module.exports = User;