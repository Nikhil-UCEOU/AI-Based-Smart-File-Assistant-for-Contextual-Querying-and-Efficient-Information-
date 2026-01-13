const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth').authenticateToken;
const documentController = require('../controllers/documentController');

const router = express.Router();

// Ensure documents directory exists
const documentsDir = path.join(__dirname, '../uploads/documents');
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentsDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Basic security check - detailed validation happens in the service
  const filename = file.originalname;
  
  // Check for null bytes (security issue)
  if (filename.includes('\0')) {
    cb(new Error('Invalid filename'), false);
    return;
  }
  
  // Check filename length
  if (filename.length > 255) {
    cb(new Error('Filename too long'), false);
    return;
  }
  
  // Allow file through - comprehensive validation happens in fileValidationService
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit (generous, detailed validation in service)
    files: 20 // Allow up to 20 files for batch upload
  }
});

// Routes
router.post('/upload', auth, upload.single('document'), documentController.uploadDocument);
router.post('/batch-upload', auth, upload.array('documents', 20), documentController.batchUploadDocuments);
router.post('/batch-upload-stream', auth, upload.array('documents', 20), documentController.batchUploadDocuments);
router.post('/process-folder', auth, documentController.processDataFolder);

// Queue management routes
router.post('/queue/create', auth, documentController.createUploadQueue);
router.get('/queues', auth, documentController.getUploadQueues);
router.get('/queue/:queueName/status', auth, documentController.getQueueStatus);
router.put('/queue/:queueName/reorder', auth, documentController.reorderQueue);
router.put('/queue/:queueName/pause', auth, documentController.pauseQueue);
router.put('/queue/:queueName/resume', auth, documentController.resumeQueue);
router.delete('/queue/:queueName/cleanup', auth, documentController.cleanupQueue);

// Progress tracking routes
router.get('/progress/trackers', auth, documentController.getProgressTrackers);
router.get('/progress/:trackerId', auth, documentController.getProgressTracker);
router.get('/progress/:trackerId/history', auth, documentController.getProgressHistory);
router.get('/progress/metrics', auth, documentController.getProgressMetrics);

// Embedding optimization routes
router.get('/embedding/status', auth, documentController.getEmbeddingOptimizationStatus);
router.delete('/embedding/cache', auth, documentController.clearEmbeddingCache);
router.post('/embedding/test', auth, documentController.testEmbeddingOptimization);

// Processing status routes
router.get('/processing-status/:jobId', auth, documentController.getProcessingStatus);
router.get('/processing-jobs', auth, documentController.getProcessingJobs);
router.get('/validation-status', auth, documentController.getValidationStatus);
router.get('/processing-manager-status', auth, documentController.getProcessingManagerStatus);
router.get('/processing-metrics', auth, documentController.getProcessingMetrics);

// Document management routes
router.get('/', auth, documentController.getUserDocuments);
router.post('/search', auth, documentController.searchDocuments);
router.get('/:id', auth, documentController.getDocumentContent);
router.delete('/:id', auth, documentController.deleteDocument);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 100MB per file.',
        details: 'Individual files are validated with specific size limits based on type.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum 20 files allowed per batch upload.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field. Use "document" for single upload or "documents" for batch upload.'
      });
    }
  }
  
  if (error.message.includes('Invalid filename') || error.message.includes('Filename too long')) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  
  console.error('File upload middleware error:', error);
  res.status(500).json({
    success: false,
    error: 'File upload error',
    details: 'Please check your file and try again.'
  });
});

module.exports = router;