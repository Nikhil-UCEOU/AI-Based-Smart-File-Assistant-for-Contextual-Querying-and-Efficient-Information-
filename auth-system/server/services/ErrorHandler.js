class ErrorHandler {
  constructor() {
    this.errorCounts = new Map();
    this.errorHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Handle and log errors with context
   * @param {Error} error - The error object
   * @param {string} context - Context where error occurred
   * @param {Object} metadata - Additional metadata
   */
  handleError(error, context = 'unknown', metadata = {}) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString(),
      metadata: metadata
    };

    // Track error counts
    const errorKey = `${context}:${error.message}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);

    // Add to history
    this.errorHistory.push(errorInfo);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Log error
    console.error(`❌ Error in ${context}:`, error.message);
    if (metadata && Object.keys(metadata).length > 0) {
      console.error('   Metadata:', metadata);
    }

    return errorInfo;
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      totalErrors: this.errorHistory.length,
      uniqueErrors: this.errorCounts.size,
      recentErrors: this.errorHistory.slice(-10),
      topErrors: Array.from(this.errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => ({ error: key, count }))
    };

    return stats;
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this.errorHistory = [];
    this.errorCounts.clear();
  }

  /**
   * Create a standardized error response
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Object} details - Additional error details
   */
  createErrorResponse(message, statusCode = 500, details = {}) {
    return {
      success: false,
      error: message,
      statusCode: statusCode,
      timestamp: new Date().toISOString(),
      ...details
    };
  }

  /**
   * Wrap async functions with error handling
   * @param {Function} fn - Async function to wrap
   * @param {string} context - Context for error handling
   */
  wrapAsync(fn, context) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error, context);
        throw error;
      }
    };
  }
}

module.exports = new ErrorHandler();