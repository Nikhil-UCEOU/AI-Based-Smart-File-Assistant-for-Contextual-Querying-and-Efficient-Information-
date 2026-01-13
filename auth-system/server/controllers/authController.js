const User = require('../models/User');
const Session = require('../models/Session');
const PasswordResetToken = require('../models/PasswordResetToken');
const { generateTokens, verifyRefreshToken, getTokenExpiration } = require('../utils/jwt');
const { normalizeEmail, isValidEmail, isDisposableEmail } = require('../utils/emailUtils');
const nodemailer = require('nodemailer');

// Email sending function
async function sendPasswordResetEmail(userEmail, userName, resetToken) {
  const resetUrl = `${process.env.RESET_URL_BASE}?token=${resetToken}`;
  
  console.log(`📧 Attempting to send password reset email to ${userEmail}...`);
  
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: userEmail,
      subject: 'Password Reset Request - Auth System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4f46e5; font-size: 24px;">🔐 Auth System</h1>
              <h2 style="color: #1f2937; font-size: 20px;">Password Reset Request</h2>
            </div>
            
            <p>Hello ${userName},</p>
            
            <p>We received a request to reset your password. Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Reset Your Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; font-family: monospace; word-break: break-all;">${resetUrl}</p>
            
            <div style="background: #fef3cd; border: 1px solid #fbbf24; border-radius: 6px; padding: 15px; margin: 20px 0; color: #92400e;">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>This link will expire in 1 hour</li>
                <li>If you didn't request this, ignore this email</li>
                <li>Never share this link with anyone</li>
              </ul>
            </div>
            
            <p>Best regards,<br>The Auth System Team</p>
          </div>
        </div>
      `,
      text: `
Hello ${userName},

We received a request to reset your password for your Auth System account.

To reset your password, please visit the following link:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email.

Best regards,
The Auth System Team
      `.trim(),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent successfully!');
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log(`📧 Sent to: ${userEmail}`);
    return info;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error.message);
    
    // Fallback: Log the reset token
    console.log('📝 Email failed - logging reset token:');
    console.log('=== PASSWORD RESET TOKEN ===');
    console.log(`Email: ${userEmail}`);
    console.log(`Name: ${userName}`);
    console.log(`Reset Token: ${resetToken}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('============================');
    
    return { messageId: 'email-failed-logged' };
  }
}

class AuthController {
  async signup(req, res) {
    try {
      // Use validated data from middleware
      const { firstName, lastName, email, password, profilePictureUrl } = req.validatedData || req.body;

      // Check for existing user before attempting to create
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email address already exists. Please use a different email or try logging in.',
          code: 'EMAIL_ALREADY_EXISTS',
          details: {
            field: 'email',
            suggestion: 'Try signing in instead or use a different email address'
          }
        });
      }

      // Create user with profile picture URL if provided
      const user = await User.create({
        firstName,
        lastName,
        email,
        password,
        profilePicture: profilePictureUrl
      });

      res.status(201).json({
        success: true,
        message: 'Account created successfully - welcome! You can now sign in with your credentials',
        data: {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userIndex: user.userIndex,
          profilePictureUrl: user.profilePicture
        }
      });
    } catch (error) {
      console.error('Signup error:', error);
      
      // Handle different types of duplicate errors
      if (error.message === 'Email already exists' || 
          (error.code === 'SQLITE_CONSTRAINT_UNIQUE' && error.message.includes('email'))) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email address already exists. Please use a different email or try logging in.',
          code: 'EMAIL_ALREADY_EXISTS',
          details: {
            field: 'email',
            suggestion: 'Try signing in instead or use a different email address'
          }
        });
      }

      res.status(500).json({
        success: false,
        error: 'Account creation failed - please try again',
        code: 'SIGNUP_FAILED',
        details: {
          suggestion: 'Please check your information and try again'
        }
      });
    }
  }

  async login(req, res) {
    try {
      // Use validated data from middleware
      const { email, password } = req.validatedData || req.body;

      // Find user with enhanced error handling
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Account not found - no account exists with these credentials. Please check your email and password or create a new account',
          code: 'ACCOUNT_NOT_FOUND',
          details: {
            field: 'email',
            suggestion: 'Double-check your email address or create a new account'
          }
        });
      }

      // Validate password with enhanced error handling
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Incorrect password - please check your password and try again. If you forgot your password, use the reset option',
          code: 'INCORRECT_PASSWORD',
          details: {
            field: 'password',
            suggestion: 'Try again or reset your password if you forgot it'
          }
        });
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user.id);
      const refreshTokenExpiry = getTokenExpiration(refreshToken);

      // Store refresh token in database
      await Session.create(user.id, refreshToken, refreshTokenExpiry);

      res.json({
        success: true,
        message: 'Welcome back - you\'re now signed in to your account',
        data: {
          user: user.toJSON(),
          tokens: {
            accessToken,
            refreshToken,
            expiresAt: getTokenExpiration(accessToken)
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Sign in failed - please try again',
        code: 'LOGIN_FAILED',
        details: {
          suggestion: 'Please check your connection and try again'
        }
      });
    }
  }

  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);
      
      // Check if session exists and is valid
      const session = await Session.findByRefreshToken(refreshToken);
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token - please sign in again',
          code: 'INVALID_REFRESH_TOKEN',
          details: {
            suggestion: 'Please sign in again to get a new session'
          }
        });
      }

      // Get user
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found - please sign in again',
          code: 'USER_NOT_FOUND',
          details: {
            suggestion: 'Please create a new account or sign in with valid credentials'
          }
        });
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);
      const newRefreshTokenExpiry = getTokenExpiration(newRefreshToken);

      // Delete old session and create new one
      await session.delete();
      await Session.create(user.id, newRefreshToken, newRefreshTokenExpiry);

      res.json({
        success: true,
        message: 'Session refreshed successfully',
        data: {
          user: user.toJSON(),
          tokens: {
            accessToken,
            refreshToken: newRefreshToken,
            expiresAt: getTokenExpiration(accessToken)
          }
        }
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired refresh token - please sign in again',
          code: 'INVALID_REFRESH_TOKEN',
          details: {
            suggestion: 'Please sign in again to get a new session'
          }
        });
      }

      res.status(500).json({
        success: false,
        error: 'Session refresh failed - please sign in again',
        code: 'REFRESH_FAILED',
        details: {
          suggestion: 'Please sign in again to continue'
        }
      });
    }
  }

  async logout(req, res) {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        // Delete specific session
        await Session.deleteByRefreshToken(refreshToken);
      } else if (req.user) {
        // Delete all sessions for user
        await Session.deleteByUserId(req.user.id);
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getProfile(req, res) {
    try {
      res.json({
        success: true,
        data: {
          user: req.user.toJSON()
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateProfilePicture(req, res) {
    try {
      const { profilePictureUrl } = req.body;
      const userId = req.params.userId;

      if (!profilePictureUrl) {
        return res.status(400).json({
          success: false,
          error: 'Profile picture URL is required'
        });
      }

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Update profile picture
      await user.updateProfilePicture(profilePictureUrl);

      res.json({
        success: true,
        message: 'Profile picture updated successfully'
      });
    } catch (error) {
      console.error('Update profile picture error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async requestPasswordReset(req, res) {
    try {
      const { email } = req.validatedData || req.body;

      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        // For security, don't reveal if email exists or not
        return res.json({
          success: true,
          message: 'If an account with this email exists, you will receive a password reset link shortly.'
        });
      }

      // Delete any existing reset tokens for this user
      await PasswordResetToken.deleteByUserId(user.id);

      // Create new reset token
      const resetToken = await PasswordResetToken.create(user.id, 1); // 1 hour expiry

      // Send password reset email
      await sendPasswordResetEmail(
        user.email,
        user.firstName,
        resetToken.token
      );

      res.json({
        success: true,
        message: 'If an account with this email exists, you will receive a password reset link shortly.'
      });
    } catch (error) {
      console.error('Request password reset error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process password reset request. Please try again.',
        code: 'PASSWORD_RESET_REQUEST_FAILED'
      });
    }
  }

  async verifyResetToken(req, res) {
    try {
      const { token } = req.params;

      // Find and validate reset token
      const resetToken = await PasswordResetToken.findByToken(token);
      if (!resetToken || !resetToken.isValid()) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token. Please request a new password reset.',
          code: 'INVALID_RESET_TOKEN'
        });
      }

      // Get user information
      const user = await User.findById(resetToken.userId);
      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'User not found. Please request a new password reset.',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        message: 'Reset token is valid',
        data: {
          email: user.email,
          firstName: user.firstName
        }
      });
    } catch (error) {
      console.error('Verify reset token error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify reset token. Please try again.',
        code: 'TOKEN_VERIFICATION_FAILED'
      });
    }
  }

  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.validatedData || req.body;

      // Find and validate reset token
      const resetToken = await PasswordResetToken.findByToken(token);
      if (!resetToken || !resetToken.isValid()) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token. Please request a new password reset.',
          code: 'INVALID_RESET_TOKEN'
        });
      }

      // Get user
      const user = await User.findById(resetToken.userId);
      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'User not found. Please request a new password reset.',
          code: 'USER_NOT_FOUND'
        });
      }

      // Update user password
      await user.updatePassword(newPassword);

      // Mark reset token as used
      await resetToken.markAsUsed();

      // Delete all sessions for this user (force re-login)
      await Session.deleteByUserId(user.id);

      res.json({
        success: true,
        message: 'Password reset successfully. Please sign in with your new password.'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset password. Please try again.',
        code: 'PASSWORD_RESET_FAILED'
      });
    }
  }
}

module.exports = new AuthController();