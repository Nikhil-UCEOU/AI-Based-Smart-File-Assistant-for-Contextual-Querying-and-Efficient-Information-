const database = require('../config/database');
const crypto = require('crypto');

class PasswordResetToken {
  constructor(tokenData) {
    this.id = tokenData.id;
    this.userId = tokenData.user_id;
    this.token = tokenData.token;
    this.expiresAt = tokenData.expires_at;
    this.used = tokenData.used;
    this.createdAt = tokenData.created_at;
  }

  static async create(userId, expiresInHours = 1) {
    const db = database.getDb();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES (?, ?, ?)
      `;
      
      const values = [userId, token, expiresAt.toISOString()];

      db.run(query, values, function(err) {
        if (err) {
          console.error('Password reset token creation error:', err);
          reject(err);
        } else {
          // Fetch the created token
          PasswordResetToken.findById(this.lastID)
            .then(tokenRecord => resolve(tokenRecord))
            .catch(reject);
        }
      });
    });
  }

  static async findById(id) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM password_reset_tokens WHERE id = ?';
      
      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new PasswordResetToken(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  static async findByToken(token) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM password_reset_tokens 
        WHERE token = ? AND used = 0 AND expires_at > datetime('now')
      `;
      
      db.get(query, [token], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new PasswordResetToken(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  static async findByUserId(userId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM password_reset_tokens 
        WHERE user_id = ? AND used = 0 AND expires_at > datetime('now')
        ORDER BY created_at DESC
      `;
      
      db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const tokens = rows.map(row => new PasswordResetToken(row));
          resolve(tokens);
        }
      });
    });
  }

  async markAsUsed() {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'UPDATE password_reset_tokens SET used = 1 WHERE id = ?';
      
      db.run(query, [this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  static async deleteExpired() {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM password_reset_tokens WHERE expires_at <= datetime(\'now\')';
      
      db.run(query, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  static async deleteByUserId(userId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM password_reset_tokens WHERE user_id = ?';
      
      db.run(query, [userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  isExpired() {
    return new Date() > new Date(this.expiresAt);
  }

  isUsed() {
    return this.used === 1;
  }

  isValid() {
    return !this.isExpired() && !this.isUsed();
  }
}

module.exports = PasswordResetToken;