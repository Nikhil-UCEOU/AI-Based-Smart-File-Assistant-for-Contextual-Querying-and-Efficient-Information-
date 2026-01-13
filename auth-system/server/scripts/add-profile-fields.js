#!/usr/bin/env node

/**
 * Database Migration Script: Add Profile Fields
 * 
 * This script adds new profile fields to the users table:
 * - display_name: Custom display name for the user
 * - bio: User biography/description
 * - timezone: User's timezone preference
 */

require('dotenv').config();
const database = require('../config/database');

async function addProfileFields() {
  try {
    console.log('🔄 Starting profile fields migration...');
    
    // Connect to database
    await database.connect();
    const db = database.getDb();
    
    // Check if columns already exist
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const existingColumns = tableInfo.map(row => row.name);
    console.log('📋 Existing columns:', existingColumns);
    
    const columnsToAdd = [
      { name: 'display_name', type: 'TEXT' },
      { name: 'bio', type: 'TEXT' },
      { name: 'timezone', type: 'TEXT DEFAULT "UTC"' }
    ];
    
    // Add missing columns
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        console.log(`➕ Adding column: ${column.name}`);
        
        await new Promise((resolve, reject) => {
          const query = `ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`;
          db.run(query, (err) => {
            if (err) {
              console.error(`❌ Failed to add column ${column.name}:`, err);
              reject(err);
            } else {
              console.log(`✅ Added column: ${column.name}`);
              resolve();
            }
          });
        });
      } else {
        console.log(`⏭️  Column ${column.name} already exists, skipping`);
      }
    }
    
    // Verify the migration
    const updatedTableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('📋 Updated table structure:');
    updatedTableInfo.forEach(row => {
      console.log(`  - ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
    });
    
    console.log('✅ Profile fields migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await database.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  addProfileFields();
}

module.exports = { addProfileFields };