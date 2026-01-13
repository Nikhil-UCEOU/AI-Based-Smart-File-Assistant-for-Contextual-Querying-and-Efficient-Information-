const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Upload Queue Manager
 * Manages persistent upload queues with drag-and-drop reordering and pause/resume capabilities
 */
class UploadQueueManager extends EventEmitter {
  constructor() {
    super();
    
    this.config = {
      // Storage configuration
      queueStoragePath: path.join(__dirname, '../uploads/queues'),
      maxQueueSize: 100,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      
      // Auto-save configuration
      autoSaveInterval: 5000, // 5 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      
      // Queue states
      states: {
        PENDING: 'pending',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        FAILED: 'failed',
        PAUSED: 'paused',
        CANCELLED: 'cancelled'
      }
    };
    
    // In-memory queue storage
    this.queues = new Map(); // userId -> QueueData
    this.processingJobs = new Map(); // queueId -> ProcessingJob
    
    // Initialize storage
    this.initializeStorage();
    
    // Start auto-save
    this.startAutoSave();
    
    console.log('📋 Upload Queue Manager initialized');
  }

  /**
   * Initialize storage directory
   */
  async initializeStorage() {
    try {
      await fs.mkdir(this.config.queueStoragePath, { recursive: true });
      await this.loadPersistedQueues();
    } catch (error) {
      console.error('Failed to initialize queue storage:', error);
    }
  }

  /**
   * Create a new upload queue for a user
   */
  async createQueue(userId, queueName = 'default') {
    const queueId = this.generateQueueId(userId, queueName);
    
    const queueData = {
      id: queueId,
      userId: userId,
      name: queueName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: this.config.states.PENDING,
      
      // Queue items
      items: [],
      totalItems: 0,
      completedItems: 0,
      failedItems: 0,
      
      // Processing configuration
      concurrentProcessing: true,
      maxConcurrentFiles: 3,
      
      // Metadata
      totalSize: 0,
      estimatedProcessingTime: 0,
      
      // Progress tracking
      progress: 0,
      currentStep: 'created',
      
      // Error tracking
      errors: [],
      warnings: []
    };
    
    // Store in memory
    if (!this.queues.has(userId)) {
      this.queues.set(userId, new Map());
    }
    this.queues.get(userId).set(queueName, queueData);
    
    // Persist to disk
    await this.persistQueue(queueData);
    
    // Emit event
    this.emit('queueCreated', { queueId, queueData });
    
    console.log(`📋 Created queue ${queueId} for user ${userId}`);
    
    return queueId;
  }

  /**
   * Add files to a queue
   */
  async addFilesToQueue(userId, queueName, files) {
    const userQueues = this.queues.get(userId);
    if (!userQueues || !userQueues.has(queueName)) {
      throw new Error(`Queue ${queueName} not found for user ${userId}`);
    }
    
    const queueData = userQueues.get(queueName);
    
    // Validate queue capacity
    if (queueData.items.length + files.length > this.config.maxQueueSize) {
      throw new Error(`Queue capacity exceeded. Maximum ${this.config.maxQueueSize} files allowed.`);
    }
    
    const queueItems = [];
    let totalSize = 0;
    
    for (const file of files) {
      // Validate file size
      if (file.size > this.config.maxFileSize) {
        throw new Error(`File ${file.originalname} exceeds maximum size of ${this.config.maxFileSize} bytes`);
      }
      
      const queueItem = {
        id: this.generateItemId(),
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        
        // Queue position
        position: queueData.items.length + queueItems.length,
        
        // Status
        status: this.config.states.PENDING,
        progress: 0,
        
        // Timing
        addedAt: Date.now(),
        startedAt: null,
        completedAt: null,
        processingTime: 0,
        
        // Results
        result: null,
        error: null,
        
        // Retry logic
        attempts: 0,
        maxAttempts: this.config.maxRetries,
        
        // Metadata
        hash: await this.calculateFileHash(file.path),
        validationResult: null
      };
      
      queueItems.push(queueItem);
      totalSize += file.size;
    }
    
    // Add items to queue
    queueData.items.push(...queueItems);
    queueData.totalItems = queueData.items.length;
    queueData.totalSize += totalSize;
    queueData.updatedAt = Date.now();
    
    // Estimate processing time (rough estimate: 2 seconds per file)
    queueData.estimatedProcessingTime = queueData.totalItems * 2000;
    
    // Persist changes
    await this.persistQueue(queueData);
    
    // Emit event
    this.emit('filesAdded', { 
      queueId: queueData.id, 
      addedFiles: queueItems.length,
      totalFiles: queueData.totalItems 
    });
    
    console.log(`📋 Added ${queueItems.length} files to queue ${queueData.id}`);
    
    return queueItems;
  }

  /**
   * Reorder queue items (drag-and-drop support)
   */
  async reorderQueue(userId, queueName, itemId, newPosition) {
    const userQueues = this.queues.get(userId);
    if (!userQueues || !userQueues.has(queueName)) {
      throw new Error(`Queue ${queueName} not found for user ${userId}`);
    }
    
    const queueData = userQueues.get(queueName);
    
    // Find the item to move
    const itemIndex = queueData.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error(`Item ${itemId} not found in queue`);
    }
    
    // Validate new position
    if (newPosition < 0 || newPosition >= queueData.items.length) {
      throw new Error(`Invalid position ${newPosition}`);
    }
    
    // Don't allow reordering of processing/completed items
    const item = queueData.items[itemIndex];
    if (item.status !== this.config.states.PENDING) {
      throw new Error(`Cannot reorder item with status ${item.status}`);
    }
    
    // Remove item from current position
    const [movedItem] = queueData.items.splice(itemIndex, 1);
    
    // Insert at new position
    queueData.items.splice(newPosition, 0, movedItem);
    
    // Update positions
    queueData.items.forEach((item, index) => {
      item.position = index;
    });
    
    queueData.updatedAt = Date.now();
    
    // Persist changes
    await this.persistQueue(queueData);
    
    // Emit event
    this.emit('queueReordered', { 
      queueId: queueData.id, 
      itemId, 
      oldPosition: itemIndex, 
      newPosition 
    });
    
    console.log(`📋 Reordered item ${itemId} from position ${itemIndex} to ${newPosition}`);
    
    return queueData.items;
  }

  /**
   * Pause queue processing
   */
  async pauseQueue(userId, queueName) {
    const userQueues = this.queues.get(userId);
    if (!userQueues || !userQueues.has(queueName)) {
      throw new Error(`Queue ${queueName} not found for user ${userId}`);
    }
    
    const queueData = userQueues.get(queueName);
    
    if (queueData.state === this.config.states.PAUSED) {
      return queueData; // Already paused
    }
    
    queueData.state = this.config.states.PAUSED;
    queueData.currentStep = 'paused';
    queueData.updatedAt = Date.now();
    
    // Persist changes
    await this.persistQueue(queueData);
    
    // Emit event
    this.emit('queuePaused', { queueId: queueData.id });
    
    console.log(`⏸️ Paused queue ${queueData.id}`);
    
    return queueData;
  }

  /**
   * Resume queue processing
   */
  async resumeQueue(userId, queueName) {
    const userQueues = this.queues.get(userId);
    if (!userQueues || !userQueues.has(queueName)) {
      throw new Error(`Queue ${queueName} not found for user ${userId}`);
    }
    
    const queueData = userQueues.get(queueName);
    
    if (queueData.state !== this.config.states.PAUSED) {
      return queueData; // Not paused
    }
    
    queueData.state = this.config.states.PENDING;
    queueData.currentStep = 'resumed';
    queueData.updatedAt = Date.now();
    
    // Persist changes
    await this.persistQueue(queueData);
    
    // Emit event
    this.emit('queueResumed', { queueId: queueData.id });
    
    console.log(`▶️ Resumed queue ${queueData.id}`);
    
    return queueData;
  }

  /**
   * Get queue status
   */
  getQueueStatus(userId, queueName) {
    const userQueues = this.queues.get(userId);
    if (!userQueues || !userQueues.has(queueName)) {
      throw new Error(`Queue ${queueName} not found for user ${userId}`);
    }
    
    const queueData = userQueues.get(queueName);
    
    // Calculate current progress
    const completedItems = queueData.items.filter(item => 
      item.status === this.config.states.COMPLETED
    ).length;
    const failedItems = queueData.items.filter(item => 
      item.status === this.config.states.FAILED
    ).length;
    const processingItems = queueData.items.filter(item => 
      item.status === this.config.states.PROCESSING
    ).length;
    
    queueData.completedItems = completedItems;
    queueData.failedItems = failedItems;
    queueData.progress = queueData.totalItems > 0 ? 
      Math.round((completedItems / queueData.totalItems) * 100) : 0;
    
    return {
      id: queueData.id,
      name: queueData.name,
      state: queueData.state,
      progress: queueData.progress,
      currentStep: queueData.currentStep,
      
      // Counts
      totalItems: queueData.totalItems,
      completedItems: completedItems,
      failedItems: failedItems,
      processingItems: processingItems,
      pendingItems: queueData.totalItems - completedItems - failedItems - processingItems,
      
      // Timing
      createdAt: queueData.createdAt,
      updatedAt: queueData.updatedAt,
      estimatedProcessingTime: queueData.estimatedProcessingTime,
      
      // Size
      totalSize: queueData.totalSize,
      
      // Items
      items: queueData.items.map(item => ({
        id: item.id,
        fileName: item.fileName,
        fileSize: item.fileSize,
        status: item.status,
        progress: item.progress,
        position: item.position,
        error: item.error,
        processingTime: item.processingTime
      })),
      
      // Errors and warnings
      errors: queueData.errors,
      warnings: queueData.warnings
    };
  }

  /**
   * Get all queues for a user
   */
  getUserQueues(userId) {
    const userQueues = this.queues.get(userId);
    if (!userQueues) {
      return [];
    }
    
    const queues = [];
    for (const [queueName, queueData] of userQueues.entries()) {
      queues.push(this.getQueueStatus(userId, queueName));
    }
    
    return queues;
  }

  /**
   * Remove completed items from queue
   */
  async cleanupQueue(userId, queueName) {
    const userQueues = this.queues.get(userId);
    if (!userQueues || !userQueues.has(queueName)) {
      throw new Error(`Queue ${queueName} not found for user ${userId}`);
    }
    
    const queueData = userQueues.get(queueName);
    
    // Remove completed and failed items
    const itemsToRemove = queueData.items.filter(item => 
      item.status === this.config.states.COMPLETED || 
      item.status === this.config.states.FAILED
    );
    
    queueData.items = queueData.items.filter(item => 
      item.status !== this.config.states.COMPLETED && 
      item.status !== this.config.states.FAILED
    );
    
    // Update positions
    queueData.items.forEach((item, index) => {
      item.position = index;
    });
    
    queueData.totalItems = queueData.items.length;
    queueData.updatedAt = Date.now();
    
    // Persist changes
    await this.persistQueue(queueData);
    
    // Emit event
    this.emit('queueCleaned', { 
      queueId: queueData.id, 
      removedItems: itemsToRemove.length 
    });
    
    console.log(`🧹 Cleaned ${itemsToRemove.length} items from queue ${queueData.id}`);
    
    return queueData;
  }

  // Utility methods
  generateQueueId(userId, queueName) {
    return `queue_${userId}_${queueName}_${Date.now()}`;
  }

  generateItemId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async calculateFileHash(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      console.error('Failed to calculate file hash:', error);
      return null;
    }
  }

  async persistQueue(queueData) {
    try {
      const filePath = path.join(this.config.queueStoragePath, `${queueData.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(queueData, null, 2));
    } catch (error) {
      console.error('Failed to persist queue:', error);
    }
  }

  async loadPersistedQueues() {
    try {
      const files = await fs.readdir(this.config.queueStoragePath);
      const queueFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of queueFiles) {
        try {
          const filePath = path.join(this.config.queueStoragePath, file);
          const queueData = JSON.parse(await fs.readFile(filePath, 'utf8'));
          
          // Restore to memory
          if (!this.queues.has(queueData.userId)) {
            this.queues.set(queueData.userId, new Map());
          }
          this.queues.get(queueData.userId).set(queueData.name, queueData);
          
        } catch (error) {
          console.error(`Failed to load queue from ${file}:`, error);
        }
      }
      
      console.log(`📋 Loaded ${queueFiles.length} persisted queues`);
    } catch (error) {
      console.error('Failed to load persisted queues:', error);
    }
  }

  startAutoSave() {
    setInterval(async () => {
      for (const [userId, userQueues] of this.queues.entries()) {
        for (const [queueName, queueData] of userQueues.entries()) {
          if (queueData.updatedAt > Date.now() - this.config.autoSaveInterval) {
            await this.persistQueue(queueData);
          }
        }
      }
    }, this.config.autoSaveInterval);
  }
}

module.exports = new UploadQueueManager();
