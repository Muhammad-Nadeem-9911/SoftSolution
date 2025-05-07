const mongoose=require('mongoose');

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
  });
  
  const User = mongoose.model('User', UserSchema);
  module.exports = User;