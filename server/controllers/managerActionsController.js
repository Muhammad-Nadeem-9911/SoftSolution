// d:\Zoom-Clone-Mern\server\controllers\managerActionsController.js
const User = require('../models/User'); // Assuming your User model is in ../models/User
const sendEmail = require('../utils/sendEmail'); // Import the sendEmail utility
const cloudinary = require('cloudinary').v2; // Import Cloudinary

// @desc    Get all users (for manager to manage)
// @route   GET /api/manager/users
// @access  Private (Manager)
exports.getManageableUsers = async (req, res) => {
  console.log('[managerActionsController] GET /api/manager/users - Request received.');
  console.log('[managerActionsController] Query params:', req.query);
  try {
    console.log('[managerActionsController] Performing user:', req.user ? req.user.id : 'No req.user');
    if (!req.user || !req.user.id) {
      console.error('[managerActionsController] Error: req.user or req.user.id is undefined.');
      return res.status(401).json({ msg: 'User not authenticated or user ID missing.' });
    }

    const { search, roleFilter } = req.query;

    const query = {
      role: { $in: ['user', 'admin', 'manager'] }, // Manager can now see 'user', 'admin', and 'manager' roles
      _id: { $ne: req.user.id } // Exclude the manager themselves
    };

    if (roleFilter && ['user', 'admin', 'manager'].includes(roleFilter)) {
      query.role = roleFilter; // Override if a specific valid role filter is applied (user, admin, or manager)
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i'); // 'i' for case-insensitive
      query.$or = [
        { username: searchRegex },
        { email: searchRegex }
      ];
    }

    console.log('[managerActionsController] Database query:', JSON.stringify(query));
    const users = await User.find(query).select('-password');
    console.log('[managerActionsController] Users found:', users.length);
    res.json(users);
} catch (err) {
    console.error('[managerActionsController] Error in getManageableUsers:', err.message, err.stack);
    res.status(500).send('Server Error');
  }
};

// @desc    Update a 'user' role to another 'user' role (placeholder, or demote from a higher role if logic changes)
//          Or, more practically, a manager might change aspects of a 'user' account,
//          but typically not their role if the manager can only manage 'user' roles.
//          For this example, let's assume a manager can only re-affirm a 'user' role or
//          if a user was mistakenly something else and needs to be set to 'user'.
// @route   PUT /api/manager/users/:userId/role
// @access  Private (Manager)
exports.updateUserRoleByManager = async (req, res) => {
  const { role: newRole } = req.body;
  const { userId: targetUserId } = req.params;
  const performingUser = req.user; // This will be the manager

  // Validate the newRole
  if (!['user', 'manager', 'admin'].includes(newRole)) {
    return res.status(400).json({ msg: "Invalid role specified. Must be 'user', 'manager', or 'admin'." });
  }

  try {
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({ msg: 'User not found.' });
    }

    // Prevent self-role change
    if (targetUser._id.toString() === performingUser.id) {
        return res.status(400).json({ msg: 'Cannot change your own role.' });
    }

    // Prevent a manager from changing their own role if they are the target (already covered above)
    // No other restrictions on which roles a manager can change, or what they can change them to.
    if (targetUser.role === 'admin' && newRole !== 'admin' && performingUser.id === targetUser.id) {
      // This specific case is unlikely given self-change prevention, but as a safeguard:
      // An admin (who is also the manager performing action) trying to demote themselves.
      // This might be allowed or disallowed based on stricter business rules. For now, let's allow.
    }

    targetUser.role = newRole; // Effectively, this re-affirms 'user' or sets to 'user'
    await targetUser.save();

    const updatedUserResponse = targetUser.toObject();
    delete updatedUserResponse.password;

    res.json({ msg: 'User role updated successfully.', user: updatedUserResponse });

  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
        return res.status(404).json({ msg: 'User not found (invalid ID format).' });
    }
    res.status(500).send('Server Error');
  }
};

// @desc    Delete a 'user' account (by a manager)
// @route   DELETE /api/manager/users/:userId
// @access  Private (Manager)
exports.deleteUserByManager = async (req, res) => {
  const { userId: targetUserId } = req.params;
  const performingUser = req.user; // The manager

  try {
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({ msg: 'User not found.' });
    }

    // Prevent self-deletion
    if (targetUser._id.toString() === performingUser.id) {
        return res.status(400).json({ msg: 'Cannot delete your own account.' });
    }

    // --- Delete profile picture from Cloudinary if it exists ---
    if (targetUser.profilePictureUrl && targetUser.profilePictureUrl.includes('cloudinary.com')) {
        try {
            // Extract public_id from the Cloudinary URL.
            // This logic assumes your Cloudinary URLs might look like:
            // http://res.cloudinary.com/your_cloud_name/image/upload/v1234567890/your_folder/image_id.jpg
            // The public_id needed for deletion is typically "your_folder/image_id".

            let publicIdForDeletion = null;
            const urlParts = targetUser.profilePictureUrl.split('/');
            const uploadIndex = urlParts.indexOf('upload');

            if (uploadIndex !== -1 && uploadIndex + 1 < urlParts.length) {
                // Get the parts after "/upload/"
                let pathParts = urlParts.slice(uploadIndex + 1);
                // If the next part is a version (e.g., v1234567890), skip it
                if (pathParts.length > 0 && pathParts[0].match(/^v\d+$/)) {
                    pathParts.shift();
                }
                // The remaining parts form the public_id (folder/image_name), remove extension
                if (pathParts.length > 0) {
                    publicIdForDeletion = pathParts.join('/').replace(/\.(jpg|jpeg|png|gif)$/i, '');
                }
            }

            if (publicIdForDeletion) {
                console.log(`Attempting to delete Cloudinary image with public_id: ${publicIdForDeletion} for user ${targetUser.username}`);
                const deletionResult = await cloudinary.uploader.destroy(publicIdForDeletion);
                console.log('Cloudinary deletion result:', deletionResult);
                if (deletionResult.result !== 'ok' && deletionResult.result !== 'not found') {
                    console.warn(`Cloudinary image deletion for public_id ${publicIdForDeletion} was not 'ok' or 'not found':`, deletionResult.result);
                }
            } else {
                console.warn(`Could not reliably extract public_id from URL: ${targetUser.profilePictureUrl} for user ${targetUser.username}. Image may not be deleted from Cloudinary.`);
            }
        } catch (cloudinaryError) {
            console.error(`Error deleting profile picture from Cloudinary for user ${targetUser._id}:`, cloudinaryError);
            // Continue with user deletion even if Cloudinary deletion fails, to not block the primary operation.
        }
    }
    // --- End Cloudinary Deletion Logic ---

    // --- Send email notification to the user ---
    try {
      await sendEmail({
        email: targetUser.email,
        subject: 'Account Removal Notification',
        html: `
          <p>Dear ${targetUser.username || 'User'},</p>
          <p>This email is to inform you that your account on our platform has been removed by a manager.</p>
          <p>If you believe this was done in error or have any questions, please contact our support team.</p>
          <p>Sincerely,</p>
          <p>The SoftSolution Administration</p>
        `,
      });
      console.log(`Account removal notification email sent to ${targetUser.email} for user ${targetUser.username || targetUser._id}`);
    } catch (emailError) {
      console.error(`Failed to send account removal notification email to ${targetUser.email} (User ID: ${targetUser._id}):`, emailError.message);
      // Do not block user deletion if email sending fails. Log the error and continue.
    }
    // --- End Email Notification Logic ---

    await User.findByIdAndDelete(targetUserId);
    res.json({ msg: `User account for '${targetUser.username || targetUser.email}' deleted successfully by manager. An email notification has been dispatched.` });

  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
        return res.status(404).json({ msg: 'User not found (invalid ID format).' });
    }
    res.status(500).send('Server Error');
  }
};