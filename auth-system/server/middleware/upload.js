const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp for better uniqueness
    const timestamp = Date.now();
    const uniqueName = `${timestamp}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Enhanced file filter with detailed validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  // Check MIME type
  if (!allowedTypes.includes(file.mimetype)) {
    const error = new Error('Invalid file type - please upload a JPG, PNG, or GIF image');
    error.code = 'INVALID_FILE_TYPE';
    error.details = {
      allowedTypes: ['JPG', 'PNG', 'GIF', 'WEBP'],
      detectedType: file.mimetype
    };
    return cb(error, false);
  }
  
  // Check file extension
  const fileExtension = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    const error = new Error('Invalid file extension - please use JPG, PNG, or GIF files');
    error.code = 'INVALID_FILE_EXTENSION';
    error.details = {
      allowedExtensions: allowedExtensions,
      detectedExtension: fileExtension
    };
    return cb(error, false);
  }
  
  // Check filename length
  if (file.originalname.length > 255) {
    const error = new Error('Filename too long - please use a shorter filename');
    error.code = 'FILENAME_TOO_LONG';
    error.details = {
      maxLength: 255,
      currentLength: file.originalname.length
    };
    return cb(error, false);
  }
  
  // Check for potentially dangerous filenames
  const dangerousPatterns = [/\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.scr$/i, /\.vbs$/i, /\.js$/i];
  if (dangerousPatterns.some(pattern => pattern.test(file.originalname))) {
    const error = new Error('Potentially dangerous file type detected');
    error.code = 'DANGEROUS_FILE_TYPE';
    return cb(error, false);
  }
  
  cb(null, true);
};

// Configure multer with enhanced limits and validation
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: 1, // Only allow 1 file at a time
    fieldNameSize: 100, // Limit field name size
    fieldSize: 1024 * 1024, // 1MB limit for field values
  },
  fileFilter: fileFilter
});

// Enhanced error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'File too large - please choose an image smaller than 5MB',
          code: 'FILE_TOO_LARGE',
          details: {
            maxSizeMB: 5,
            suggestion: 'Compress your image or choose a smaller file'
          }
        });
        
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field - please use the correct upload field',
          code: 'INVALID_FILE_FIELD',
          details: {
            expectedField: 'profilePicture',
            suggestion: 'Make sure you are using the correct file upload field'
          }
        });
        
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many files - please upload only one file at a time',
          code: 'TOO_MANY_FILES',
          details: {
            maxFiles: 1,
            suggestion: 'Select only one image file to upload'
          }
        });
        
      case 'LIMIT_FIELD_KEY':
        return res.status(400).json({
          success: false,
          error: 'Field name too long',
          code: 'FIELD_NAME_TOO_LONG'
        });
        
      case 'LIMIT_FIELD_VALUE':
        return res.status(400).json({
          success: false,
          error: 'Field value too large',
          code: 'FIELD_VALUE_TOO_LARGE'
        });
        
      case 'LIMIT_FIELD_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many fields',
          code: 'TOO_MANY_FIELDS'
        });
        
      default:
        return res.status(400).json({
          success: false,
          error: 'File upload error - please try again',
          code: 'UPLOAD_ERROR',
          details: {
            suggestion: 'Please check your file and try again'
          }
        });
    }
  } else if (error) {
    // Handle custom file filter errors
    if (error.code) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details || {
          suggestion: 'Please select a valid image file'
        }
      });
    }
    
    // Handle other errors
    return res.status(400).json({
      success: false,
      error: error.message || 'File upload failed',
      code: 'UPLOAD_FAILED',
      details: {
        suggestion: 'Please check your file and try again'
      }
    });
  }
  
  next();
};

// Middleware to validate file after upload
const validateUploadedFile = (req, res, next) => {
  if (!req.file) {
    return next();
  }
  
  try {
    // Additional validation can be added here
    // For example, checking file signature, scanning for malware, etc.
    
    // Check if file was actually written to disk
    if (!fs.existsSync(req.file.path)) {
      return res.status(500).json({
        success: false,
        error: 'File upload incomplete - please try again',
        code: 'UPLOAD_INCOMPLETE',
        details: {
          suggestion: 'Please check your internet connection and try again'
        }
      });
    }
    
    // Verify file size matches what was uploaded
    const stats = fs.statSync(req.file.path);
    if (stats.size !== req.file.size) {
      // Clean up incomplete file
      fs.unlinkSync(req.file.path);
      
      return res.status(500).json({
        success: false,
        error: 'File upload corrupted - please try again',
        code: 'UPLOAD_CORRUPTED',
        details: {
          suggestion: 'Please try uploading the file again'
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('File validation error:', error);
    
    // Clean up file if validation fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({
      success: false,
      error: 'File validation failed - please try again',
      code: 'VALIDATION_FAILED',
      details: {
        suggestion: 'Please try uploading a different file'
      }
    });
  }
};

module.exports = {
  upload,
  handleUploadError,
  validateUploadedFile
};