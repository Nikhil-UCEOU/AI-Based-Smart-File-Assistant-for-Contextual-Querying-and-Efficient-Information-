const database = require('../config/database');

class Activity {
  constructor(activityData) {
    this.id = activityData.id;
    this.userId = activityData.user_id;
    this.type = activityData.type;
    this.description = activityData.description;
    this.metadata = activityData.metadata ? JSON.parse(activityData.metadata) : null;
    this.createdAt = activityData.created_at;
  }

  static async create(activityData) {
    const db = database.getDb();
    const { userId, type, description, metadata = null } = activityData;

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO activities (user_id, type, description, metadata, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      const values = [
        userId,
        type,
        description,
        metadata ? JSON.stringify(metadata) : null
      ];

      db.run(query, values, function(err) {
        if (err) {
          console.error('Activity creation error:', err);
          reject(err);
        } else {
          // Fetch the created activity
          Activity.findById(this.lastID)
            .then(activity => resolve(activity))
            .catch(reject);
        }
      });
    });
  }

  static async findById(id) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM activities WHERE id = ?';
      
      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new Activity(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  static async findByUserId(userId, limit = 10, offset = 0) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM activities 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      
      db.all(query, [userId, limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const activities = rows.map(row => new Activity(row));
          resolve(activities);
        }
      });
    });
  }

  static async getUserActivityCount(userId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT COUNT(*) as count FROM activities WHERE user_id = ?';
      
      db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }

  static async getRecentActivities(userId, days = 7, limit = 50) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM activities 
        WHERE user_id = ? 
        AND created_at >= datetime('now', '-${days} days')
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      
      db.all(query, [userId, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const activities = rows.map(row => new Activity(row));
          resolve(activities);
        }
      });
    });
  }

  static async getActivityStats(userId, days = 30) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          type,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM activities 
        WHERE user_id = ? 
        AND created_at >= datetime('now', '-${days} days')
        GROUP BY type, DATE(created_at)
        ORDER BY created_at DESC
      `;
      
      db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async deleteOldActivities(userId, daysToKeep = 90) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = `
        DELETE FROM activities 
        WHERE user_id = ? 
        AND created_at < datetime('now', '-${daysToKeep} days')
      `;
      
      db.run(query, [userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ deletedCount: this.changes });
        }
      });
    });
  }

  static async deleteAllUserActivities(userId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM activities WHERE user_id = ?';
      
      db.run(query, [userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ deletedCount: this.changes });
        }
      });
    });
  }

  // Helper method to log common activities
  static async logDocumentUpload(userId, documentName, documentId) {
    return Activity.create({
      userId,
      type: 'upload',
      description: `Uploaded document "${documentName}"`,
      metadata: { documentId, documentName }
    });
  }

  static async logDocumentSearch(userId, searchQuery, resultCount) {
    return Activity.create({
      userId,
      type: 'search',
      description: `Searched for "${searchQuery}"`,
      metadata: { searchQuery, resultCount }
    });
  }

  static async logChatSession(userId, sessionId, messageCount = 1) {
    return Activity.create({
      userId,
      type: 'chat',
      description: messageCount === 1 ? 'Started AI chat session' : `Continued chat session (${messageCount} messages)`,
      metadata: { sessionId, messageCount }
    });
  }

  static async logDocumentDelete(userId, documentName, documentId) {
    return Activity.create({
      userId,
      type: 'delete',
      description: `Deleted document "${documentName}"`,
      metadata: { documentId, documentName }
    });
  }

  static async logProfileUpdate(userId, updatedFields) {
    return Activity.create({
      userId,
      type: 'profile',
      description: 'Updated profile information',
      metadata: { updatedFields }
    });
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      type: this.type,
      description: this.description,
      metadata: this.metadata,
      timestamp: this.createdAt,
      createdAt: this.createdAt
    };
  }
}

module.exports = Activity;