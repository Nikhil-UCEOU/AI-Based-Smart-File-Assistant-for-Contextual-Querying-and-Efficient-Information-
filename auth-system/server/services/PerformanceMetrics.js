class PerformanceMetrics {
  constructor(options = {}) {
    this.enableSystemMetrics = options.enableSystemMetrics || false;
    this.enableOperationTracking = options.enableOperationTracking || false;
    this.enableResourceTracking = options.enableResourceTracking || false;
    this.enableAlerts = options.enableAlerts || false;
    
    this.metrics = {
      operations: new Map(),
      system: {
        cpu: 0,
        memory: 0,
        uptime: 0,
        lastUpdated: Date.now()
      },
      resources: new Map(),
      alerts: []
    };
    
    this.operationHistory = [];
    this.maxHistorySize = 1000;
    
    // Start system metrics collection if enabled
    if (this.enableSystemMetrics) {
      this.startSystemMetricsCollection();
    }
  }

  /**
   * Start tracking an operation
   * @param {string} operationId - Unique operation identifier
   * @param {string} operationType - Type of operation
   * @param {Object} metadata - Additional metadata
   */
  startOperation(operationId, operationType, metadata = {}) {
    const operation = {
      id: operationId,
      type: operationType,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      success: null,
      metadata: metadata,
      stages: new Map()
    };
    
    this.metrics.operations.set(operationId, operation);
    return operation;
  }

  /**
   * End tracking an operation
   * @param {string} operationId - Operation identifier
   * @param {boolean} success - Whether operation was successful
   * @param {Object} result - Operation result or error
   */
  endOperation(operationId, success, result = {}) {
    const operation = this.metrics.operations.get(operationId);
    if (!operation) {
      return;
    }
    
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.success = success;
    operation.result = result;
    
    // Add to history
    this.operationHistory.push({ ...operation });
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory.shift();
    }
    
    // Remove from active operations
    this.metrics.operations.delete(operationId);
    
    // Check for alerts
    if (this.enableAlerts) {
      this.checkOperationAlerts(operation);
    }
  }

  /**
   * Start tracking a stage within an operation
   * @param {string} operationId - Operation identifier
   * @param {string} stageName - Name of the stage
   */
  startStage(operationId, stageName) {
    const operation = this.metrics.operations.get(operationId);
    if (!operation) {
      return;
    }
    
    operation.stages.set(stageName, {
      startTime: Date.now(),
      endTime: null,
      duration: null
    });
  }

  /**
   * End tracking a stage within an operation
   * @param {string} operationId - Operation identifier
   * @param {string} stageName - Name of the stage
   */
  endStage(operationId, stageName) {
    const operation = this.metrics.operations.get(operationId);
    if (!operation || !operation.stages.has(stageName)) {
      return;
    }
    
    const stage = operation.stages.get(stageName);
    stage.endTime = Date.now();
    stage.duration = stage.endTime - stage.startTime;
  }

  /**
   * Track resource usage
   * @param {string} resourceType - Type of resource
   * @param {string} resourceId - Resource identifier
   * @param {Object} usage - Usage metrics
   */
  trackResource(resourceType, resourceId, usage) {
    if (!this.enableResourceTracking) {
      return;
    }
    
    const key = `${resourceType}:${resourceId}`;
    this.metrics.resources.set(key, {
      type: resourceType,
      id: resourceId,
      usage: usage,
      timestamp: Date.now()
    });
  }

  /**
   * Start system metrics collection
   */
  startSystemMetricsCollection() {
    const collectMetrics = () => {
      try {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        this.metrics.system = {
          memory: {
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            external: memoryUsage.external,
            rss: memoryUsage.rss,
            utilization: (memoryUsage.heapUsed / memoryUsage.heapTotal * 100).toFixed(2)
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
          },
          uptime: process.uptime(),
          lastUpdated: Date.now()
        };
      } catch (error) {
        console.error('❌ Error collecting system metrics:', error);
      }
    };
    
    // Collect immediately and then every 30 seconds
    collectMetrics();
    setInterval(collectMetrics, 30000);
  }

  /**
   * Check for performance alerts
   * @param {Object} operation - Completed operation
   */
  checkOperationAlerts(operation) {
    const alerts = [];
    
    // Check for slow operations
    if (operation.duration > 5000) { // 5 seconds
      alerts.push({
        type: 'slow_operation',
        message: `Operation ${operation.type} took ${operation.duration}ms`,
        severity: 'warning',
        timestamp: Date.now(),
        operation: operation
      });
    }
    
    // Check for failed operations
    if (!operation.success) {
      alerts.push({
        type: 'operation_failure',
        message: `Operation ${operation.type} failed`,
        severity: 'error',
        timestamp: Date.now(),
        operation: operation
      });
    }
    
    // Add alerts to metrics
    this.metrics.alerts.push(...alerts);
    
    // Keep only recent alerts (last 100)
    if (this.metrics.alerts.length > 100) {
      this.metrics.alerts = this.metrics.alerts.slice(-100);
    }
  }

  /**
   * Get operation statistics
   * @param {string} operationType - Type of operation to analyze
   * @returns {Object} Operation statistics
   */
  getOperationStats(operationType = null) {
    let operations = this.operationHistory;
    
    if (operationType) {
      operations = operations.filter(op => op.type === operationType);
    }
    
    if (operations.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        successRate: 0,
        totalDuration: 0
      };
    }
    
    const totalDuration = operations.reduce((sum, op) => sum + op.duration, 0);
    const successfulOps = operations.filter(op => op.success).length;
    
    return {
      count: operations.length,
      avgDuration: Math.round(totalDuration / operations.length),
      successRate: Math.round((successfulOps / operations.length) * 100),
      totalDuration: totalDuration,
      recentOperations: operations.slice(-10)
    };
  }

  /**
   * Get system metrics
   * @returns {Object} Current system metrics
   */
  getSystemMetrics() {
    return { ...this.metrics.system };
  }

  /**
   * Get resource metrics
   * @param {string} resourceType - Type of resource to filter by
   * @returns {Array} Resource metrics
   */
  getResourceMetrics(resourceType = null) {
    const resources = Array.from(this.metrics.resources.values());
    
    if (resourceType) {
      return resources.filter(resource => resource.type === resourceType);
    }
    
    return resources;
  }

  /**
   * Get recent alerts
   * @param {number} limit - Maximum number of alerts to return
   * @returns {Array} Recent alerts
   */
  getAlerts(limit = 10) {
    return this.metrics.alerts.slice(-limit);
  }

  /**
   * Get comprehensive performance report
   * @returns {Object} Performance report
   */
  getPerformanceReport() {
    return {
      operations: {
        active: this.metrics.operations.size,
        completed: this.operationHistory.length,
        stats: this.getOperationStats()
      },
      system: this.getSystemMetrics(),
      resources: {
        tracked: this.metrics.resources.size,
        types: [...new Set(Array.from(this.metrics.resources.values()).map(r => r.type))]
      },
      alerts: {
        total: this.metrics.alerts.length,
        recent: this.getAlerts(5)
      },
      timestamp: Date.now()
    };
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics.operations.clear();
    this.metrics.resources.clear();
    this.metrics.alerts = [];
    this.operationHistory = [];
  }

  /**
   * Export metrics to JSON
   * @returns {string} JSON string of metrics
   */
  exportMetrics() {
    const exportData = {
      operationHistory: this.operationHistory,
      systemMetrics: this.metrics.system,
      resourceMetrics: Array.from(this.metrics.resources.values()),
      alerts: this.metrics.alerts,
      exportedAt: Date.now()
    };
    
    return JSON.stringify(exportData, null, 2);
  }
}

module.exports = PerformanceMetrics;