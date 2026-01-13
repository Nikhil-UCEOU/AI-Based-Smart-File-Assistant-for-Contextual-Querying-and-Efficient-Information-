const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use the correct database path that matches the app configuration
const dbPath = path.join(__dirname, '../database/auth.db');

console.log('🧹 Cleaning database...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Drop all tables and recreate them empty
const cleanDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Drop existing tables
      db.run('DROP TABLE IF EXISTS password_reset_tokens', (err) => {
        if (err) console.log('Note: password_reset_tokens table did not exist');
      });
      
      db.run('DROP TABLE IF EXISTS sessions', (err) => {
        if (err) console.log('Note: sessions table did not exist');
      });
      
      db.run('DROP TABLE IF EXISTS users', (err) => {
        if (err) console.log('Note: users table did not exist');
      });

      // Recreate tables (empty)
      db.run(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          profile_picture TEXT,
          user_index INTEGER UNIQUE NOT NULL,
          pinecone_id TEXT UNIQUE,
          auth_provider TEXT DEFAULT 'email',
          email_verified BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating users table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Users table created (empty)');
      });

      db.run(`
        CREATE TABLE sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          refresh_token TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating sessions table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Sessions table created (empty)');
      });

      db.run(`
        CREATE TABLE password_reset_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          used BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating password_reset_tokens table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Password reset tokens table created (empty)');
        resolve();
      });
    });
  });
};

cleanDatabase()
  .then(() => {
    console.log('🎉 Database cleaned successfully! All tables are now empty.');
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      } else {
        console.log('✅ Database connection closed');
      }
    });
  })
  .catch((err) => {
    console.error('❌ Error cleaning database:', err);
    process.exit(1);
  });