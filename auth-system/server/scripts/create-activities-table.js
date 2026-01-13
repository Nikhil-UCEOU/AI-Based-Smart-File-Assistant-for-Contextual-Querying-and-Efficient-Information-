#!/usr/bin/env node

/**
 * Database Migration Script: Create Activities Table
 * 
 * This script creates the activities table to track user actions
 */

require('dotenv').config();
const database = require('../config/database');

async function createActivitiesTable() {
  try {
    console.log('🔄 Creating activities table...');
    
    // Connect to database
    await database.connect();
    const db = database.getDb();
    
    // Create activities table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('upload', 'search', 'chat', 'delete', 'profile', 'login', 'logout')),
        description TEXT NOT NULL,
        metadata TEXT, -- JSON string for additional data
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;
    
    await new Promise((resolve, reject) => {
      db.run(createTableQuery, (err) => {
        if (err) {
          console.error('❌ Failed to create activities table:', err);
          reject(err);
        } else {
          console.log('✅ Activities table created successfully');
          resolve();
        }
      });
    });
    
    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities (user_id)',
      'CREATE INDEX IF NOT EXISTS idx_activities_type ON activities (type)',
      'CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities (created_at)',
      'CREATE INDEX IF NOT EXISTS idx_activities_user_created ON activities (user_id, created_at DESC)'
    ];
    
    for (const indexQuery of indexes) {
      await new Promise((resolve, reject) => {
        db.run(indexQuery, (err) => {
          if (err) {
            console.error('❌ Failed to create index:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
    
    console.log('✅ Activity indexes created successfully');
    
    // Verify table structure
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(activities)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('📋 Activities table structure:');
    tableInfo.forEach(row => {
      console.log(`  - ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
    });
    
    console.log('✅ Activities table migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await database.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  createActivitiesTable();
}

module.exports = { createActivitiesTable };