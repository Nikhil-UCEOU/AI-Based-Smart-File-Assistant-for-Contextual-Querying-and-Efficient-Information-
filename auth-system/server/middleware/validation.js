/**
 * Server-side validation middleware with enhanced error messages
 */

const { isValidEmail, normalizeEmail, isDisposableEmail } = require('../utils/emailUtils');

class ValidationMiddleware {
  /**
   * Validate signup request data
   */
  static validateSignup(req, res, next) {
    const { firstName, lastName, email, password, profilePictureUrl } = req.body;
    const errors = [];

    // Check for missing fields
    if (!firstName || firstName.trim().length === 0) {
      errors.push({
        field: 'firstName',
        code: 'MISSING_FIRST_NAME',
        message: 'First name is required - please enter your first name'
      });
    }

    if (!lastName || lastName.trim().length === 0) {
      errors.push({
        field: 'lastName',
        code: 'MISSING_LAST_NAME',
        message: 'Last name is required - please enter your last name'
      });
    }

    if (!email || email.trim().length === 0) {
      errors.push({
        field: 'email',
        code: 'MISSING_EMAIL',
        message: 'Email address is required - please enter your email'
      });
    }

    if (!password || password.length === 0) {
      errors.push({
        field: 'password',
        code: 'MISSING_PASSWORD',
        message: 'Password is required - please create a secure password'
      });
    }

    // If we have missing fields, return early
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields - please fill in all required information',
        code: 'MISSING_REQUIRED_FIELDS',
        details: {
          errors,
          missingFields: errors.map(e => e.field)
        }
      });
    }

    // Validate field formats and constraints
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const normalizedEmail = normalizeEmail(email);

    // Name length validation
    if (trimmedFirstName.length < 2) {
      errors.push({
        field: 'firstName',
        code: 'NAME_TOO_SHORT',
        message: 'First name too short - please enter at least 2 characters'
      });
    }

    if (trimmedLastName.length < 2) {
      errors.push({
        field: 'lastName',
        code: 'NAME_TOO_SHORT',
        message: 'Last name too short - please enter at least 2 characters'
      });
    }

    // Name character validation
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(trimmedFirstName)) {
      errors.push({
        field: 'firstName',
        code: 'INVALID_NAME_CHARACTERS',
        message: 'First name contains invalid characters - please use only letters, spaces, hyphens, and apostrophes'
      });
    }

    if (!nameRegex.test(trimmedLastName)) {
      errors.push({
        field: 'lastName',
        code: 'INVALID_NAME_CHARACTERS',
        message: 'Last name contains invalid characters - please use only letters, spaces, hyphens, and apostrophes'
      });
    }

    // Email validation
    if (!isValidEmail(normalizedEmail)) {
      errors.push({
        field: 'email',
        code: 'INVALID_EMAIL_FORMAT',
        message: 'Invalid email format - please enter a valid email address (example: user@domain.com)'
      });
    } else if (isDisposableEmail(normalizedEmail)) {
      errors.push({
        field: 'email',
        code: 'DISPOSABLE_EMAIL_NOT_ALLOWED',
        message: 'Temporary email not allowed - please use a permanent email address from a standard email provider'
      });
    }

    // Password validation
    if (password.length < 8) {
      errors.push({
        field: 'password',
        code: 'PASSWORD_TOO_SHORT',
        message: 'Password too short - please create a password with at least 8 characters',
        details: {
          minLength: 8,
          currentLength: password.length
        }
      });
    }

    // Password strength validation
    const passwordStrength = ValidationMiddleware.analyzePasswordStrength(password);
    if (passwordStrength.score < 2) {
      errors.push({
        field: 'password',
        code: 'PASSWORD_TOO_WEAK',
        message: 'Password needs improvement - please include a mix of letters, numbers, and special characters for better security',
        details: {
          suggestions: passwordStrength.suggestions
        }
      });
    }

    // Validate profile picture URL if provided
    if (profilePictureUrl && typeof profilePictureUrl === 'string') {
      try {
        new URL(profilePictureUrl);
      } catch (urlError) {
        errors.push({
          field: 'profilePictureUrl',
          code: 'INVALID_PROFILE_PICTURE_URL',
          message: 'Invalid profile picture URL format'
        });
      }
    }

    // If we have validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed - please correct the highlighted fields',
        code: 'VALIDATION_FAILED',
        details: {
          errors
        }
      });
    }

    // Store normalized values for use in controller
    req.validatedData = {
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      email: normalizedEmail,
      password,
      profilePictureUrl: profilePictureUrl || null
    };

    next();
  }

  /**
   * Validate login request data
   */
  static validateLogin(req, res, next) {
    const { email, password } = req.body;
    const errors = [];

    // Check for missing fields
    if (!email || email.trim().length === 0) {
      errors.push({
        field: 'email',
        code: 'MISSING_EMAIL',
        message: 'Email address is required - please enter your email'
      });
    }

    if (!password || password.length === 0) {
      errors.push({
        field: 'password',
        code: 'MISSING_PASSWORD',
        message: 'Password is required - please enter your password'
      });
    }

    // If we have missing fields, return early
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields - email and password are required',
        code: 'MISSING_REQUIRED_FIELDS',
        details: {
          errors,
          missingFields: errors.map(e => e.field)
        }
      });
    }

    // Validate email format
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format - please enter a valid email address',
        code: 'INVALID_EMAIL_FORMAT',
        details: {
          field: 'email',
          suggestion: 'Please check your email format and try again'
        }
      });
    }

    // Store normalized values for use in controller
    req.validatedData = {
      email: normalizedEmail,
      password
    };

    next();
  }

  /**
   * Validate refresh token request
   */
  static validateRefreshToken(req, res, next) {
    const { refreshToken } = req.body;

    if (!refreshToken || refreshToken.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required - please provide a valid refresh token',
        code: 'MISSING_REFRESH_TOKEN',
        details: {
          suggestion: 'Please sign in again to get a new refresh token'
        }
      });
    }

    next();
  }

  /**
   * Analyze password strength
   */
  static analyzePasswordStrength(password) {
    let score = 0;
    const suggestions = [];

    // Length check
    if (password.length >= 8) score++;
    else suggestions.push('Use at least 8 characters');

    // Character variety checks
    if (/[a-z]/.test(password)) score++;
    else suggestions.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) score++;
    else suggestions.push('Include uppercase letters');

    if (/[0-9]/.test(password)) score++;
    else suggestions.push('Include numbers');

    if (/[^a-zA-Z0-9]/.test(password)) score++;
    else suggestions.push('Include special characters');

    // Common password check
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      score = Math.max(0, score - 2);
      suggestions.push('Avoid common passwords');
    }

    return {
      score,
      suggestions,
      strength: score <= 1 ? 'weak' : score <= 3 ? 'medium' : 'strong'
    };
  }

  /**
   * Validate file upload parameters
   */
  static validateFileUpload(req, res, next) {
    // This validation is primarily handled by multer middleware
    // But we can add additional business logic validation here
    
    if (req.file) {
      // Additional file validation can be added here
      // For example, checking file content, scanning for malware, etc.
    }

    next();
  }

  /**
   * Generic validation error handler
   */
  static handleValidationError(error, req, res, next) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        code: 'VALIDATION_ERROR'
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed - please correct the highlighted fields',
        code: 'VALIDATION_FAILED',
        details: {
          errors
        }
      });
    }

    next(error);
  }

  /**
   * Validate password reset request
   */
  static validatePasswordResetRequest(req, res, next) {
    const { email } = req.body;

    const errors = [];

    // Email validation
    if (!email) {
      errors.push({
        field: 'email',
        message: 'Email is required',
        code: 'FIELD_REQUIRED'
      });
    } else if (!isValidEmail(email)) {
      errors.push({
        field: 'email',
        message: 'Please enter a valid email address',
        code: 'INVALID_EMAIL_FORMAT'
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Please check your email address and try again',
        code: 'VALIDATION_FAILED',
        details: errors
      });
    }

    // Normalize email
    req.validatedData = {
      email: normalizeEmail(email)
    };

    next();
  }

  /**
   * Validate password reset
   */
  static validatePasswordReset(req, res, next) {
    const { token, newPassword } = req.body;

    const errors = [];

    // Token validation
    if (!token) {
      errors.push({
        field: 'token',
        message: 'Reset token is required',
        code: 'FIELD_REQUIRED'
      });
    }

    // Password validation
    if (!newPassword) {
      errors.push({
        field: 'newPassword',
        message: 'New password is required',
        code: 'FIELD_REQUIRED'
      });
    } else {
      const passwordValidation = ValidationMiddleware.analyzePasswordStrength(newPassword);
      if (passwordValidation.score < 3) {
        errors.push({
          field: 'newPassword',
          message: 'Password is too weak. Please choose a stronger password.',
          code: 'WEAK_PASSWORD',
          details: passwordValidation
        });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Please check your input and try again',
        code: 'VALIDATION_FAILED',
        details: errors
      });
    }

    req.validatedData = {
      token,
      newPassword
    };

    next();
  }
}

module.exports = ValidationMiddleware;