const express = require('express');
const router = express.Router();
const User = require('../models/User');
const pineconeService = require('../services/pineconeService');
const authMiddleware = require('../middleware/auth').authenticateToken;

// Admin middleware (simple check - in production, use proper admin authentication)
const adminMiddleware = (req, res, next) => {
  // For now, just check if user exists (in production, check for admin role)
  if (!req.user) {
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access required' 
    });
  }
  next();
};

// Get migration status
router.get('/migration-status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = require('../config/database').getDb();
    
    // Get all users
    const allUsers = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM users', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => new User(row)));
      });
    });

    // Categorize users
    const migrated = allUsers.filter(user => user.hasDedicatedIndex());
    const needsMigration = allUsers.filter(user => !user.hasDedicatedIndex());

    // Get Pinecone index statistics
    const indexList = await pineconeService.listUserIndexes();

    res.json({
      success: true,
      data: {
        totalUsers: allUsers.length,
        migratedUsers: migrated.length,
        usersNeedingMigration: needsMigration.length,
        totalUserIndexes: indexList.length,
        migrationComplete: needsMigration.length === 0,
        users: {
          migrated: migrated.map(user => ({
            email: user.email,
            pineconeId: user.pineconeId,
            createdAt: user.createdAt
          })),
          needsMigration: needsMigration.map(user => ({
            email: user.email,
            pineconeId: user.pineconeId,
            createdAt: user.createdAt
          }))
        }
      }
    });
  } catch (error) {
    console.error('❌ Failed to get migration status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get migration status'
    });
  }
});

// Trigger migration for all users
router.post('/migrate-users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('🚀 Admin triggered user migration to dedicated indexes');
    
    const results = await User.migrateAllUsersToDedicatedIndexes();
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    res.json({
      success: true,
      data: {
        totalProcessed: results.length,
        successful: successful.length,
        failed: failed.length,
        results: results
      }
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed: ' + error.message
    });
  }
});

// Get Pinecone index statistics
router.get('/pinecone-stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const indexList = await pineconeService.listUserIndexes();
    
    // Get detailed stats for each index (limited to first 10 for performance)
    const detailedStats = [];
    const indexesToCheck = indexList.slice(0, 10);
    
    for (const indexInfo of indexesToCheck) {
      try {
        const stats = await pineconeService.getUserIndexStats(indexInfo.name);
        detailedStats.push({
          name: indexInfo.name,
          status: stats?.status,
          dimension: stats?.dimension,
          metric: stats?.metric,
          vectorCount: stats?.status?.vectorCount || 0
        });
      } catch (error) {
        detailedStats.push({
          name: indexInfo.name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        totalIndexes: indexList.length,
        indexList: indexList,
        detailedStats: detailedStats,
        note: detailedStats.length < indexList.length ? 
          `Showing detailed stats for first ${detailedStats.length} indexes only` : null
      }
    });
  } catch (error) {
    console.error('❌ Failed to get Pinecone stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Pinecone statistics'
    });
  }
});

// Get cleanup statistics for all users
router.get('/cleanup-stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const statistics = await User.getAllUsersCleanupStatistics();
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('❌ Failed to get cleanup statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cleanup statistics'
    });
  }
});

// Delete user by ID with complete data cleanup
router.delete('/users/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`🗑️ Admin initiated user deletion for ID: ${userId}`);
    
    const cleanupResult = await User.deleteUserById(parseInt(userId));
    
    if (cleanupResult.success) {
      res.json({
        success: true,
        message: `User ${userId} and all associated data deleted successfully`,
        data: cleanupResult
      });
    } else {
      res.status(404).json({
        success: false,
        error: cleanupResult.error,
        data: cleanupResult
      });
    }
  } catch (error) {
    console.error('❌ Failed to delete user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user: ' + error.message
    });
  }
});

// Delete user by Pinecone ID with complete data cleanup
router.delete('/users/pinecone/:pineconeId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { pineconeId } = req.params;
    
    console.log(`🗑️ Admin initiated user deletion for Pinecone ID: ${pineconeId}`);
    
    const cleanupResult = await User.deleteUserByPineconeId(pineconeId);
    
    if (cleanupResult.success) {
      res.json({
        success: true,
        message: `User with Pinecone ID ${pineconeId} and all associated data deleted successfully`,
        data: cleanupResult
      });
    } else {
      res.status(404).json({
        success: false,
        error: cleanupResult.error,
        data: cleanupResult
      });
    }
  } catch (error) {
    console.error('❌ Failed to delete user by Pinecone ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user: ' + error.message
    });
  }
});

// Verify user data cleanup status
router.get('/users/:userId/cleanup-status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(parseInt(userId));
    if (!user) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`
      });
    }
    
    const verificationResult = await user.verifyDataCleanup();
    
    res.json({
      success: true,
      data: verificationResult
    });
  } catch (error) {
    console.error('❌ Failed to verify cleanup status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify cleanup status: ' + error.message
    });
  }
});

// Cleanup user vectors from Pinecone (without deleting user from database)
router.post('/users/:userId/cleanup-vectors', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(parseInt(userId));
    if (!user) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`
      });
    }
    
    console.log(`🧹 Admin initiated vector cleanup for user: ${user.email}`);
    
    // Remove all user vectors from Pinecone
    const vectorCleanupResult = await pineconeService.removeAllUserVectors(user.pineconeId);
    
    // Verify cleanup completion
    const verificationResult = await pineconeService.verifyUserDataCleanup(user.pineconeId);
    
    res.json({
      success: true,
      message: `Vector cleanup completed for user ${user.email}`,
      data: {
        userId: user.id,
        email: user.email,
        pineconeId: user.pineconeId,
        vectorCleanup: vectorCleanupResult,
        verification: verificationResult,
        completedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Failed to cleanup user vectors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup user vectors: ' + error.message
    });
  }
});

// Fix user-document mapping inconsistencies
router.post('/users/:userId/fix-mapping', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(parseInt(userId));
    if (!user) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`
      });
    }
    
    console.log(`🔧 Admin initiated mapping fix for user: ${user.email}`);
    
    // Verify current mapping state
    const Document = require('../models/Document');
    const mappingVerification = await Document.verifyUserDocumentMapping(user.id, user.pineconeId);
    
    if (mappingVerification.isConsistent) {
      return res.json({
        success: true,
        message: 'User-document mapping is already consistent',
        data: {
          userId: user.id,
          email: user.email,
          mappingVerification: mappingVerification,
          fixRequired: false
        }
      });
    }
    
    // Fix mapping inconsistencies
    const fixResult = await Document.fixUserDocumentMapping(user.id, user.pineconeId);
    
    // Verify fix was successful
    const postFixVerification = await Document.verifyUserDocumentMapping(user.id, user.pineconeId);
    
    res.json({
      success: true,
      message: `Fixed ${fixResult.fixedCount} document mapping inconsistencies for user ${user.email}`,
      data: {
        userId: user.id,
        email: user.email,
        pineconeId: user.pineconeId,
        beforeFix: mappingVerification,
        fixResult: fixResult,
        afterFix: postFixVerification,
        completedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Failed to fix user-document mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix user-document mapping: ' + error.message
    });
  }
});

module.exports = router;