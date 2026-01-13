const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const { authenticateToken } = require('../middleware/auth');

// All activity routes require authentication
router.use(authenticateToken);

// Get user activities
router.get('/', activityController.getUserActivities);

// Get activity statistics
router.get('/stats', activityController.getActivityStats);

// Create new activity (for manual logging)
router.post('/', activityController.createActivity);

// Delete old activities (cleanup)
router.delete('/cleanup', activityController.cleanupOldActivities);

module.exports = router;