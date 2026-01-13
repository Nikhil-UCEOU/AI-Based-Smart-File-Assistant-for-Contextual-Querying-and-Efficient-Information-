const User = require('../models/User');
const activityService = require('../services/activityService');
const path = require('path');
const fs = require('fs').promises;

class ProfileController {
  async getProfile(req, res) {
    try {
      // req.user is already the full User object from auth middleware
      const user = req.user;
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Remove sensitive information and return user profile
      const userProfile = user.toJSON();

      res.json({
        success: true,
        data: userProfile
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch profile'
      });
    }
  }

  async updateProfile(req, res) {
    try {
      const { firstName, lastName, email, displayName, bio, timezone } = req.body;
      const user = req.user; // Get the user object directly from auth middleware

      // Validate required fields
      if (firstName !== undefined && (!firstName || firstName.trim().length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'First name is required'
        });
      }

      if (lastName !== undefined && (!lastName || lastName.trim().length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'Last name is required'
        });
      }

      // Validate email format if provided
      if (email !== undefined) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            error: 'Please enter a valid email address'
          });
        }

        // Check if email is already taken by another user
        const existingUser = await User.findByEmail(email);
        if (existingUser && existingUser.id !== user.id) {
          return res.status(400).json({
            success: false,
            error: 'Email address is already in use'
          });
        }
      }

      // Validate field lengths
      if (displayName && displayName.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Display name must be 50 characters or less'
        });
      }

      if (bio && bio.length > 500) {
        return res.status(400).json({
          success: false,
          error: 'Bio must be 500 characters or less'
        });
      }

      // Prepare update data
      const updateData = {};
      if (firstName !== undefined) updateData.firstName = firstName.trim();
      if (lastName !== undefined) updateData.lastName = lastName.trim();
      if (email !== undefined) updateData.email = email.trim();
      if (displayName !== undefined) updateData.displayName = displayName.trim();
      if (bio !== undefined) updateData.bio = bio.trim();
      if (timezone !== undefined) updateData.timezone = timezone;

      // Update user directly using the user object
      const updatedUser = await user.updateProfile(updateData);

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          error: 'Failed to update user profile'
        });
      }

      // Return updated user profile
      const userProfile = updatedUser.toJSON();

      // Log the profile update for audit purposes
      console.log(`Profile updated for user ${user.pineconeId}:`, Object.keys(updateData));

      res.json({
        success: true,
        data: {
          user: userProfile,
          message: 'Profile updated successfully'
        }
      });

      // Log activity after successful profile update
      try {
        await activityService.logProfileUpdate(
          updatedUser.id, // Use database ID for activity logging
          updateData
        );
      } catch (activityError) {
        console.error('Failed to log profile update activity:', activityError);
        // Don't fail the request if activity logging fails
      }
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  }

  async uploadProfilePicture(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const user = req.user; // Get user directly from auth middleware
      const file = req.file;

      // Delete old profile picture if it exists
      if (user.profilePicture) {
        const oldPicturePath = path.join(__dirname, '../uploads/profiles', path.basename(user.profilePicture));
        await fs.unlink(oldPicturePath).catch(console.error);
      }

      // Generate URL for the new profile picture
      const profilePictureUrl = `/uploads/profiles/${file.filename}`;

      // Update user with new profile picture URL
      const updatedUser = await user.updateProfile({
        profilePicture: profilePictureUrl
      });

      if (!updatedUser) {
        // Clean up uploaded file if update failed
        await fs.unlink(file.path).catch(console.error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update user profile'
        });
      }

      // Log the profile picture upload for audit purposes
      console.log(`Profile picture uploaded for user ${user.pineconeId}: ${file.filename}`);

      res.json({
        success: true,
        data: {
          profilePictureUrl: profilePictureUrl,
          message: 'Profile picture uploaded successfully'
        }
      });
    } catch (error) {
      console.error('Upload profile picture error:', error);
      
      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }

      res.status(500).json({
        success: false,
        error: 'Failed to upload profile picture'
      });
    }
  }

  async removeProfilePicture(req, res) {
    try {
      const user = req.user; // Get user directly from auth middleware

      if (!user.profilePicture) {
        return res.status(400).json({
          success: false,
          error: 'No profile picture to remove'
        });
      }

      // Delete the profile picture file
      const picturePath = path.join(__dirname, '../uploads/profiles', path.basename(user.profilePicture));
      await fs.unlink(picturePath).catch(console.error);

      // Update user to remove profile picture URL
      const updatedUser = await user.updateProfile({
        profilePicture: null
      });

      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          error: 'Failed to update user profile'
        });
      }

      // Log the profile picture removal for audit purposes
      console.log(`Profile picture removed for user ${user.pineconeId}`);

      res.json({
        success: true,
        data: {
          message: 'Profile picture removed successfully'
        }
      });
    } catch (error) {
      console.error('Remove profile picture error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove profile picture'
      });
    }
  }
}

module.exports = new ProfileController();