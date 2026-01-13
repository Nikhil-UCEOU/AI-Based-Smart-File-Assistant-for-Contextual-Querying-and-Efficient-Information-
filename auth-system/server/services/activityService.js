const Activity = require('../models/Activity');

class ActivityService {
  // Log document upload activity
  async logDocumentUpload(userId, documentName, documentId, fileSize) {
    try {
      return await Activity.create({
        userId,
        type: 'upload',
        description: `Uploaded document "${documentName}"`,
        metadata: { 
          documentId, 
          documentName, 
          fileSize,
          action: 'document_upload'
        }
      });
    } catch (error) {
      console.error('Failed to log document upload activity:', error);
    }
  }

  // Log document search activity
  async logDocumentSearch(userId, searchQuery, resultCount) {
    try {
      return await Activity.create({
        userId,
        type: 'search',
        description: `Searched for "${searchQuery}" (${resultCount} results)`,
        metadata: { 
          searchQuery, 
          resultCount,
          action: 'document_search'
        }
      });
    } catch (error) {
      console.error('Failed to log document search activity:', error);
    }
  }

  // Log chat session activity
  async logChatSession(userId, sessionId, messageCount = 1, topic = null) {
    try {
      const description = messageCount === 1 
        ? 'Started AI chat session' 
        : `Continued chat session (${messageCount} messages)`;

      return await Activity.create({
        userId,
        type: 'chat',
        description: topic ? `${description} about "${topic}"` : description,
        metadata: { 
          sessionId, 
          messageCount, 
          topic,
          action: 'chat_session'
        }
      });
    } catch (error) {
      console.error('Failed to log chat session activity:', error);
    }
  }

  // Log document deletion activity
  async logDocumentDelete(userId, documentName, documentId) {
    try {
      return await Activity.create({
        userId,
        type: 'delete',
        description: `Deleted document "${documentName}"`,
        metadata: { 
          documentId, 
          documentName,
          action: 'document_delete'
        }
      });
    } catch (error) {
      console.error('Failed to log document delete activity:', error);
    }
  }

  // Log profile update activity
  async logProfileUpdate(userId, updatedFields) {
    try {
      const fieldNames = Object.keys(updatedFields).join(', ');
      return await Activity.create({
        userId,
        type: 'profile',
        description: `Updated profile: ${fieldNames}`,
        metadata: { 
          updatedFields,
          action: 'profile_update'
        }
      });
    } catch (error) {
      console.error('Failed to log profile update activity:', error);
    }
  }

  // Log user login activity
  async logUserLogin(userId, loginMethod = 'email', ipAddress = null) {
    try {
      return await Activity.create({
        userId,
        type: 'login',
        description: `Logged in via ${loginMethod}`,
        metadata: { 
          loginMethod, 
          ipAddress,
          action: 'user_login'
        }
      });
    } catch (error) {
      console.error('Failed to log user login activity:', error);
    }
  }

  // Log user logout activity
  async logUserLogout(userId) {
    try {
      return await Activity.create({
        userId,
        type: 'logout',
        description: 'Logged out',
        metadata: { 
          action: 'user_logout'
        }
      });
    } catch (error) {
      console.error('Failed to log user logout activity:', error);
    }
  }

  // Get recent activities for a user
  async getUserRecentActivities(userId, limit = 10, days = 7) {
    try {
      return await Activity.getRecentActivities(userId, days, limit);
    } catch (error) {
      console.error('Failed to get user recent activities:', error);
      return [];
    }
  }

  // Get activity statistics for dashboard
  async getUserActivityStats(userId, days = 30) {
    try {
      const stats = await Activity.getActivityStats(userId, days);
      
      // Process into dashboard-friendly format
      const processedStats = {
        totalActivities: 0,
        uploads: 0,
        searches: 0,
        chats: 0,
        profileUpdates: 0,
        recentTrend: []
      };

      stats.forEach(stat => {
        processedStats.totalActivities += stat.count;
        
        switch (stat.type) {
          case 'upload':
            processedStats.uploads += stat.count;
            break;
          case 'search':
            processedStats.searches += stat.count;
            break;
          case 'chat':
            processedStats.chats += stat.count;
            break;
          case 'profile':
            processedStats.profileUpdates += stat.count;
            break;
        }
      });

      return processedStats;
    } catch (error) {
      console.error('Failed to get user activity stats:', error);
      return {
        totalActivities: 0,
        uploads: 0,
        searches: 0,
        chats: 0,
        profileUpdates: 0,
        recentTrend: []
      };
    }
  }

  // Cleanup old activities for all users (maintenance task)
  async cleanupOldActivities(daysToKeep = 90) {
    try {
      const db = require('../config/database').getDb();
      
      return new Promise((resolve, reject) => {
        const query = `
          DELETE FROM activities 
          WHERE created_at < datetime('now', '-${daysToKeep} days')
        `;
        
        db.run(query, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ deletedCount: this.changes });
          }
        });
      });
    } catch (error) {
      console.error('Failed to cleanup old activities:', error);
      throw error;
    }
  }
}

module.exports = new ActivityService();