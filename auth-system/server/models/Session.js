const database = require('../config/database');

class Session {
  constructor(sessionData) {
    this.id = sessionData.id;
    this.userId = sessionData.user_id;
    this.refreshToken = sessionData.refresh_token;
    this.expiresAt = sessionData.expires_at;
    this.createdAt = sessionData.created_at;
  }

  static async create(userId, refreshToken, expiresAt) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO sessions (user_id, refresh_token, expires_at)
        VALUES (?, ?, ?)
      `;
      
      db.run(query, [userId, refreshToken, expiresAt], function(err) {
        if (err) {
          reject(err);
        } else {
          Session.findById(this.lastID)
            .then(session => resolve(session))
            .catch(reject);
        }
      });
    });
  }

  static async findById(id) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM sessions WHERE id = ?';
      
      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new Session(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  static async findByRefreshToken(refreshToken) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      // Convert current time to milliseconds for comparison
      const nowMs = Date.now();
      const query = 'SELECT * FROM sessions WHERE refresh_token = ? AND expires_at > ?';
      
      db.get(query, [refreshToken, nowMs], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new Session(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  static async deleteByRefreshToken(refreshToken) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM sessions WHERE refresh_token = ?';
      
      db.run(query, [refreshToken], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  static async deleteByUserId(userId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM sessions WHERE user_id = ?';
      
      db.run(query, [userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  static async cleanupExpired() {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      // Convert current time to milliseconds for comparison
      const nowMs = Date.now();
      const query = 'DELETE FROM sessions WHERE expires_at <= ?';
      
      db.run(query, [nowMs], function(err) {
        if (err) {
          reject(err);
        } else {
          console.log(`Cleaned up ${this.changes} expired sessions`);
          resolve(this.changes);
        }
      });
    });
  }

  async delete() {
    return Session.deleteByRefreshToken(this.refreshToken);
  }

  isExpired() {
    // expires_at is stored as milliseconds timestamp
    return this.expiresAt <= Date.now();
  }
}

module.exports = Session;