const path = require('path');
const fs = require('fs');

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

class UploadController {
  async uploadProfilePicture(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded - please select a file to upload',
          code: 'NO_FILE_UPLOADED',
          details: {
            suggestion: 'Please select an image file (JPG, PNG, or GIF) and try again'
          }
        });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        return res.status(400).json({
          success: false,
          error: 'Invalid file type - please upload a JPG, PNG, or GIF image',
          code: 'FILE_TYPE_NOT_SUPPORTED',
          details: {
            allowedTypes: ['JPG', 'PNG', 'GIF', 'WEBP'],
            detectedType: req.file.mimetype,
            suggestion: 'Please select a different image file'
          }
        });
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        return res.status(400).json({
          success: false,
          error: 'File too large - please choose an image smaller than 5MB',
          code: 'FILE_TOO_LARGE',
          details: {
            maxSize: maxSize,
            currentSize: req.file.size,
            maxSizeMB: 5,
            currentSizeMB: Math.round(req.file.size / (1024 * 1024) * 100) / 100,
            suggestion: 'Compress your image or choose a smaller file'
          }
        });
      }

      // Generate file URL
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

      res.json({
        success: true,
        message: 'Profile picture uploaded successfully',
        data: {
          url: fileUrl,
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype,
          sizeFormatted: formatFileSize(req.file.size)
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      
      // Clean up uploaded file if there was an error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      // Handle specific error types
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large - please choose an image smaller than 5MB',
          code: 'FILE_TOO_LARGE',
          details: {
            maxSizeMB: 5,
            suggestion: 'Compress your image or choose a smaller file'
          }
        });
      }

      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field - please use the correct upload field',
          code: 'INVALID_FILE_FIELD',
          details: {
            expectedField: 'profilePicture',
            suggestion: 'Make sure you are using the correct file upload field'
          }
        });
      }

      res.status(500).json({
        success: false,
        error: 'File upload failed - please try again',
        code: 'UPLOAD_FAILED',
        details: {
          suggestion: 'Please check your internet connection and try again'
        }
      });
    }
  }

  async deleteFile(req, res) {
    try {
      const { filename } = req.params;
      
      if (!filename) {
        return res.status(400).json({
          success: false,
          error: 'Filename is required - please specify which file to delete',
          code: 'MISSING_FILENAME',
          details: {
            suggestion: 'Please provide a valid filename'
          }
        });
      }

      // Validate filename format (security check)
      const filenameRegex = /^[a-zA-Z0-9._-]+$/;
      if (!filenameRegex.test(filename)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid filename format - filename contains invalid characters',
          code: 'INVALID_FILENAME',
          details: {
            suggestion: 'Filename can only contain letters, numbers, dots, hyphens, and underscores'
          }
        });
      }

      const filePath = path.join(process.env.UPLOAD_DIR || './uploads', filename);
      
      // Security check: ensure file is within upload directory
      const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
      const resolvedFilePath = path.resolve(filePath);
      if (!resolvedFilePath.startsWith(uploadDir)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file path - access denied',
          code: 'INVALID_FILE_PATH',
          details: {
            suggestion: 'Please provide a valid filename within the uploads directory'
          }
        });
      }
      
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          
          res.json({
            success: true,
            message: 'File deleted successfully',
            data: {
              filename: filename,
              deletedAt: new Date().toISOString()
            }
          });
        } catch (deleteError) {
          console.error('File deletion error:', deleteError);
          
          return res.status(500).json({
            success: false,
            error: 'Failed to delete file - please try again',
            code: 'DELETE_FAILED',
            details: {
              filename: filename,
              suggestion: 'Please check file permissions and try again'
            }
          });
        }
      } else {
        res.status(404).json({
          success: false,
          error: 'File not found - the specified file does not exist',
          code: 'FILE_NOT_FOUND',
          details: {
            filename: filename,
            suggestion: 'Please check the filename and try again'
          }
        });
      }
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({
        success: false,
        error: 'File deletion failed - an unexpected error occurred',
        code: 'DELETE_OPERATION_FAILED',
        details: {
          suggestion: 'Please try again or contact support if the problem persists'
        }
      });
    }
  }
}

module.exports = new UploadController();