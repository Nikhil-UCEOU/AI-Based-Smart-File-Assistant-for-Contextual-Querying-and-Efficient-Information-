const bcrypt = require('bcryptjs');
const database = require('../config/database');
const pineconeService = require('../services/pineconeService');

class User {
  constructor(userData) {
    this.id = userData.id;
    this.firstName = userData.first_name;
    this.lastName = userData.last_name;
    this.email = userData.email;
    this.password = userData.password;
    this.profilePicture = userData.profile_picture;
    this.displayName = userData.display_name;
    this.bio = userData.bio;
    this.timezone = userData.timezone;
    this.userIndex = userData.user_index;
    this.pineconeId = userData.pinecone_id; // New field for Pinecone ID
    this.authProvider = userData.auth_provider;
    this.emailVerified = userData.email_verified;
    this.createdAt = userData.created_at;
    this.updatedAt = userData.updated_at;
  }

  static async create(userData) {
    const db = database.getDb();
    const { firstName, lastName, email, password, profilePicture, authProvider = 'email' } = userData;

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate unique user index
    const userIndex = await User.generateUniqueIndex();

    // Create dedicated user index in Pinecone (returns index name as Pinecone ID)
    const pineconeId = await pineconeService.createUserIndex({
      firstName,
      lastName,
      email
    });

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO users (first_name, last_name, email, password, profile_picture, user_index, pinecone_id, auth_provider, email_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        firstName,
        lastName,
        email,
        hashedPassword,
        profilePicture || null,
        userIndex,
        pineconeId,
        authProvider,
        0 // Email verification required
      ];

      db.run(query, values, function(err) {
        if (err) {
          // Clean up Pinecone index if user creation fails
          if (pineconeId && pineconeId.startsWith('user-')) {
            pineconeService.deleteUser(pineconeId).catch(console.error);
          }
          
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            if (err.message.includes('email')) {
              reject(new Error('Email already exists'));
            } else if (err.message.includes('user_index')) {
              reject(new Error('User index conflict'));
            } else {
              reject(new Error('Unique constraint violation'));
            }
          } else {
            console.error('User creation error:', err);
            reject(err);
          }
        } else {
          // Fetch the created user
          User.findById(this.lastID)
            .then(user => resolve(user))
            .catch(reject);
        }
      });
    });
  }

  static async findById(id) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE id = ?';
      
      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new User(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  static async findByPineconeId(pineconeId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE pinecone_id = ?';
      
      db.get(query, [pineconeId], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new User(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  static async generateUniqueIndex() {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      // Get the highest existing user_index
      const query = 'SELECT MAX(user_index) as max_index FROM users';
      
      db.get(query, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          const maxIndex = row.max_index || 999; // Start from 1000 if no users exist
          const newIndex = maxIndex + 1;
          resolve(newIndex);
        }
      });
    });
  }

  static async findByEmail(email) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE email = ?';
      
      db.get(query, [email], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new User(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  async validatePassword(password) {
    if (!this.password) {
      return false;
    }
    return await bcrypt.compare(password, this.password);
  }

  async updateProfilePicture(profilePictureUrl) {
    const db = database.getDb();
    
    return new Promise(async (resolve, reject) => {
      const query = 'UPDATE users SET profile_picture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      
      db.run(query, [profilePictureUrl, this.id], async (err) => {
        if (err) {
          reject(err);
        } else {
          // Update Pinecone metadata
          try {
            await pineconeService.updateUserMetadata(this.pineconeId, {
              profilePicture: profilePictureUrl
            });
          } catch (pineconeErr) {
            console.error('Failed to update Pinecone metadata:', pineconeErr);
          }
          resolve();
        }
      });
    });
  }

  async verifyEmail() {
    const db = database.getDb();
    
    return new Promise(async (resolve, reject) => {
      const query = 'UPDATE users SET email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      
      db.run(query, [this.id], async (err) => {
        if (err) {
          reject(err);
        } else {
          // Update Pinecone metadata
          try {
            await pineconeService.updateUserMetadata(this.pineconeId, {
              emailVerified: true
            });
          } catch (pineconeErr) {
            console.error('Failed to update Pinecone metadata:', pineconeErr);
          }
          resolve();
        }
      });
    });
  }

  async updatePassword(newPassword) {
    const db = database.getDb();
    
    // Hash the new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    return new Promise((resolve, reject) => {
      const query = 'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      
      db.run(query, [hashedPassword, this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async updateProfile(profileData) {
    const db = database.getDb();
    const { firstName, lastName, displayName, bio, timezone, profilePicture } = profileData;
    
    return new Promise(async (resolve, reject) => {
      const query = `
        UPDATE users 
        SET first_name = ?, last_name = ?, display_name = ?, bio = ?, timezone = ?, profile_picture = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      
      const values = [
        firstName || this.firstName,
        lastName || this.lastName,
        displayName,
        bio,
        timezone,
        profilePicture !== undefined ? profilePicture : this.profilePicture,
        this.id
      ];

      db.run(query, values, async (err) => {
        if (err) {
          reject(err);
        } else {
          try {
            // Update Pinecone metadata
            await pineconeService.updateUserMetadata(this.pineconeId, {
              firstName: firstName || this.firstName,
              lastName: lastName || this.lastName,
              displayName: displayName,
              bio: bio,
              timezone: timezone,
              profilePicture: profilePicture !== undefined ? profilePicture : this.profilePicture
            });

            // Update instance properties
            this.firstName = firstName || this.firstName;
            this.lastName = lastName || this.lastName;
            this.displayName = displayName;
            this.bio = bio;
            this.timezone = timezone;
            if (profilePicture !== undefined) {
              this.profilePicture = profilePicture;
            }

            resolve(this);
          } catch (pineconeErr) {
            console.error('Failed to update Pinecone metadata:', pineconeErr);
            // Still resolve since database update succeeded
            resolve(this);
          }
        }
      });
    });
  }

  static async updateByPineconeId(pineconeId, updateData) {
    const user = await User.findByPineconeId(pineconeId);
    if (!user) {
      return null;
    }

    return await user.updateProfile(updateData);
  }

  toJSON() {
    return {
      id: this.pineconeId, // Use Pinecone ID as the main ID
      databaseId: this.id, // Keep database ID for internal use
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      profilePictureUrl: this.profilePicture,
      displayName: this.displayName,
      bio: this.bio,
      timezone: this.timezone,
      userIndex: this.userIndex,
      pineconeId: this.pineconeId,
      authProvider: this.authProvider,
      emailVerified: this.emailVerified,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Helper method to check if user has a dedicated index (new format)
  hasDedicatedIndex() {
    return this.pineconeId && this.pineconeId.startsWith('user-');
  }

  // Migration method to create dedicated index for existing users
  async migrateToDedicatedIndex() {
    if (this.hasDedicatedIndex()) {
      console.log(`✅ User ${this.email} already has dedicated index: ${this.pineconeId}`);
      return this.pineconeId;
    }

    try {
      console.log(`🔄 Migrating user ${this.email} to dedicated index...`);
      
      // Create new dedicated index
      const newPineconeId = await pineconeService.createUserIndex({
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email
      });

      // Update database with new Pinecone ID
      const db = database.getDb();
      await new Promise((resolve, reject) => {
        const query = 'UPDATE users SET pinecone_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        db.run(query, [newPineconeId, this.id], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // Update instance
      this.pineconeId = newPineconeId;
      
      console.log(`✅ User ${this.email} migrated to dedicated index: ${newPineconeId}`);
      return newPineconeId;
    } catch (error) {
      console.error(`❌ Failed to migrate user ${this.email}:`, error);
      throw error;
    }
  }

  // Static method to migrate all users to dedicated indexes
  static async migrateAllUsersToDedicatedIndexes() {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE pinecone_id IS NULL OR pinecone_id NOT LIKE "user-%"';
      
      db.all(query, [], async (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`🔄 Found ${rows.length} users to migrate to dedicated indexes`);
        
        const migrationResults = [];
        
        for (const row of rows) {
          try {
            const user = new User(row);
            const newPineconeId = await user.migrateToDedicatedIndex();
            migrationResults.push({ 
              success: true, 
              email: user.email, 
              newPineconeId 
            });
          } catch (error) {
            console.error(`❌ Migration failed for user ${row.email}:`, error);
            migrationResults.push({ 
              success: false, 
              email: row.email, 
              error: error.message 
            });
          }
        }
        
        resolve(migrationResults);
      });
    });
  }

  // Enhanced user data cleanup functionality
  async deleteUserData() {
    const Document = require('./Document');
    
    try {
      console.log(`🧹 Starting complete user data cleanup for user ${this.email} (ID: ${this.id})`);
      
      // Step 1: Get cleanup statistics before deletion
      const cleanupStats = await Document.getUserCleanupStatistics(this.id);
      console.log(`📊 User cleanup statistics:`, cleanupStats);
      
      // Step 2: Verify user-document mapping consistency
      const mappingVerification = await Document.verifyUserDocumentMapping(this.id, this.pineconeId);
      console.log(`🔍 User-document mapping verification:`, mappingVerification);
      
      // Step 3: Fix any mapping inconsistencies if found
      if (!mappingVerification.isConsistent) {
        console.log(`🔧 Fixing ${mappingVerification.mismatchedDocuments} document mapping inconsistencies...`);
        await Document.fixUserDocumentMapping(this.id, this.pineconeId);
      }
      
      // Step 4: Remove all user vectors from Pinecone
      const vectorCleanupResult = await pineconeService.removeAllUserVectors(this.pineconeId);
      console.log(`🗑️ Pinecone vector cleanup result:`, vectorCleanupResult);
      
      // Step 5: Delete all user documents from database
      const documentCleanupResult = await Document.deleteAllUserDocuments(this.id);
      console.log(`🗑️ Database document cleanup result:`, documentCleanupResult);
      
      // Step 6: Delete user from Pinecone (index/namespace cleanup)
      const pineconeCleanupResult = await pineconeService.cleanupUserData(this.pineconeId);
      console.log(`🗑️ Pinecone user cleanup result:`, pineconeCleanupResult);
      
      // Step 7: Delete user from database
      const userDeletionResult = await this.deleteFromDatabase();
      console.log(`🗑️ User database deletion result:`, userDeletionResult);
      
      // Step 8: Verify cleanup completion
      const verificationResult = await pineconeService.verifyUserDataCleanup(this.pineconeId);
      console.log(`✅ Cleanup verification result:`, verificationResult);
      
      const finalResult = {
        success: true,
        userId: this.id,
        email: this.email,
        pineconeId: this.pineconeId,
        cleanupStatistics: cleanupStats,
        mappingVerification: mappingVerification,
        vectorsRemoved: vectorCleanupResult.vectorsRemoved || 0,
        documentsDeleted: documentCleanupResult.deletedCount || 0,
        pineconeCleanup: pineconeCleanupResult,
        userDeleted: userDeletionResult,
        verificationResult: verificationResult,
        completedAt: new Date().toISOString()
      };
      
      console.log(`✅ Complete user data cleanup successful for ${this.email}`);
      return finalResult;
      
    } catch (error) {
      console.error(`❌ User data cleanup failed for ${this.email}:`, error.message);
      
      return {
        success: false,
        userId: this.id,
        email: this.email,
        pineconeId: this.pineconeId,
        error: error.message,
        failedAt: new Date().toISOString()
      };
    }
  }

  // Method to delete user from database
  async deleteFromDatabase() {
    const db = database.getDb();
    const userId = this.id; // Capture the ID before deletion
    
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM users WHERE id = ?';
      
      db.run(query, [userId], function(err) {
        if (err) {
          console.error(`❌ Failed to delete user ${userId} from database:`, err);
          reject(err);
        } else {
          console.log(`✅ User ${userId} deleted from database`);
          resolve({
            success: true,
            deletedUserId: userId,
            message: 'User successfully deleted from database'
          });
        }
      });
    });
  }

  // Static method to cleanup user data by ID
  static async deleteUserById(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          error: `User with ID ${userId} not found`,
          userId: userId
        };
      }
      
      return await user.deleteUserData();
    } catch (error) {
      console.error(`❌ Failed to delete user by ID ${userId}:`, error.message);
      return {
        success: false,
        error: error.message,
        userId: userId
      };
    }
  }

  // Static method to cleanup user data by Pinecone ID
  static async deleteUserByPineconeId(pineconeId) {
    try {
      const user = await User.findByPineconeId(pineconeId);
      if (!user) {
        return {
          success: false,
          error: `User with Pinecone ID ${pineconeId} not found`,
          pineconeId: pineconeId
        };
      }
      
      return await user.deleteUserData();
    } catch (error) {
      console.error(`❌ Failed to delete user by Pinecone ID ${pineconeId}:`, error.message);
      return {
        success: false,
        error: error.message,
        pineconeId: pineconeId
      };
    }
  }

  // Method to verify user data cleanup without performing deletion
  async verifyDataCleanup() {
    const Document = require('./Document');
    
    try {
      // Check database documents
      const documentCount = await Document.getUserDocumentCount(this.id);
      
      // Check Pinecone vectors
      const pineconeVerification = await pineconeService.verifyUserDataCleanup(this.pineconeId);
      
      // Check user-document mapping consistency
      const mappingVerification = await Document.verifyUserDocumentMapping(this.id, this.pineconeId);
      
      return {
        userId: this.id,
        email: this.email,
        pineconeId: this.pineconeId,
        databaseDocuments: documentCount,
        pineconeVerification: pineconeVerification,
        mappingConsistency: mappingVerification,
        isFullyClean: documentCount === 0 && pineconeVerification.isClean && mappingVerification.isConsistent,
        verifiedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Failed to verify user data cleanup for ${this.email}:`, error.message);
      return {
        userId: this.id,
        email: this.email,
        pineconeId: this.pineconeId,
        error: error.message,
        isFullyClean: false
      };
    }
  }

  // Static method to get cleanup statistics for all users
  static async getAllUsersCleanupStatistics() {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          u.id,
          u.email,
          u.pinecone_id,
          COUNT(d.id) as document_count,
          SUM(d.file_size) as total_file_size,
          MIN(d.created_at) as oldest_document,
          MAX(d.created_at) as newest_document
        FROM users u
        LEFT JOIN documents d ON u.id = d.user_id
        GROUP BY u.id, u.email, u.pinecone_id
        ORDER BY document_count DESC
      `;
      
      db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const statistics = rows.map(row => ({
            userId: row.id,
            email: row.email,
            pineconeId: row.pinecone_id,
            documentCount: row.document_count || 0,
            totalFileSize: row.total_file_size || 0,
            oldestDocument: row.oldest_document,
            newestDocument: row.newest_document
          }));
          
          resolve({
            totalUsers: statistics.length,
            totalDocuments: statistics.reduce((sum, user) => sum + user.documentCount, 0),
            totalFileSize: statistics.reduce((sum, user) => sum + user.totalFileSize, 0),
            users: statistics,
            generatedAt: new Date().toISOString()
          });
        }
      });
    });
  }
}

module.exports = User;