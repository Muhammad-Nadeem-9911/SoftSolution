const User = require('../models/User'); // Adjust path to your User model
const bcrypt = require('bcryptjs');
// const fs = require('fs'); // No longer needed for deleting local files here
// const path = require('path'); // No longer needed for constructing local paths here
// const { validationResult } = require('express-validator'); // Optional: for input validation
const sendEmail = require('../utils/sendEmail'); // For sending emails
const cloudinary = require('../config/cloudinary'); // Import configured Cloudinary instance

// --- Update Email ---
exports.updateEmail = async (req, res) => {
    const { email } = req.body;
    const userId = req.user.id; // Get user ID from auth middleware

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        // Optional: Check if email is already taken by ANOTHER user
        // Use lowercase email for the check to ensure case-insensitivity
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser && existingUser._id.toString() !== userId) {
            return res.status(400).json({ message: 'Email already in use by another account' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.email = email;
        await user.save();

        // Send back confirmation and the updated email (frontend uses this)
        res.json({ message: 'Email updated successfully', email: user.email });

    } catch (err) {
        console.error("Error updating email:", err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Delete user's own account
// @route   DELETE /api/users/account
// @access  Private
exports.deleteMyAccount = async (req, res) => {
    const userId = req.user.id; // Get user ID from auth middleware

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // --- Delete profile picture from Cloudinary if it exists ---
        if (user.profilePictureUrl && user.profilePictureUrl.includes('cloudinary.com')) {
            try {
                let publicIdForDeletion = null;
                const urlParts = user.profilePictureUrl.split('/');
                const uploadIndex = urlParts.indexOf('upload');

                if (uploadIndex !== -1 && uploadIndex + 1 < urlParts.length) {
                    let pathParts = urlParts.slice(uploadIndex + 1);
                    if (pathParts.length > 0 && pathParts[0].match(/^v\d+$/)) {
                        pathParts.shift(); // Skip version part like v1234567890
                    }
                    if (pathParts.length > 0) {
                        publicIdForDeletion = pathParts.join('/').replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
                    }
                }

                if (publicIdForDeletion) {
                    console.log(`[Delete Account] Attempting to delete Cloudinary image with public_id: ${publicIdForDeletion} for user ${user.username}`);
                    const deletionResult = await cloudinary.uploader.destroy(publicIdForDeletion);
                    console.log('[Delete Account] Cloudinary deletion result:', deletionResult);
                    if (deletionResult.result !== 'ok' && deletionResult.result !== 'not found') {
                        console.warn(`[Delete Account] Cloudinary image deletion for public_id ${publicIdForDeletion} was not 'ok' or 'not found':`, deletionResult.result);
                    }
                } else {
                    console.warn(`[Delete Account] Could not reliably extract public_id from URL: ${user.profilePictureUrl} for user ${user.username}. Image may not be deleted from Cloudinary.`);
                }
            } catch (cloudinaryError) {
                console.error(`[Delete Account] Error deleting profile picture from Cloudinary for user ${user._id}:`, cloudinaryError);
                // Continue with account deletion even if Cloudinary deletion fails.
            }
        }
        // --- End Cloudinary Deletion Logic ---

        // Delete the user from the database
        await User.findByIdAndDelete(userId);

        // --- Send email notification to the user ---
        try {
            await sendEmail({
                email: user.email,
                subject: 'Your Account Has Been Deleted',
                html: `
                    <p>Dear ${user.username || 'User'},</p>
                    <p>This email is to confirm that your account on SoftSolution has been successfully deleted as per your request.</p>
                    <p>All your data associated with this account has been removed.</p>
                    <p>If you did not initiate this action, please contact our support team immediately.</p>
                    <p>Sincerely,</p>
                    <p>The SoftSolution Team</p>
                `,
            });
            console.log(`[Delete Account] Account deletion confirmation email sent to ${user.email}`);
        } catch (emailError) {
            console.error(`[Delete Account] Failed to send account deletion confirmation email to ${user.email}:`, emailError.message);
            // Do not block the response if email sending fails.
        }
        // --- End Email Notification Logic ---

        res.json({ message: 'Your account has been successfully deleted. We have sent a confirmation to your email address.' });
    } catch (err) {
        console.error("Error deleting user account:", err.message);
        res.status(500).send('Server Error');
    }
};

// --- Update Password ---
exports.updatePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Basic validation
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Please provide both current and new passwords' });
    }
    if (newPassword.length < 6) { // Example minimum length
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    try {
        // Find user but include password field for comparison
        const user = await User.findById(userId).select('+password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if current password matches the one in the DB
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password' });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        await user.save();

        res.json({ message: 'Password updated successfully' });

    } catch (err) {
        console.error("Error updating password:", err.message);
        res.status(500).send('Server Error');
    }
};

// --- Update Profile Picture ---
exports.updateProfilePicture = async (req, res) => {
    const userId = req.user.id;

    // 1. Check if a file was uploaded by multer (using memoryStorage)
    if (!req.file) {
        return res.status(400).json({ message: 'No profile picture file uploaded' });
    }

    try {
        // 2. Find the user (optional, but good practice to ensure user exists)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Store the old image URL before updating
        const oldImageUrl = user.profilePictureUrl;


        // --- (Removed) Logic for constructing local URL ---

        // --- (Removed) Logic for deleting old local file ---
        // Cloudinary manages its own files. If you need to delete old Cloudinary files,
        // you'd extract the public_id from the old user.profilePictureUrl and use
        // cloudinary.uploader.destroy(public_id), but we'll skip that for simplicity now.

        // 3. Upload the image buffer to Cloudinary
        // Convert buffer to data URI format
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        // Use Cloudinary uploader
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: "zoom_clone_profiles", // Optional: Cloudinary folder
          resource_type: "auto"
        });

        // 4. Get the secure URL from Cloudinary response
        const imageUrl = result.secure_url;
        if (!imageUrl) {
          console.error('Cloudinary upload succeeded but no URL was returned.', result);
          return res.status(500).json({ message: 'Image upload failed after processing.' });
        }

        // 5. Update the user's record in the database with the Cloudinary URL
        // Note: Ensure your User model has a field named 'profilePictureUrl' or adjust accordingly
        user.profilePictureUrl = imageUrl;
        await user.save();
        console.log('[Profile Update] User record updated with new image URL.');

        // 6. Send success response with the new Cloudinary URL
        res.json({ message: 'Profile picture updated successfully', profilePictureUrl: user.profilePictureUrl });

        // 7. Attempt to delete the OLD image from Cloudinary (after success response)
        if (oldImageUrl && oldImageUrl.includes('cloudinary.com')) {
            try {
                // Attempt to extract public_id from the old URL
                // This parsing assumes a standard Cloudinary URL structure like:
                // https://res.cloudinary.com/<cloud_name>/<resource_type>/<delivery_type>/<version>/<public_id>.<format>
                // Or potentially includes folders: .../<version>/<folder>/<public_id>.<format>
                // We need the part after the version number (or /upload/) up to the extension.
                const urlParts = oldImageUrl.split('/');
                const publicIdWithExtension = urlParts.slice(urlParts.findIndex(part => part === 'upload') + 2).join('/'); // Get path after version
                const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.')); // Remove extension

                if (publicId) {
                    await cloudinary.uploader.destroy(publicId);
                    console.log(`[Profile Update] Successfully deleted old Cloudinary image: ${publicId}`);
                }
            } catch (deleteErr) {
                console.error(`[Profile Update] Failed to delete old Cloudinary image (${oldImageUrl}):`, deleteErr);
                // Log the error, but don't fail the overall request since the upload was successful.
            }
        }
    } catch (err) {
        console.error("Error updating profile picture:", err.message);
        // Add check for multer file type error
        if (err.message.includes('Invalid file type')) {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).send('Server Error');
    }
};