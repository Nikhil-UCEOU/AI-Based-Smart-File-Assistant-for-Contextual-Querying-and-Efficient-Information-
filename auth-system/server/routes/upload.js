const express = require('express');
const uploadController = require('../controllers/uploadController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { upload, handleUploadError, validateUploadedFile } = require('../middleware/upload');

const router = express.Router();

// Upload profile picture (can be used with or without authentication)
router.post('/profile-picture', 
  optionalAuth,
  upload.single('profilePicture'),
  handleUploadError,
  validateUploadedFile,
  uploadController.uploadProfilePicture
);

// Delete uploaded file (requires authentication)
router.delete('/file/:filename', 
  authenticateToken,
  uploadController.deleteFile
);

module.exports = router;