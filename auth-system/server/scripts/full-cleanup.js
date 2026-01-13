require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const pineconeService = require('../services/pineconeService');

class FullCleanup {
  constructor() {
    this.dbPath = process.env.DB_PATH || './database.sqlite';
    this.uploadsPath = path.join(__dirname, '../uploads');
    this.logsPath = path.join(__dirname, '../logs');
  }

  async cleanDatabase() {
    console.log('🧹 Cleaning database...');
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Error connecting to database:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Connected to SQLite database');
      });

      db.serialize(() => {
        // Drop existing tables
        db.run('DROP TABLE IF EXISTS password_reset_tokens');
        db.run('DROP TABLE IF EXISTS sessions');
        db.run('DROP TABLE IF EXISTS users');
        db.run('DROP TABLE IF EXISTS documents');
        db.run('DROP TABLE IF EXISTS document_chunks');
        db.run('DROP TABLE IF EXISTS chats');
        db.run('DROP TABLE IF EXISTS processing_jobs');

        // Recreate essential tables
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
        `);

        db.run(`
          CREATE TABLE sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            refresh_token TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
          )
        `);

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
        `);

        db.run(`
          CREATE TABLE documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            pinecone_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            original_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            extracted_text TEXT,
            vector_id TEXT,
            upload_status TEXT DEFAULT 'processing',
            chunk_count INTEGER DEFAULT 0,
            processing_time INTEGER DEFAULT 0,
            embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2',
            chunk_size INTEGER DEFAULT 2000,
            chunk_overlap INTEGER DEFAULT 200,
            file_hash TEXT,
            validation_warnings TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
          )
        `);

        // Create indexes for better performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_documents_pinecone_id ON documents(pinecone_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_documents_upload_status ON documents(upload_status)`, (err) => {
          if (err) {
            console.error('❌ Error creating tables:', err.message);
            reject(err);
            return;
          }
          console.log('✅ Database tables recreated (empty)');
          
          db.close((err) => {
            if (err) {
              console.error('❌ Error closing database:', err.message);
              reject(err);
            } else {
              console.log('✅ Database connection closed');
              resolve();
            }
          });
        });
      });
    });
  }

  async cleanPinecone() {
    console.log('🧹 Cleaning Pinecone data...');
    
    try {
      await pineconeService.initialize();
      
      if (!pineconeService.isEnabled) {
        console.log('⚠️ Pinecone is not enabled, skipping cleanup');
        return { cleaned: 0, message: 'Pinecone disabled' };
      }
      
      // Get all user indexes
      const userIndexes = await pineconeService.listUserIndexes();
      
      if (userIndexes.length === 0) {
        console.log('✅ No user indexes found, Pinecone is already clean');
        return { cleaned: 0, message: 'Already clean' };
      }
      
      console.log(`🔍 Found ${userIndexes.length} user indexes to clean`);
      
      // Delete all user indexes
      let cleanedCount = 0;
      for (const index of userIndexes) {
        try {
          console.log(`🗑️ Deleting index: ${index.name}`);
          await pineconeService.deleteUser(index.name);
          cleanedCount++;
          console.log(`✅ Deleted index: ${index.name}`);
        } catch (error) {
          console.error(`❌ Failed to delete index ${index.name}: ${error.message}`);
        }
      }
      
      // Try to clean shared index
      try {
        const sharedIndexName = 'shared-user-data';
        await pineconeService.pinecone.deleteIndex(sharedIndexName);
        console.log(`✅ Deleted shared index: ${sharedIndexName}`);
        cleanedCount++;
      } catch (error) {
        if (!error.message.includes('not found')) {
          console.log(`⚠️ Could not delete shared index: ${error.message}`);
        }
      }
      
      console.log(`✅ Pinecone cleanup completed: ${cleanedCount} indexes cleaned`);
      return { cleaned: cleanedCount, message: 'Success' };
      
    } catch (error) {
      console.error('❌ Pinecone cleanup failed:', error.message);
      return { cleaned: 0, error: error.message };
    }
  }

  async cleanUploads() {
    console.log('🧹 Cleaning upload files...');
    
    try {
      // Remove all files in uploads directory but keep the structure
      const uploadsExist = await fs.access(this.uploadsPath).then(() => true).catch(() => false);
      
      if (uploadsExist) {
        const items = await fs.readdir(this.uploadsPath);
        let cleanedCount = 0;
        
        for (const item of items) {
          const itemPath = path.join(this.uploadsPath, item);
          const stat = await fs.stat(itemPath);
          
          if (stat.isFile()) {
            await fs.unlink(itemPath);
            cleanedCount++;
            console.log(`🗑️ Deleted file: ${item}`);
          } else if (stat.isDirectory() && item === 'documents') {
            // Clean documents directory but keep it
            const docItems = await fs.readdir(itemPath);
            for (const docItem of docItems) {
              const docPath = path.join(itemPath, docItem);
              await fs.unlink(docPath);
              cleanedCount++;
              console.log(`🗑️ Deleted document: ${docItem}`);
            }
          }
        }
        
        // Ensure documents directory exists
        const documentsPath = path.join(this.uploadsPath, 'documents');
        await fs.mkdir(documentsPath, { recursive: true });
        
        console.log(`✅ Upload cleanup completed: ${cleanedCount} files cleaned`);
        return { cleaned: cleanedCount, message: 'Success' };
      } else {
        console.log('✅ Uploads directory does not exist, creating it...');
        await fs.mkdir(path.join(this.uploadsPath, 'documents'), { recursive: true });
        return { cleaned: 0, message: 'Created directories' };
      }
    } catch (error) {
      console.error('❌ Upload cleanup failed:', error.message);
      return { cleaned: 0, error: error.message };
    }
  }

  async cleanTestFiles() {
    console.log('🧹 Cleaning test files...');
    
    try {
      const testFiles = [
        'test-db.js',
        'test-auth-flow.js', 
        'test-api-chat.js',
        'test-complex-chat.js',
        'test-new-chat.js'
      ];
      
      let cleanedCount = 0;
      
      for (const testFile of testFiles) {
        const testPath = path.join(__dirname, '..', testFile);
        try {
          await fs.access(testPath);
          await fs.unlink(testPath);
          cleanedCount++;
          console.log(`🗑️ Deleted test file: ${testFile}`);
        } catch (error) {
          // File doesn't exist, skip
        }
      }
      
      console.log(`✅ Test file cleanup completed: ${cleanedCount} files cleaned`);
      return { cleaned: cleanedCount, message: 'Success' };
    } catch (error) {
      console.error('❌ Test file cleanup failed:', error.message);
      return { cleaned: 0, error: error.message };
    }
  }

  async cleanLogs() {
    console.log('🧹 Cleaning log files...');
    
    try {
      const logsExist = await fs.access(this.logsPath).then(() => true).catch(() => false);
      
      if (logsExist) {
        const logFiles = await fs.readdir(this.logsPath);
        let cleanedCount = 0;
        
        for (const logFile of logFiles) {
          if (logFile.endsWith('.log')) {
            const logPath = path.join(this.logsPath, logFile);
            await fs.unlink(logPath);
            cleanedCount++;
            console.log(`🗑️ Deleted log: ${logFile}`);
          }
        }
        
        console.log(`✅ Log cleanup completed: ${cleanedCount} files cleaned`);
        return { cleaned: cleanedCount, message: 'Success' };
      } else {
        console.log('✅ Logs directory does not exist');
        return { cleaned: 0, message: 'No logs directory' };
      }
    } catch (error) {
      console.error('❌ Log cleanup failed:', error.message);
      return { cleaned: 0, error: error.message };
    }
  }

  async runFullCleanup() {
    console.log('🚀 Starting full system cleanup...\n');
    
    const results = {
      database: null,
      pinecone: null,
      uploads: null,
      testFiles: null,
      logs: null,
      startTime: new Date(),
      endTime: null
    };
    
    try {
      // Clean database
      await this.cleanDatabase();
      results.database = { success: true, message: 'Database cleaned successfully' };
      
      console.log(''); // Empty line for readability
      
      // Clean Pinecone
      results.pinecone = await this.cleanPinecone();
      
      console.log(''); // Empty line for readability
      
      // Clean uploads
      results.uploads = await this.cleanUploads();
      
      console.log(''); // Empty line for readability
      
      // Clean test files
      results.testFiles = await this.cleanTestFiles();
      
      console.log(''); // Empty line for readability
      
      // Clean logs
      results.logs = await this.cleanLogs();
      
      results.endTime = new Date();
      
      // Print summary
      console.log('\n🎉 FULL CLEANUP COMPLETED! 🎉');
      console.log('=====================================');
      console.log(`📊 Database: ${results.database.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`📊 Pinecone: ${results.pinecone.error ? '❌ Failed' : '✅ Success'} (${results.pinecone.cleaned} indexes)`);
      console.log(`📊 Uploads: ${results.uploads.error ? '❌ Failed' : '✅ Success'} (${results.uploads.cleaned} files)`);
      console.log(`📊 Test Files: ${results.testFiles.error ? '❌ Failed' : '✅ Success'} (${results.testFiles.cleaned} files)`);
      console.log(`📊 Logs: ${results.logs.error ? '❌ Failed' : '✅ Success'} (${results.logs.cleaned} files)`);
      console.log(`⏱️ Duration: ${results.endTime - results.startTime}ms`);
      console.log('=====================================');
      console.log('🎯 Your system is now ready for fresh signup and usage!');
      
      return results;
      
    } catch (error) {
      results.endTime = new Date();
      console.error('\n❌ CLEANUP FAILED!');
      console.error('Error:', error.message);
      throw error;
    }
  }
}

// Run cleanup if called directly
if (require.main === module) {
  const cleanup = new FullCleanup();
  cleanup.runFullCleanup()
    .then(() => {
      console.log('\n✅ All cleanup operations completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Cleanup failed:', error.message);
      process.exit(1);
    });
}

module.exports = FullCleanup;