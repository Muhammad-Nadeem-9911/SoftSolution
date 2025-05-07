const multer = require('multer');
// const path = require('path'); // No longer needed for storage paths
// const fs = require('fs'); // No longer needed for creating directories

// --- REMOVE or COMMENT OUT diskStorage ---
/*
const storage = multer.diskStorage({ ... }); // Remove the diskStorage configuration
*/

// --- ADD memoryStorage ---
// Store the file in memory as a buffer
const storage = multer.memoryStorage();

// File filter function (optional but recommended for security)
const fileFilter = (req, file, cb) => {
    // Accept only image files (jpeg, png, gif, webp, etc.)
    if (file.mimetype.startsWith('image/')) {
        cb(null, true); // Accept the file
    } else {
        cb(new Error('Invalid file type. Only images are allowed.'), false); // Reject the file
    }
};

// Configure multer with storage, limits, and filter
const upload = multer({
    storage: storage, // Use memoryStorage now
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB file size limit
    fileFilter: fileFilter
});

module.exports = upload;