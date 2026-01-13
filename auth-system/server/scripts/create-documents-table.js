require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DocumentTableCreator {
  constructor() {
    this.dbPath = path.join(__dirname, '../database/auth.db');
  }

  async createDocumentsTable() {
    console.log('🔧 Creating documents table...');
    
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
        // Create documents table
        db.run(`
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
        `, (err) => {
          if (err) {
            console.error('❌ Error creating documents table:', err.message);
            reject(err);
            return;
          }
          console.log('✅ Documents table created successfully');
          
          // Create indexes for better performance
          db.run(`CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)`, (err) => {
            if (err) {
              console.error('❌ Error creating user_id index:', err.message);
            } else {
              console.log('✅ Created index on user_id');
            }
          });
          
          db.run(`CREATE INDEX IF NOT EXISTS idx_documents_pinecone_id ON documents(pinecone_id)`, (err) => {
            if (err) {
              console.error('❌ Error creating pinecone_id index:', err.message);
            } else {
              console.log('✅ Created index on pinecone_id');
            }
          });
          
          db.run(`CREATE INDEX IF NOT EXISTS idx_documents_upload_status ON documents(upload_status)`, (err) => {
            if (err) {
              console.error('❌ Error creating upload_status index:', err.message);
            } else {
              console.log('✅ Created index on upload_status');
            }
            
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
    });
  }

  async run() {
    console.log('🚀 Starting documents table creation...\n');
    
    try {
      await this.createDocumentsTable();
      
      console.log('\n🎉 DOCUMENTS TABLE CREATION COMPLETED! 🎉');
      console.log('=====================================');
      console.log('✅ Documents table created with all required fields');
      console.log('✅ Indexes created for optimal performance');
      console.log('✅ Foreign key constraints established');
      console.log('=====================================');
      console.log('🎯 Document uploads should now work correctly!');
      
    } catch (error) {
      console.error('\n❌ DOCUMENTS TABLE CREATION FAILED!');
      console.error('Error:', error.message);
      throw error;
    }
  }
}

// Run table creation if called directly
if (require.main === module) {
  const creator = new DocumentTableCreator();
  creator.run()
    .then(() => {
      console.log('\n✅ Documents table creation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Documents table creation failed:', error.message);
      process.exit(1);
    });
}

module.exports = DocumentTableCreator;