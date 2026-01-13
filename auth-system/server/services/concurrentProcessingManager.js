const EventEmitter = require('events');
const os = require('os');

/**
 * Concurrent Processing Manager
 * Handles multiple file processing operations with resource management and monitoring
 */
class ConcurrentProcessingManager extends EventEmitter {
  constructor() {
    super();
    
    // Configuration based on system resources
    const cpuCount = os.cpus().length;
    const totalMemory = os.totalmem();
    
    this.config = {
      // Concurrency limits
      maxConcurrentJobs: Math.min(cpuCount * 2, 10), // 2x CPU cores, max 10
      maxConcurrentDocuments: Math.min(cpuCount, 5), // 1x CPU cores, max 5
      maxConcurrentChunks: Math.min(cpuCount * 3, 15), // 3x CPU cores, max 15
      maxConcurrentEmbeddings: Math.min(cpuCount * 2, 8), // 2x CPU cores, max 8
      
      // Resource limits
      maxMemoryUsage: Math.floor(totalMemory * 0.7), // 70% of total memory
      maxQueueSize: 100, // Maximum jobs in queue
      
      // Timeouts and retries
      jobTimeout: 5 * 60 * 1000, // 5 minutes per job
      retryAttempts: 2,
      retryDelay: 1000, // 1 second base delay
      
      // Monitoring
      metricsInterval: 30000, // 30 seconds
      cleanupInterval: 60000, // 1 minute
      
      // Priority levels
      priorities: {
        HIGH: 3,
        NORMAL: 2,
        LOW: 1
      }
    };
    
    // State management
    this.state = {
      // Active processing counters
      activeJobs: 0,
      activeDocuments: 0,
      activeChunks: 0,
      activeEmbeddings: 0,
      
      // Queues with priority support
      jobQueue: [],
      documentQueue: [],
      chunkQueue: [],
      embeddingQueue: [],
      
      // Job tracking
      jobs: new Map(), // jobId -> JobInfo
      completedJobs: new Map(), // jobId -> CompletedJobInfo
      
      // Resource monitoring
      memoryUsage: 0,
      cpuUsage: 0,
      
      // Statistics
      stats: {
        totalJobsProcessed: 0,
        totalJobsSucceeded: 0,
        totalJobsFailed: 0,
        totalProcessingTime: 0,
        avgProcessingTime: 0,
        peakConcurrency: 0,
        peakMemoryUsage: 0
      }
    };
    
    // Start monitoring
    this.startMonitoring();
    
    console.log('🚀 Concurrent Processing Manager initialized');
    console.log(`   Max concurrent jobs: ${this.config.maxConcurrentJobs}`);
    console.log(`   Max memory usage: ${Math.round(this.config.maxMemoryUsage / 1024 / 1024)}MB`);
  }

  /**
   * Submit a processing job
   * @param {Object} jobConfig - Job configuration
   * @returns {Promise<string>} Job ID
   */
  async submitJob(jobConfig) {
    const jobId = this.generateJobId();
    
    // Validate job configuration
    this.validateJobConfig(jobConfig);
    
    // Check queue capacity
    if (this.state.jobQueue.length >= this.config.maxQueueSize) {
      throw new Error('Processing queue is full. Please try again later.');
    }
    
    const job = {
      id: jobId,
      type: jobConfig.type || 'document_processing',
      priority: jobConfig.priority || this.config.priorities.NORMAL,
      userId: jobConfig.userId,
      files: jobConfig.files || [],
      options: jobConfig.options || {},
      
      // Timing
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      
      // Status
      status: 'queued',
      progress: 0,
      currentStep: 'queued',
      
      // Results
      results: [],
      errors: [],
      
      // Retry logic
      attempts: 0,
      maxAttempts: this.config.retryAttempts + 1,
      
      // Timeout handling
      timeoutId: null,
      
      // Processing function
      processor: jobConfig.processor
    };
    
    // Store job
    this.state.jobs.set(jobId, job);
    
    // Add to queue with priority sorting
    this.addToQueue(this.state.jobQueue, job);
    
    // Emit job queued event
    this.emit('jobQueued', { jobId, job });
    
    // Try to process immediately
    setImmediate(() => this.processQueues());
    
    console.log(`📋 Job ${jobId} queued (priority: ${job.priority}, files: ${job.files.length})`);
    
    return jobId;
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Object} Job status
   */
  getJobStatus(jobId) {
    const job = this.state.jobs.get(jobId) || this.state.completedJobs.get(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      processingTime: job.completedAt ? job.completedAt - job.startedAt : 
                     job.startedAt ? Date.now() - job.startedAt : 0,
      results: job.results,
      errors: job.errors,
      attempts: job.attempts
    };
  }

  /**
   * Cancel a job
   * @param {string} jobId - Job ID
   * @returns {boolean} Success
   */
  async cancelJob(jobId) {
    const job = this.state.jobs.get(jobId);
    
    if (!job) {
      return false;
    }
    
    if (job.status === 'completed' || job.status === 'failed') {
      return false; // Already finished
    }
    
    // Clear timeout
    if (job.timeoutId) {
      clearTimeout(job.timeoutId);
    }
    
    // Update job status
    job.status = 'cancelled';
    job.completedAt = Date.now();
    job.currentStep = 'cancelled';
    
    // Remove from queues
    this.removeFromQueue(this.state.jobQueue, jobId);
    
    // Move to completed jobs
    this.state.completedJobs.set(jobId, job);
    this.state.jobs.delete(jobId);
    
    // Emit event
    this.emit('jobCancelled', { jobId, job });
    
    console.log(`❌ Job ${jobId} cancelled`);
    
    return true;
  }

  /**
   * Pause processing (stops accepting new jobs)
   */
  pauseProcessing() {
    this.paused = true;
    this.emit('processingPaused');
    console.log('⏸️ Processing paused');
  }

  /**
   * Resume processing
   */
  resumeProcessing() {
    this.paused = false;
    this.emit('processingResumed');
    setImmediate(() => this.processQueues());
    console.log('▶️ Processing resumed');
  }

  /**
   * Get system status
   */
  getStatus() {
    const memoryUsage = process.memoryUsage();
    
    return {
      // Configuration
      config: {
        maxConcurrentJobs: this.config.maxConcurrentJobs,
        maxMemoryUsage: Math.round(this.config.maxMemoryUsage / 1024 / 1024) + 'MB',
        maxQueueSize: this.config.maxQueueSize
      },
      
      // Current state
      state: {
        paused: this.paused || false,
        activeJobs: this.state.activeJobs,
        queuedJobs: this.state.jobQueue.length,
        totalJobs: this.state.jobs.size,
        completedJobs: this.state.completedJobs.size
      },
      
      // Resource usage
      resources: {
        memoryUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        memoryTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        memoryLimit: Math.round(this.config.maxMemoryUsage / 1024 / 1024) + 'MB',
        cpuCores: os.cpus().length
      },
      
      // Statistics
      stats: this.state.stats,
      
      // Queue details
      queues: {
        jobs: this.state.jobQueue.length,
        documents: this.state.documentQueue.length,
        chunks: this.state.chunkQueue.length,
        embeddings: this.state.embeddingQueue.length
      }
    };
  }

  /**
   * Process all queues
   */
  async processQueues() {
    if (this.paused) return;
    
    // Process job queue
    while (this.state.jobQueue.length > 0 && 
           this.state.activeJobs < this.config.maxConcurrentJobs &&
           this.checkResourceLimits()) {
      
      const job = this.state.jobQueue.shift();
      await this.startJob(job);
    }
    
    // Process other queues
    this.processDocumentQueue();
    this.processChunkQueue();
    this.processEmbeddingQueue();
  }

  /**
   * Start processing a job
   */
  async startJob(job) {
    try {
      this.state.activeJobs++;
      this.state.stats.peakConcurrency = Math.max(
        this.state.stats.peakConcurrency, 
        this.state.activeJobs
      );
      
      job.status = 'processing';
      job.startedAt = Date.now();
      job.attempts++;
      
      // Set timeout
      job.timeoutId = setTimeout(() => {
        this.handleJobTimeout(job);
      }, this.config.jobTimeout);
      
      // Emit job started event
      this.emit('jobStarted', { jobId: job.id, job });
      
      console.log(`🔄 Starting job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
      
      // Process job
      const result = await this.executeJob(job);
      
      // Job completed successfully
      await this.completeJob(job, result);
      
    } catch (error) {
      // Job failed
      await this.failJob(job, error);
    }
  }

  /**
   * Execute a job
   */
  async executeJob(job) {
    if (!job.processor || typeof job.processor !== 'function') {
      throw new Error('No processor function provided for job');
    }
    
    // Create job context
    const context = {
      jobId: job.id,
      updateProgress: (progress, step) => this.updateJobProgress(job.id, progress, step),
      checkCancellation: () => job.status === 'cancelled',
      acquireDocumentSlot: () => this.acquireDocumentSlot(),
      releaseDocumentSlot: () => this.releaseDocumentSlot(),
      acquireChunkSlot: () => this.acquireChunkSlot(),
      releaseChunkSlot: () => this.releaseChunkSlot(),
      acquireEmbeddingSlot: () => this.acquireEmbeddingSlot(),
      releaseEmbeddingSlot: () => this.releaseEmbeddingSlot()
    };
    
    // Execute the processor function
    return await job.processor(job.files, job.options, context);
  }

  /**
   * Complete a job successfully
   */
  async completeJob(job, result) {
    // Clear timeout
    if (job.timeoutId) {
      clearTimeout(job.timeoutId);
    }
    
    job.status = 'completed';
    job.completedAt = Date.now();
    job.progress = 100;
    job.currentStep = 'completed';
    job.results = result;
    
    const processingTime = job.completedAt - job.startedAt;
    
    // Update statistics
    this.state.stats.totalJobsProcessed++;
    this.state.stats.totalJobsSucceeded++;
    this.state.stats.totalProcessingTime += processingTime;
    this.state.stats.avgProcessingTime = 
      this.state.stats.totalProcessingTime / this.state.stats.totalJobsProcessed;
    
    // Move to completed jobs
    this.state.completedJobs.set(job.id, job);
    this.state.jobs.delete(job.id);
    
    // Decrease active count
    this.state.activeJobs--;
    
    // Emit event
    this.emit('jobCompleted', { jobId: job.id, job, result, processingTime });
    
    console.log(`✅ Job ${job.id} completed in ${processingTime}ms`);
    
    // Process next jobs
    setImmediate(() => this.processQueues());
  }

  /**
   * Fail a job
   */
  async failJob(job, error) {
    // Clear timeout
    if (job.timeoutId) {
      clearTimeout(job.timeoutId);
    }
    
    job.errors.push({
      attempt: job.attempts,
      error: error.message,
      timestamp: Date.now()
    });
    
    // Check if we should retry
    if (job.attempts < job.maxAttempts && !this.isNonRetryableError(error)) {
      // Retry the job
      job.status = 'retrying';
      job.currentStep = `retrying (attempt ${job.attempts + 1})`;
      
      // Add back to queue with delay
      setTimeout(() => {
        if (job.status === 'retrying') { // Check if not cancelled
          this.addToQueue(this.state.jobQueue, job);
          setImmediate(() => this.processQueues());
        }
      }, this.config.retryDelay * job.attempts);
      
      console.log(`🔄 Job ${job.id} will retry (attempt ${job.attempts + 1}/${job.maxAttempts})`);
      
    } else {
      // Job failed permanently
      job.status = 'failed';
      job.completedAt = Date.now();
      job.currentStep = 'failed';
      
      // Update statistics
      this.state.stats.totalJobsProcessed++;
      this.state.stats.totalJobsFailed++;
      
      // Move to completed jobs
      this.state.completedJobs.set(job.id, job);
      this.state.jobs.delete(job.id);
      
      // Emit event
      this.emit('jobFailed', { jobId: job.id, job, error });
      
      console.log(`❌ Job ${job.id} failed permanently: ${error.message}`);
    }
    
    // Decrease active count
    this.state.activeJobs--;
    
    // Process next jobs
    setImmediate(() => this.processQueues());
  }

  /**
   * Handle job timeout
   */
  handleJobTimeout(job) {
    if (job.status === 'processing') {
      const error = new Error(`Job timed out after ${this.config.jobTimeout}ms`);
      this.failJob(job, error);
    }
  }

  /**
   * Update job progress
   */
  updateJobProgress(jobId, progress, step) {
    const job = this.state.jobs.get(jobId);
    if (job) {
      job.progress = Math.min(100, Math.max(0, progress));
      if (step) job.currentStep = step;
      
      this.emit('jobProgress', { jobId, progress: job.progress, step: job.currentStep });
    }
  }

  // Resource slot management methods
  async acquireDocumentSlot() {
    return new Promise((resolve) => {
      if (this.state.activeDocuments < this.config.maxConcurrentDocuments) {
        this.state.activeDocuments++;
        resolve();
      } else {
        this.state.documentQueue.push({ resolve });
      }
    });
  }

  releaseDocumentSlot() {
    this.state.activeDocuments = Math.max(0, this.state.activeDocuments - 1);
    this.processDocumentQueue();
  }

  processDocumentQueue() {
    while (this.state.documentQueue.length > 0 && 
           this.state.activeDocuments < this.config.maxConcurrentDocuments) {
      const queuedOperation = this.state.documentQueue.shift();
      this.state.activeDocuments++;
      queuedOperation.resolve();
    }
  }

  async acquireChunkSlot() {
    return new Promise((resolve) => {
      if (this.state.activeChunks < this.config.maxConcurrentChunks) {
        this.state.activeChunks++;
        resolve();
      } else {
        this.state.chunkQueue.push({ resolve });
      }
    });
  }

  releaseChunkSlot() {
    this.state.activeChunks = Math.max(0, this.state.activeChunks - 1);
    this.processChunkQueue();
  }

  processChunkQueue() {
    while (this.state.chunkQueue.length > 0 && 
           this.state.activeChunks < this.config.maxConcurrentChunks) {
      const queuedOperation = this.state.chunkQueue.shift();
      this.state.activeChunks++;
      queuedOperation.resolve();
    }
  }

  async acquireEmbeddingSlot() {
    return new Promise((resolve) => {
      if (this.state.activeEmbeddings < this.config.maxConcurrentEmbeddings) {
        this.state.activeEmbeddings++;
        resolve();
      } else {
        this.state.embeddingQueue.push({ resolve });
      }
    });
  }

  releaseEmbeddingSlot() {
    this.state.activeEmbeddings = Math.max(0, this.state.activeEmbeddings - 1);
    this.processEmbeddingQueue();
  }

  processEmbeddingQueue() {
    while (this.state.embeddingQueue.length > 0 && 
           this.state.activeEmbeddings < this.config.maxConcurrentEmbeddings) {
      const queuedOperation = this.state.embeddingQueue.shift();
      this.state.activeEmbeddings++;
      queuedOperation.resolve();
    }
  }

  // Utility methods
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  validateJobConfig(config) {
    if (!config.processor || typeof config.processor !== 'function') {
      throw new Error('Job processor function is required');
    }
    
    if (!config.userId) {
      throw new Error('User ID is required');
    }
    
    if (!Array.isArray(config.files)) {
      throw new Error('Files array is required');
    }
  }

  addToQueue(queue, item) {
    // Insert with priority (higher priority first)
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (item.priority > queue[i].priority) {
        queue.splice(i, 0, item);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      queue.push(item);
    }
  }

  removeFromQueue(queue, jobId) {
    const index = queue.findIndex(item => item.id === jobId);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }

  checkResourceLimits() {
    const memoryUsage = process.memoryUsage();
    return memoryUsage.heapUsed < this.config.maxMemoryUsage;
  }

  isNonRetryableError(error) {
    const nonRetryableMessages = [
      'validation failed',
      'file not found',
      'permission denied',
      'invalid file format',
      'user not found'
    ];
    
    const message = error.message.toLowerCase();
    return nonRetryableMessages.some(msg => message.includes(msg));
  }

  startMonitoring() {
    // Metrics collection
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      this.state.memoryUsage = memoryUsage.heapUsed;
      this.state.stats.peakMemoryUsage = Math.max(
        this.state.stats.peakMemoryUsage,
        memoryUsage.heapUsed
      );
      
      this.emit('metrics', {
        memoryUsage: memoryUsage.heapUsed,
        activeJobs: this.state.activeJobs,
        queuedJobs: this.state.jobQueue.length
      });
    }, this.config.metricsInterval);
    
    // Cleanup completed jobs
    setInterval(() => {
      this.cleanupCompletedJobs();
    }, this.config.cleanupInterval);
  }

  cleanupCompletedJobs() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    let cleaned = 0;
    
    for (const [jobId, job] of this.state.completedJobs.entries()) {
      if (job.completedAt && job.completedAt < cutoffTime) {
        this.state.completedJobs.delete(jobId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old completed jobs`);
    }
  }
}

module.exports = new ConcurrentProcessingManager();