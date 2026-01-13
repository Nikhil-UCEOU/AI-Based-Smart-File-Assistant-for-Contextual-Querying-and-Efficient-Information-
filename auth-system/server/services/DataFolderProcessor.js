const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

const advancedDocumentService = require('./advancedDocumentService');
const ErrorHandler = require('./ErrorHandler');
const ConfigurationManager = require('./ConfigurationManager');
const PerformanceMetrics = require('./PerformanceMetrics');
const ProcessingTimeTracker = require('./ProcessingTimeTracker');

class DataFolderProcessor {
  constructor() {
    this.config = ConfigurationManager.getServiceConfig('dataFolderProcessor');
    this.errorHandler = ErrorHandler;
    this.performanceMetrics = new PerformanceMetrics(ConfigurationManager.getServiceConfig('performanceMetrics'));
    this.processingTimeTracker = new ProcessingTimeTracker(ConfigurationManager.getServiceConfig('processingTimeTracker'));
    
    this.processingJobs = new Map();
    this.jobHistory = [];
    this.maxHistorySize = 100;
    
    console.log('✅ DataFolderProcessor initialized');
  }

  /**
   * Process all documents in a folder
   * @param {string} folderPath - Path to the folder containing documents
   * @param {string} userPineconeId - User's Pinecone ID
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing results
   */
  async processFolder(folderPath, userPineconeId, options = {}) {
    const jobId = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const operationId = `process_folder_${jobId}`;
    
    // Start tracking
    this.processingTimeTracker.startOperation(operationId, 'folder_processing', {
      folderPath,
      userPineconeId,
      options
    });
    
    const performanceOperation = this.performanceMetrics.startOperation(operationId, 'folder_processing', {
      folderPath,
      userPineconeId
    });

    const job = {
      jobId,
      operationId,
      folderPath,
      userPineconeId,
      status: 'processing',
      startTime: Date.now(),
      endTime: null,
      totalFiles: 0,
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      results: [],
      errors: [],
      options
    };

    this.processingJobs.set(jobId, job);

    try {
      // Validate folder exists
      if (!fs.existsSync(folderPath)) {
        throw new Error(`Folder does not exist: ${folderPath}`);
      }

      const folderStats = await stat(folderPath);
      if (!folderStats.isDirectory()) {
        throw new Error(`Path is not a directory: ${folderPath}`);
      }

      // Start discovery stage
      this.processingTimeTracker.startStage(operationId, 'file_discovery');
      
      // Discover files
      const files = await this.discoverFiles(folderPath);
      job.totalFiles = files.length;
      
      this.processingTimeTracker.endStage(operationId, 'file_discovery');

      if (files.length === 0) {
        job.status = 'completed';
        job.endTime = Date.now();
        
        this.processingTimeTracker.endOperation(operationId, true, { message: 'No files found' });
        this.performanceMetrics.endOperation(operationId, true, { filesProcessed: 0 });
        
        return this.getJobResult(job);
      }

      // Start processing stage
      this.processingTimeTracker.startStage(operationId, 'file_processing');
      
      // Process files with concurrency control
      const results = await this.processFilesWithConcurrency(files, userPineconeId, job, operationId);
      
      this.processingTimeTracker.endStage(operationId, 'file_processing');

      // Update job status
      job.status = 'completed';
      job.endTime = Date.now();
      job.results = results.successful;
      job.errors = results.failed;
      job.successfulFiles = results.successful.length;
      job.failedFiles = results.failed.length;
      job.processedFiles = results.successful.length + results.failed.length;

      // End tracking
      this.processingTimeTracker.endOperation(operationId, true, {
        totalFiles: job.totalFiles,
        successfulFiles: job.successfulFiles,
        failedFiles: job.failedFiles
      });
      
      this.performanceMetrics.endOperation(operationId, true, {
        filesProcessed: job.processedFiles,
        successRate: job.processedFiles > 0 ? (job.successfulFiles / job.processedFiles) * 100 : 0
      });

      // Move to history
      this.moveJobToHistory(job);

      return this.getJobResult(job);

    } catch (error) {
      const errorInfo = this.errorHandler.handleError(error, 'folder_processing', {
        jobId,
        folderPath,
        userPineconeId
      });

      job.status = 'failed';
      job.endTime = Date.now();
      job.errors.push(errorInfo);

      this.processingTimeTracker.endOperation(operationId, false, { error: error.message });
      this.performanceMetrics.endOperation(operationId, false, { error: error.message });

      this.moveJobToHistory(job);
      throw error;
    }
  }

  /**
   * Discover all supported files in a folder recursively
   * @param {string} folderPath - Path to search
   * @returns {Promise<Array>} Array of file paths
   */
  async discoverFiles(folderPath) {
    const files = [];
    const supportedExtensions = this.config.supportedExtensions || ['.pdf', '.docx', '.html', '.htm', '.txt'];

    const scanDirectory = async (dirPath) => {
      try {
        const entries = await readdir(dirPath);
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry);
          const stats = await stat(fullPath);
          
          if (stats.isDirectory()) {
            // Recursively scan subdirectories
            await scanDirectory(fullPath);
          } else if (stats.isFile()) {
            const ext = path.extname(entry).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              // Check file size
              if (stats.size <= (this.config.maxFileSize || 50 * 1024 * 1024)) {
                files.push(fullPath);
              } else {
                console.warn(`⚠️ Skipping large file: ${fullPath} (${Math.round(stats.size / 1024 / 1024)}MB)`);
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error scanning directory ${dirPath}:`, error.message);
      }
    };

    await scanDirectory(folderPath);
    return files;
  }

  /**
   * Process files with concurrency control
   * @param {Array} files - Array of file paths
   * @param {string} userPineconeId - User's Pinecone ID
   * @param {Object} job - Job object
   * @param {string} operationId - Operation ID for tracking
   * @returns {Promise<Object>} Processing results
   */
  async processFilesWithConcurrency(files, userPineconeId, job, operationId) {
    const maxConcurrent = this.config.maxConcurrentFiles || 3;
    const results = { successful: [], failed: [] };
    
    // Process files in batches
    for (let i = 0; i < files.length; i += maxConcurrent) {
      const batch = files.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(filePath => 
        this.processFile(filePath, userPineconeId, job, operationId)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        const filePath = batch[index];
        
        if (result.status === 'fulfilled') {
          results.successful.push({
            filePath,
            fileName: path.basename(filePath),
            ...result.value
          });
        } else {
          results.failed.push({
            filePath,
            fileName: path.basename(filePath),
            error: result.reason.message || 'Unknown error'
          });
        }
      });
      
      // Update job progress
      job.processedFiles = results.successful.length + results.failed.length;
      job.successfulFiles = results.successful.length;
      job.failedFiles = results.failed.length;
    }
    
    return results;
  }

  /**
   * Process a single file
   * @param {string} filePath - Path to the file
   * @param {string} userPineconeId - User's Pinecone ID
   * @param {Object} job - Job object
   * @param {string} operationId - Operation ID for tracking
   * @returns {Promise<Object>} Processing result
   */
  async processFile(filePath, userPineconeId, job, operationId) {
    const fileOperationId = `${operationId}_file_${path.basename(filePath)}`;
    
    try {
      this.processingTimeTracker.startOperation(fileOperationId, 'file_processing', {
        filePath,
        userPineconeId
      });

      const result = await advancedDocumentService.processDocument(filePath, userPineconeId, {
        originalPath: filePath,
        processedBy: 'DataFolderProcessor',
        jobId: job.jobId
      });

      this.processingTimeTracker.endOperation(fileOperationId, true, result);
      
      return result;
      
    } catch (error) {
      this.errorHandler.handleError(error, 'file_processing', {
        filePath,
        userPineconeId,
        jobId: job.jobId
      });
      
      this.processingTimeTracker.endOperation(fileOperationId, false, { error: error.message });
      
      throw error;
    }
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Object|null} Job status or null if not found
   */
  getJobStatus(jobId) {
    const activeJob = this.processingJobs.get(jobId);
    if (activeJob) {
      return this.getJobResult(activeJob);
    }
    
    const historicalJob = this.jobHistory.find(job => job.jobId === jobId);
    if (historicalJob) {
      return this.getJobResult(historicalJob);
    }
    
    return null;
  }

  /**
   * Get all jobs for a user
   * @param {string} userPineconeId - User's Pinecone ID
   * @param {Object} options - Query options
   * @returns {Array} Array of jobs
   */
  getUserJobs(userPineconeId, options = {}) {
    const { page = 1, limit = 10, status } = options;
    
    // Combine active and historical jobs
    const allJobs = [
      ...Array.from(this.processingJobs.values()),
      ...this.jobHistory
    ].filter(job => job.userPineconeId === userPineconeId);
    
    // Filter by status if specified
    let filteredJobs = allJobs;
    if (status) {
      filteredJobs = allJobs.filter(job => job.status === status);
    }
    
    // Sort by start time (newest first)
    filteredJobs.sort((a, b) => b.startTime - a.startTime);
    
    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedJobs = filteredJobs.slice(startIndex, endIndex);
    
    return {
      jobs: paginatedJobs.map(job => this.getJobResult(job)),
      count: paginatedJobs.length,
      total: filteredJobs.length,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(filteredJobs.length / limit)
      }
    };
  }

  /**
   * Cancel a processing job
   * @param {string} jobId - Job ID to cancel
   * @returns {boolean} True if cancelled, false if not found or already completed
   */
  cancelJob(jobId) {
    const job = this.processingJobs.get(jobId);
    if (!job || job.status !== 'processing') {
      return false;
    }
    
    job.status = 'cancelled';
    job.endTime = Date.now();
    
    // End tracking
    this.processingTimeTracker.endOperation(job.operationId, false, { reason: 'cancelled' });
    this.performanceMetrics.endOperation(job.operationId, false, { reason: 'cancelled' });
    
    this.moveJobToHistory(job);
    return true;
  }

  /**
   * Move job from active to history
   * @param {Object} job - Job to move
   */
  moveJobToHistory(job) {
    this.processingJobs.delete(job.jobId);
    this.jobHistory.push({ ...job });
    
    // Keep history size manageable
    if (this.jobHistory.length > this.maxHistorySize) {
      this.jobHistory.shift();
    }
  }

  /**
   * Get formatted job result
   * @param {Object} job - Job object
   * @returns {Object} Formatted job result
   */
  getJobResult(job) {
    return {
      jobId: job.jobId,
      folderPath: job.folderPath,
      status: job.status,
      startTime: job.startTime,
      endTime: job.endTime,
      duration: job.endTime ? job.endTime - job.startTime : Date.now() - job.startTime,
      progress: {
        totalFiles: job.totalFiles,
        processedFiles: job.processedFiles,
        successfulFiles: job.successfulFiles,
        failedFiles: job.failedFiles,
        percentage: job.totalFiles > 0 ? Math.round((job.processedFiles / job.totalFiles) * 100) : 0
      },
      results: job.results || [],
      errors: job.errors || [],
      options: job.options || {}
    };
  }

  /**
   * Get processing statistics
   * @returns {Object} Processing statistics
   */
  getProcessingStats() {
    const allJobs = [
      ...Array.from(this.processingJobs.values()),
      ...this.jobHistory
    ];
    
    const completedJobs = allJobs.filter(job => job.status === 'completed');
    const failedJobs = allJobs.filter(job => job.status === 'failed');
    const cancelledJobs = allJobs.filter(job => job.status === 'cancelled');
    
    const totalFiles = allJobs.reduce((sum, job) => sum + (job.totalFiles || 0), 0);
    const successfulFiles = allJobs.reduce((sum, job) => sum + (job.successfulFiles || 0), 0);
    const failedFiles = allJobs.reduce((sum, job) => sum + (job.failedFiles || 0), 0);
    
    return {
      jobs: {
        total: allJobs.length,
        active: this.processingJobs.size,
        completed: completedJobs.length,
        failed: failedJobs.length,
        cancelled: cancelledJobs.length
      },
      files: {
        total: totalFiles,
        successful: successfulFiles,
        failed: failedFiles,
        successRate: totalFiles > 0 ? Math.round((successfulFiles / totalFiles) * 100) : 0
      },
      performance: this.processingTimeTracker.getPerformanceReport(),
      recentJobs: allJobs.slice(-5).map(job => this.getJobResult(job))
    };
  }

  /**
   * Clear completed jobs from history
   * @param {number} olderThanDays - Clear jobs older than specified days
   */
  clearHistory(olderThanDays = 7) {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const initialCount = this.jobHistory.length;
    
    this.jobHistory = this.jobHistory.filter(job => 
      job.endTime && job.endTime > cutoffTime
    );
    
    const clearedCount = initialCount - this.jobHistory.length;
    console.log(`🧹 DataFolderProcessor: Cleared ${clearedCount} old jobs from history`);
    
    return clearedCount;
  }
}

module.exports = new DataFolderProcessor();