#!/usr/bin/env node

/**
 * Seed Activities Script
 * 
 * This script creates sample activities for testing the dynamic activity feed
 */

require('dotenv').config();
const database = require('../config/database');
const Activity = require('../models/Activity');
const User = require('../models/User');

async function seedActivities() {
  try {
    console.log('🌱 Seeding sample activities...');
    
    // Connect to database
    await database.connect();
    
    // Get all users
    const db = database.getDb();
    const users = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM users LIMIT 5', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    if (users.length === 0) {
      console.log('❌ No users found. Please create a user first.');
      return;
    }
    
    console.log(`📊 Found ${users.length} users to create activities for`);
    
    // Sample activities for each user
    const activityTemplates = [
      { type: 'upload', description: 'Uploaded document "Project Requirements.pdf"' },
      { type: 'upload', description: 'Uploaded document "Meeting Notes.docx"' },
      { type: 'upload', description: 'Uploaded document "Budget Analysis.xlsx"' },
      { type: 'search', description: 'Searched for "budget analysis"' },
      { type: 'search', description: 'Searched for "project timeline"' },
      { type: 'search', description: 'Searched for "meeting notes"' },
      { type: 'chat', description: 'Started AI chat session' },
      { type: 'chat', description: 'Continued chat session (5 messages)' },
      { type: 'profile', description: 'Updated profile: firstName, bio' },
      { type: 'profile', description: 'Updated profile picture' },
      { type: 'delete', description: 'Deleted document "Old Draft.txt"' },
      { type: 'delete', description: 'Deleted document "Temp File.pdf"' },
    ];
    
    let totalActivities = 0;
    
    for (const user of users) {
      console.log(`👤 Creating activities for user: ${user.email}`);
      
      // Create 5-8 random activities for each user
      const numActivities = Math.floor(Math.random() * 4) + 5; // 5-8 activities
      
      for (let i = 0; i < numActivities; i++) {
        const template = activityTemplates[Math.floor(Math.random() * activityTemplates.length)];
        
        // Create activity with random timestamp in the last 7 days
        const randomHoursAgo = Math.floor(Math.random() * 168); // 0-168 hours (7 days)
        const createdAt = new Date(Date.now() - randomHoursAgo * 60 * 60 * 1000);
        
        try {
          // Insert directly into database with custom timestamp
          await new Promise((resolve, reject) => {
            const query = `
              INSERT INTO activities (user_id, type, description, metadata, created_at)
              VALUES (?, ?, ?, ?, ?)
            `;
            
            const metadata = {
              seeded: true,
              randomData: Math.random().toString(36).substring(7)
            };
            
            db.run(query, [
              user.id,
              template.type,
              template.description,
              JSON.stringify(metadata),
              createdAt.toISOString()
            ], function(err) {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
          
          totalActivities++;
        } catch (error) {
          console.error(`❌ Failed to create activity for user ${user.email}:`, error);
        }
      }
    }
    
    console.log(`✅ Successfully created ${totalActivities} sample activities`);
    
    // Show summary
    const summary = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          u.email,
          COUNT(a.id) as activity_count,
          MAX(a.created_at) as latest_activity
        FROM users u
        LEFT JOIN activities a ON u.id = a.user_id
        GROUP BY u.id, u.email
        ORDER BY activity_count DESC
      `;
      
      db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('\n📊 Activity Summary:');
    summary.forEach(row => {
      console.log(`  ${row.email}: ${row.activity_count} activities (latest: ${row.latest_activity || 'none'})`);
    });
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await database.close();
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedActivities();
}

module.exports = { seedActivities };