const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = process.env.DB_PATH || './database/auth.db';
  }

  async connect() {
    return new Promise((resolve, reject) => {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.initializeTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  }

  async initializeTables() {
    return new Promise((resolve, reject) => {
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
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
      `;

      const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          refresh_token TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      const createPasswordResetTable = `
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          used BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      const createDocumentsTable = `
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          pinecone_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          original_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          file_path TEXT NOT NULL,
          extracted_text TEXT,
          vector_id TEXT UNIQUE,
          upload_status TEXT DEFAULT 'processing',
          chunk_count INTEGER DEFAULT 0,
          processing_time INTEGER DEFAULT 0,
          embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2',
          chunk_size INTEGER DEFAULT 200,
          chunk_overlap INTEGER DEFAULT 40,
          file_hash TEXT,
          validation_warnings TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      const createChatsTable = `
        CREATE TABLE IF NOT EXISTS chats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      const createChatMessagesTable = `
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id INTEGER NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          sources TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
        )
      `;

      // Create indexes for better performance
      const createIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_users_index ON users(user_index)',
        'CREATE INDEX IF NOT EXISTS idx_users_pinecone_id ON users(pinecone_id)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token)',
        'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)',
        'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_documents_pinecone_id ON documents(pinecone_id)',
        'CREATE INDEX IF NOT EXISTS idx_documents_vector_id ON documents(vector_id)',
        'CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id)'
      ];

      this.db.serialize(() => {
        this.db.run(createUsersTable, (err) => {
          if (err) {
            console.error('Error creating users table:', err.message);
            reject(err);
            return;
          }
        });

        this.db.run(createSessionsTable, (err) => {
          if (err) {
            console.error('Error creating sessions table:', err.message);
            reject(err);
            return;
          }
        });

        this.db.run(createPasswordResetTable, (err) => {
          if (err) {
            console.error('Error creating password reset tokens table:', err.message);
            reject(err);
            return;
          }
        });

        this.db.run(createDocumentsTable, (err) => {
          if (err) {
            console.error('Error creating documents table:', err.message);
            reject(err);
            return;
          }
        });

        this.db.run(createChatsTable, (err) => {
          if (err) {
            console.error('Error creating chats table:', err.message);
            reject(err);
            return;
          }
        });

        this.db.run(createChatMessagesTable, (err) => {
          if (err) {
            console.error('Error creating chat_messages table:', err.message);
            reject(err);
            return;
          }
        });

        // Create indexes
        createIndexes.forEach(indexQuery => {
          this.db.run(indexQuery, (err) => {
            if (err) {
              console.error('Error creating index:', err.message);
            }
          });
        });

        // Add migration for pinecone_id column if it doesn't exist
        this.db.run(`
          ALTER TABLE users ADD COLUMN pinecone_id TEXT UNIQUE
        `, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding pinecone_id column:', err.message);
          }
        });

        // Add migrations for enhanced document tracking columns
        const documentMigrations = [
          'ALTER TABLE documents ADD COLUMN chunk_count INTEGER DEFAULT 0',
          'ALTER TABLE documents ADD COLUMN processing_time INTEGER DEFAULT 0',
          'ALTER TABLE documents ADD COLUMN embedding_model TEXT DEFAULT "all-MiniLM-L6-v2"',
          'ALTER TABLE documents ADD COLUMN chunk_size INTEGER DEFAULT 200',
          'ALTER TABLE documents ADD COLUMN chunk_overlap INTEGER DEFAULT 40',
          'ALTER TABLE documents ADD COLUMN file_hash TEXT',
          'ALTER TABLE documents ADD COLUMN validation_warnings TEXT'
        ];

        documentMigrations.forEach(migration => {
          this.db.run(migration, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.error('Error in document migration:', err.message);
            }
          });
        });

        console.log('Database tables initialized successfully');
        resolve();
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err.message);
          } else {
            console.log('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getDb() {
    return this.db;
  }
}

module.exports = new Database();