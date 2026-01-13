const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');

const router = express.Router();

// Public routes with validation
router.post('/signup', 
  ValidationMiddleware.validateSignup,
  authController.signup
);

router.post('/login', 
  ValidationMiddleware.validateLogin,
  authController.login
);

router.post('/refresh', 
  ValidationMiddleware.validateRefreshToken,
  authController.refreshToken
);

// Protected routes
router.post('/logout', optionalAuth, authController.logout);
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/users/:userId/profile-picture', authController.updateProfilePicture);

// Password reset routes
router.post('/forgot-password', 
  ValidationMiddleware.validatePasswordResetRequest,
  authController.requestPasswordReset
);

router.get('/reset-password/:token', 
  authController.verifyResetToken
);

router.post('/reset-password', 
  ValidationMiddleware.validatePasswordReset,
  authController.resetPassword
);

module.exports = router;