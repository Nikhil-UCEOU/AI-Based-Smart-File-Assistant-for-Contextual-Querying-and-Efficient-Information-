class ProcessingTimeTracker {
  constructor(options = {}) {
    this.enableDetailedTracking = options.enableDetailedTracking || false;
    this.enableBottleneckDetection = options.enableBottleneckDetection || false;
    this.enableOptimizationSuggestions = options.enableOptimizationSuggestions || false;
    this.slowOperationThreshold = options.slowOperationThreshold || 3000; // 3 seconds
    
    this.operations = new Map();
    this.completedOperations = [];
    this.bottlenecks = [];
    this.suggestions = [];
    this.maxHistorySize = 500;
  }

  /**
   * Start tracking an operation
   * @param {string} operationId - Unique operation identifier
   * @param {string} operationType - Type of operation
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Operation tracking object
   */
  startOperation(operationId, operationType, metadata = {}) {
    const operation = {
      operationId,
      operationType,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      stages: new Map(),
      metadata: metadata,
      success: null,
      bottlenecks: [],
      suggestions: []
    };
    
    this.operations.set(operationId, operation);
    
    if (this.enableDetailedTracking) {
      console.log(`⏱️ Started tracking: ${operationType} (${operationId})`);
    }
    
    return operation;
  }

  /**
   * End tracking an operation
   * @param {string} operationId - Operation identifier
   * @param {boolean} success - Whether operation was successful
   * @param {Object} result - Operation result or error details
   */
  endOperation(operationId, success, result = {}) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`⚠️ Operation ${operationId} not found for ending`);
      return;
    }
    
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.success = success;
    operation.result = result;
    
    // Analyze operation for bottlenecks and suggestions
    if (this.enableBottleneckDetection) {
      this.analyzeBottlenecks(operation);
    }
    
    if (this.enableOptimizationSuggestions) {
      this.generateOptimizationSuggestions(operation);
    }
    
    // Move to completed operations
    this.completedOperations.push({ ...operation });
    if (this.completedOperations.length > this.maxHistorySize) {
      this.completedOperations.shift();
    }
    
    // Remove from active operations
    this.operations.delete(operationId);
    
    if (this.enableDetailedTracking) {
      console.log(`⏱️ Completed tracking: ${operation.operationType} (${operationId}) - ${operation.duration}ms`);
    }
    
    // Log slow operations
    if (operation.duration > this.slowOperationThreshold) {
      console.warn(`🐌 Slow operation detected: ${operation.operationType} took ${operation.duration}ms`);
    }
  }

  /**
   * Start tracking a stage within an operation
   * @param {string} operationId - Operation identifier
   * @param {string} stageName - Name of the stage
   */
  startStage(operationId, stageName) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return;
    }
    
    operation.stages.set(stageName, {
      startTime: Date.now(),
      endTime: null,
      duration: null
    });
    
    if (this.enableDetailedTracking) {
      console.log(`  📍 Started stage: ${stageName} in ${operation.operationType}`);
    }
  }

  /**
   * End tracking a stage within an operation
   * @param {string} operationId - Operation identifier
   * @param {string} stageName - Name of the stage
   */
  endStage(operationId, stageName) {
    const operation = this.operations.get(operationId);
    if (!operation || !operation.stages.has(stageName)) {
      return;
    }
    
    const stage = operation.stages.get(stageName);
    stage.endTime = Date.now();
    stage.duration = stage.endTime - stage.startTime;
    
    if (this.enableDetailedTracking) {
      console.log(`  📍 Completed stage: ${stageName} in ${operation.operationType} - ${stage.duration}ms`);
    }
  }

  /**
   * Analyze operation for bottlenecks
   * @param {Object} operation - Completed operation
   */
  analyzeBottlenecks(operation) {
    const bottlenecks = [];
    
    // Check overall operation time
    if (operation.duration > this.slowOperationThreshold) {
      bottlenecks.push({
        type: 'slow_operation',
        operation: operation.operationType,
        duration: operation.duration,
        threshold: this.slowOperationThreshold,
        severity: operation.duration > this.slowOperationThreshold * 2 ? 'high' : 'medium'
      });
    }
    
    // Analyze stages
    for (const [stageName, stage] of operation.stages) {
      if (stage.duration > operation.duration * 0.5) { // Stage takes more than 50% of total time
        bottlenecks.push({
          type: 'slow_stage',
          operation: operation.operationType,
          stage: stageName,
          duration: stage.duration,
          percentage: Math.round((stage.duration / operation.duration) * 100),
          severity: stage.duration > operation.duration * 0.7 ? 'high' : 'medium'
        });
      }
    }
    
    operation.bottlenecks = bottlenecks;
    this.bottlenecks.push(...bottlenecks);
    
    // Keep only recent bottlenecks
    if (this.bottlenecks.length > 100) {
      this.bottlenecks = this.bottlenecks.slice(-100);
    }
  }

  /**
   * Generate optimization suggestions
   * @param {Object} operation - Completed operation
   */
  generateOptimizationSuggestions(operation) {
    const suggestions = [];
    
    // Suggest caching for repeated operations
    const similarOps = this.completedOperations.filter(op => 
      op.operationType === operation.operationType && 
      JSON.stringify(op.metadata) === JSON.stringify(operation.metadata)
    );
    
    if (similarOps.length > 3) {
      suggestions.push({
        type: 'caching',
        operation: operation.operationType,
        reason: `Operation repeated ${similarOps.length} times with same parameters`,
        suggestion: 'Consider implementing caching for this operation',
        priority: 'medium'
      });
    }
    
    // Suggest parallel processing for operations with multiple stages
    if (operation.stages.size > 2) {
      const stageArray = Array.from(operation.stages.values());
      const totalStageTime = stageArray.reduce((sum, stage) => sum + stage.duration, 0);
      
      if (totalStageTime > operation.duration * 1.2) { // Stages overlap or could be parallelized
        suggestions.push({
          type: 'parallelization',
          operation: operation.operationType,
          reason: `Multiple stages detected (${operation.stages.size} stages)`,
          suggestion: 'Consider parallelizing independent stages',
          priority: 'high'
        });
      }
    }
    
    // Suggest batch processing for small, frequent operations
    const recentSimilarOps = this.completedOperations
      .filter(op => op.operationType === operation.operationType)
      .filter(op => Date.now() - op.endTime < 60000); // Last minute
    
    if (recentSimilarOps.length > 10 && operation.duration < 1000) {
      suggestions.push({
        type: 'batching',
        operation: operation.operationType,
        reason: `${recentSimilarOps.length} similar operations in last minute`,
        suggestion: 'Consider batch processing to reduce overhead',
        priority: 'medium'
      });
    }
    
    operation.suggestions = suggestions;
    this.suggestions.push(...suggestions);
    
    // Keep only recent suggestions
    if (this.suggestions.length > 50) {
      this.suggestions = this.suggestions.slice(-50);
    }
  }

  /**
   * Get operation statistics
   * @param {string} operationType - Filter by operation type
   * @returns {Object} Operation statistics
   */
  getOperationStats(operationType = null) {
    let operations = this.completedOperations;
    
    if (operationType) {
      operations = operations.filter(op => op.operationType === operationType);
    }
    
    if (operations.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
        totalDuration: 0
      };
    }
    
    const durations = operations.map(op => op.duration);
    const successfulOps = operations.filter(op => op.success).length;
    
    return {
      count: operations.length,
      avgDuration: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: Math.round((successfulOps / operations.length) * 100),
      totalDuration: durations.reduce((sum, d) => sum + d, 0),
      recentOperations: operations.slice(-5)
    };
  }

  /**
   * Get active operations
   * @returns {Array} Currently active operations
   */
  getActiveOperations() {
    return Array.from(this.operations.values()).map(op => ({
      operationId: op.operationId,
      operationType: op.operationType,
      startTime: op.startTime,
      duration: Date.now() - op.startTime,
      stages: Array.from(op.stages.keys()),
      metadata: op.metadata
    }));
  }

  /**
   * Get bottlenecks
   * @param {string} severity - Filter by severity (high, medium, low)
   * @returns {Array} Detected bottlenecks
   */
  getBottlenecks(severity = null) {
    let bottlenecks = this.bottlenecks;
    
    if (severity) {
      bottlenecks = bottlenecks.filter(b => b.severity === severity);
    }
    
    return bottlenecks.slice(-20); // Return last 20 bottlenecks
  }

  /**
   * Get optimization suggestions
   * @param {string} priority - Filter by priority (high, medium, low)
   * @returns {Array} Optimization suggestions
   */
  getOptimizationSuggestions(priority = null) {
    let suggestions = this.suggestions;
    
    if (priority) {
      suggestions = suggestions.filter(s => s.priority === priority);
    }
    
    // Remove duplicates
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => 
        s.type === suggestion.type && 
        s.operation === suggestion.operation
      )
    );
    
    return uniqueSuggestions.slice(-10); // Return last 10 unique suggestions
  }

  /**
   * Get comprehensive performance report
   * @returns {Object} Performance report
   */
  getPerformanceReport() {
    const allStats = this.getOperationStats();
    const activeOps = this.getActiveOperations();
    const bottlenecks = this.getBottlenecks();
    const suggestions = this.getOptimizationSuggestions();
    
    return {
      summary: {
        activeOperations: activeOps.length,
        completedOperations: this.completedOperations.length,
        avgDuration: allStats.avgDuration,
        successRate: allStats.successRate,
        slowOperations: this.completedOperations.filter(op => op.duration > this.slowOperationThreshold).length
      },
      activeOperations: activeOps,
      recentBottlenecks: bottlenecks.slice(-5),
      topSuggestions: suggestions.slice(-3),
      operationTypes: [...new Set(this.completedOperations.map(op => op.operationType))],
      timestamp: Date.now()
    };
  }

  /**
   * Clear all tracking data
   */
  clear() {
    this.operations.clear();
    this.completedOperations = [];
    this.bottlenecks = [];
    this.suggestions = [];
  }

  /**
   * Get operation by ID
   * @param {string} operationId - Operation identifier
   * @returns {Object|null} Operation object or null if not found
   */
  getOperation(operationId) {
    return this.operations.get(operationId) || null;
  }
}

module.exports = ProcessingTimeTracker;