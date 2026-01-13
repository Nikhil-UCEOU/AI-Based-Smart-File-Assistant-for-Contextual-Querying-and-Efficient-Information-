const EventEmitter = require('events');

/**
 * Progress Tracking Service
 * Provides real-time progress updates for file processing operations
 */
class ProgressTrackingService extends EventEmitter {
  constructor() {
    super();
    
    this.config = {
      // Update intervals
      progressUpdateInterval: 100, // 100ms for smooth updates
      metricsCollectionInterval: 1000, // 1 second
      
      // Storage
      maxProgressHistory: 1000, // Keep last 1000 progress updates
      maxActiveTrackers: 100, // Maximum concurrent progress trackers
      
      // Progress stages
      stages: {
        VALIDATION: 'validation',
        EXTRACTION: 'extraction',
        CHUNKING: 'chunking',
        EMBEDDING: 'embedding',
        STORAGE: 'storage',
        COMPLETED: 'completed',
        FAILED: 'failed'
      },
      
      // Stage weights for overall progress calculation
      stageWeights: {
        validation: 5,    // 5%
        extraction: 20,   // 20%
        chunking: 15,     // 15%
        embedding: 45,    // 45%
        storage: 15       // 15%
      }
    };
    
    // Active progress trackers
    this.trackers = new Map(); // trackerId -> ProgressTracker
    
    // Progress history for analytics
    this.progressHistory = [];
    
    // Metrics
    this.metrics = {
      totalTrackers: 0,
      activeTrackers: 0,
      completedTrackers: 0,
      failedTrackers: 0,
      avgCompletionTime: 0,
      totalProgressUpdates: 0
    };
    
    console.log('📊 Progress Tracking Service initialized');
  }

  /**
   * Create a new progress tracker
   */
  createTracker(trackerId, config = {}) {
    if (this.trackers.has(trackerId)) {
      throw new Error(`Progress tracker ${trackerId} already exists`);
    }
    
    if (this.trackers.size >= this.config.maxActiveTrackers) {
      throw new Error('Maximum number of active trackers reached');
    }
    
    const tracker = {
      id: trackerId,
      userId: config.userId,
      jobId: config.jobId,
      fileName: config.fileName || 'Unknown',
      fileSize: config.fileSize || 0,
      
      // Progress state
      currentStage: this.config.stages.VALIDATION,
      overallProgress: 0,
      stageProgress: 0,
      
      // Stage-specific progress
      stageProgresses: {
        validation: 0,
        extraction: 0,
        chunking: 0,
        embedding: 0,
        storage: 0
      },
      
      // Timing
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      stageStartTime: Date.now(),
      estimatedCompletionTime: null,
      
      // Status
      status: 'active',
      message: 'Starting...',
      error: null,
      
      // Metrics
      updateCount: 0,
      processingRate: 0, // items per second
      
      // Configuration
      enableRealTimeUpdates: config.enableRealTimeUpdates !== false,
      updateInterval: config.updateInterval || this.config.progressUpdateInterval
    };
    
    this.trackers.set(trackerId, tracker);
    this.metrics.totalTrackers++;
    this.metrics.activeTrackers++;
    
    // Emit tracker created event
    this.emit('trackerCreated', { trackerId, tracker });
    
    console.log(`📊 Created progress tracker ${trackerId} for ${tracker.fileName}`);
    
    return tracker;
  }

  /**
   * Update progress for a specific stage
   */
  updateStageProgress(trackerId, stage, progress, message = null) {
    const tracker = this.trackers.get(trackerId);
    if (!tracker) {
      throw new Error(`Progress tracker ${trackerId} not found`);
    }
    
    if (!this.config.stages[stage.toUpperCase()]) {
      throw new Error(`Invalid stage: ${stage}`);
    }
    
    const normalizedStage = stage.toLowerCase();
    
    // Update stage progress
    tracker.stageProgresses[normalizedStage] = Math.min(100, Math.max(0, progress));
    tracker.currentStage = normalizedStage;
    tracker.stageProgress = tracker.stageProgresses[normalizedStage];
    
    // Update timing
    const now = Date.now();
    tracker.lastUpdateTime = now;
    tracker.updateCount++;
    
    // Calculate overall progress based on stage weights
    tracker.overallProgress = this.calculateOverallProgress(tracker);
    
    // Update message
    if (message) {
      tracker.message = message;
    }
    
    // Calculate processing rate
    const elapsedTime = (now - tracker.startTime) / 1000; // seconds
    tracker.processingRate = tracker.updateCount / elapsedTime;
    
    // Estimate completion time
    if (tracker.overallProgress > 0) {
      const remainingProgress = 100 - tracker.overallProgress;
      const avgTimePerPercent = elapsedTime / tracker.overallProgress;
      tracker.estimatedCompletionTime = now + (remainingProgress * avgTimePerPercent * 1000);
    }
    
    // Store in history
    this.addToHistory(trackerId, {
      timestamp: now,
      stage: normalizedStage,
      stageProgress: progress,
      overallProgress: tracker.overallProgress,
      message: tracker.message
    });
    
    // Emit progress update event
    if (tracker.enableRealTimeUpdates) {
      this.emit('progressUpdate', {
        trackerId,
        stage: normalizedStage,
        stageProgress: progress,
        overallProgress: tracker.overallProgress,
        message: tracker.message,
        estimatedCompletionTime: tracker.estimatedCompletionTime
      });
    }
    
    this.metrics.totalProgressUpdates++;
    
    return tracker;
  }

  /**
   * Mark tracker as completed
   */
  completeTracker(trackerId, result = null) {
    const tracker = this.trackers.get(trackerId);
    if (!tracker) {
      throw new Error(`Progress tracker ${trackerId} not found`);
    }
    
    tracker.status = 'completed';
    tracker.currentStage = this.config.stages.COMPLETED;
    tracker.overallProgress = 100;
    tracker.stageProgress = 100;
    tracker.message = 'Processing completed successfully';
    tracker.lastUpdateTime = Date.now();
    
    const completionTime = tracker.lastUpdateTime - tracker.startTime;
    
    // Update metrics
    this.metrics.activeTrackers--;
    this.metrics.completedTrackers++;
    
    // Update average completion time
    const totalCompletedTime = this.metrics.avgCompletionTime * (this.metrics.completedTrackers - 1);
    this.metrics.avgCompletionTime = (totalCompletedTime + completionTime) / this.metrics.completedTrackers;
    
    // Store final result
    this.addToHistory(trackerId, {
      timestamp: tracker.lastUpdateTime,
      stage: 'completed',
      stageProgress: 100,
      overallProgress: 100,
      message: tracker.message,
      result: result,
      completionTime: completionTime
    });
    
    // Emit completion event
    this.emit('trackerCompleted', {
      trackerId,
      tracker,
      result,
      completionTime
    });
    
    console.log(`✅ Progress tracker ${trackerId} completed in ${completionTime}ms`);
    
    // Clean up after delay to allow final status queries
    setTimeout(() => {
      this.trackers.delete(trackerId);
    }, 30000); // Keep for 30 seconds
    
    return tracker;
  }

  /**
   * Mark tracker as failed
   */
  failTracker(trackerId, error) {
    const tracker = this.trackers.get(trackerId);
    if (!tracker) {
      throw new Error(`Progress tracker ${trackerId} not found`);
    }
    
    tracker.status = 'failed';
    tracker.currentStage = this.config.stages.FAILED;
    tracker.error = error.message || error;
    tracker.message = `Processing failed: ${tracker.error}`;
    tracker.lastUpdateTime = Date.now();
    
    const failureTime = tracker.lastUpdateTime - tracker.startTime;
    
    // Update metrics
    this.metrics.activeTrackers--;
    this.metrics.failedTrackers++;
    
    // Store failure info
    this.addToHistory(trackerId, {
      timestamp: tracker.lastUpdateTime,
      stage: 'failed',
      stageProgress: tracker.stageProgress,
      overallProgress: tracker.overallProgress,
      message: tracker.message,
      error: tracker.error,
      failureTime: failureTime
    });
    
    // Emit failure event
    this.emit('trackerFailed', {
      trackerId,
      tracker,
      error: tracker.error,
      failureTime
    });
    
    console.log(`❌ Progress tracker ${trackerId} failed after ${failureTime}ms: ${tracker.error}`);
    
    // Clean up after delay
    setTimeout(() => {
      this.trackers.delete(trackerId);
    }, 60000); // Keep failed trackers longer for debugging
    
    return tracker;
  }

  /**
   * Get tracker status
   */
  getTrackerStatus(trackerId) {
    const tracker = this.trackers.get(trackerId);
    if (!tracker) {
      throw new Error(`Progress tracker ${trackerId} not found`);
    }
    
    return {
      id: tracker.id,
      userId: tracker.userId,
      jobId: tracker.jobId,
      fileName: tracker.fileName,
      fileSize: tracker.fileSize,
      
      // Progress
      currentStage: tracker.currentStage,
      overallProgress: tracker.overallProgress,
      stageProgress: tracker.stageProgress,
      stageProgresses: { ...tracker.stageProgresses },
      
      // Status
      status: tracker.status,
      message: tracker.message,
      error: tracker.error,
      
      // Timing
      startTime: tracker.startTime,
      lastUpdateTime: tracker.lastUpdateTime,
      elapsedTime: tracker.lastUpdateTime - tracker.startTime,
      estimatedCompletionTime: tracker.estimatedCompletionTime,
      estimatedRemainingTime: tracker.estimatedCompletionTime ? 
        Math.max(0, tracker.estimatedCompletionTime - Date.now()) : null,
      
      // Metrics
      updateCount: tracker.updateCount,
      processingRate: tracker.processingRate
    };
  }

  /**
   * Get all active trackers for a user
   */
  getUserTrackers(userId) {
    const userTrackers = [];
    
    for (const [trackerId, tracker] of this.trackers.entries()) {
      if (tracker.userId === userId) {
        userTrackers.push(this.getTrackerStatus(trackerId));
      }
    }
    
    return userTrackers;
  }

  /**
   * Get progress history for a tracker
   */
  getProgressHistory(trackerId, limit = 100) {
    return this.progressHistory
      .filter(entry => entry.trackerId === trackerId)
      .slice(-limit);
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeTrackers: this.trackers.size,
      historySize: this.progressHistory.length,
      uptime: Date.now() - this.startTime || Date.now()
    };
  }

  // Helper methods
  calculateOverallProgress(tracker) {
    let totalProgress = 0;
    let totalWeight = 0;
    
    for (const [stage, weight] of Object.entries(this.config.stageWeights)) {
      const stageProgress = tracker.stageProgresses[stage] || 0;
      totalProgress += (stageProgress * weight);
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? Math.round(totalProgress / totalWeight) : 0;
  }

  addToHistory(trackerId, entry) {
    this.progressHistory.push({
      trackerId,
      ...entry
    });
    
    // Trim history if too large
    if (this.progressHistory.length > this.config.maxProgressHistory) {
      this.progressHistory = this.progressHistory.slice(-this.config.maxProgressHistory);
    }
  }

  /**
   * Clean up old completed trackers
   */
  cleanup() {
    const cutoffTime = Date.now() - (5 * 60 * 1000); // 5 minutes
    let cleaned = 0;
    
    for (const [trackerId, tracker] of this.trackers.entries()) {
      if ((tracker.status === 'completed' || tracker.status === 'failed') && 
          tracker.lastUpdateTime < cutoffTime) {
        this.trackers.delete(trackerId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old progress trackers`);
    }
  }
}

module.exports = new ProgressTrackingService();