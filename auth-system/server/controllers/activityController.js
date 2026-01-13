const Activity = require('../models/Activity');

class ActivityController {
  // Get user activities with pagination
  async getUserActivities(req, res) {
    try {
      const userId = req.user.databaseId; // Use database ID for queries
      const { limit = 10, offset = 0, days = 7 } = req.query;

      // Get recent activities
      const activities = await Activity.getRecentActivities(
        userId, 
        parseInt(days), 
        parseInt(limit)
      );

      // Get total count for pagination
      const totalCount = await Activity.getUserActivityCount(userId);

      res.json({
        success: true,
        data: {
          activities: activities.map(activity => activity.toJSON()),
          pagination: {
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
          }
        }
      });
    } catch (error) {
      console.error('Get user activities error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch activities'
      });
    }
  }

  // Get activity statistics
  async getActivityStats(req, res) {
    try {
      const userId = req.user.databaseId;
      const { days = 30 } = req.query;

      const stats = await Activity.getActivityStats(userId, parseInt(days));

      // Process stats into a more useful format
      const processedStats = {
        totalActivities: stats.reduce((sum, stat) => sum + stat.count, 0),
        byType: {},
        byDate: {}
      };

      stats.forEach(stat => {
        // Group by type
        if (!processedStats.byType[stat.type]) {
          processedStats.byType[stat.type] = 0;
        }
        processedStats.byType[stat.type] += stat.count;

        // Group by date
        if (!processedStats.byDate[stat.date]) {
          processedStats.byDate[stat.date] = 0;
        }
        processedStats.byDate[stat.date] += stat.count;
      });

      res.json({
        success: true,
        data: {
          stats: processedStats,
          period: `${days} days`
        }
      });
    } catch (error) {
      console.error('Get activity stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch activity statistics'
      });
    }
  }

  // Create new activity (for manual logging)
  async createActivity(req, res) {
    try {
      const userId = req.user.databaseId;
      const { type, description, metadata } = req.body;

      // Validate required fields
      if (!type || !description) {
        return res.status(400).json({
          success: false,
          error: 'Type and description are required'
        });
      }

      // Validate activity type
      const validTypes = ['upload', 'search', 'chat', 'delete', 'profile', 'login', 'logout'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid activity type'
        });
      }

      const activity = await Activity.create({
        userId,
        type,
        description,
        metadata
      });

      res.status(201).json({
        success: true,
        data: {
          activity: activity.toJSON(),
          message: 'Activity logged successfully'
        }
      });
    } catch (error) {
      console.error('Create activity error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create activity'
      });
    }
  }

  // Cleanup old activities
  async cleanupOldActivities(req, res) {
    try {
      const userId = req.user.databaseId;
      const { daysToKeep = 90 } = req.body;

      const result = await Activity.deleteOldActivities(userId, parseInt(daysToKeep));

      res.json({
        success: true,
        data: {
          deletedCount: result.deletedCount,
          message: `Cleaned up activities older than ${daysToKeep} days`
        }
      });
    } catch (error) {
      console.error('Cleanup activities error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup activities'
      });
    }
  }
}

module.exports = new ActivityController();