class ConfigurationManager {
  constructor() {
    this.config = {};
    this.listeners = [];
    this.isInitialized = false;
    this.initialize();
  }

  initialize() {
    // Default configuration for enhanced document processing
    this.config = {
      advancedDocumentService: {
        chunkSize: 2000,
        chunkOverlap: 200,
        separators: ["\n\n", "\n", ". ", "! ", "? ", "; ", ": ", " ", ""],
        embeddingModel: 'Xenova/all-MiniLM-L6-v2',
        embeddingDimensions: 384,
        modelCacheDir: './model_cache',
        normalizeEmbeddings: true,
        batchSize: 32,
        enableModelCaching: true,
        maxConcurrentDocuments: 5,
        maxConcurrentChunks: 10,
        maxConcurrentEmbeddings: 8
      },
      dataFolderProcessor: {
        maxConcurrentFiles: 3,
        supportedExtensions: ['.pdf', '.docx', '.html', '.htm', '.txt'],
        maxFileSize: 50 * 1024 * 1024, // 50MB
        enableProgressTracking: true,
        enableMetrics: true
      },
      resourceCache: {
        maxSize: 200,
        defaultTTL: 1800000, // 30 minutes
        maxMemoryUsage: 200 * 1024 * 1024, // 200MB
        enableMetrics: true,
        enableCompression: true
      },
      performanceMetrics: {
        enableSystemMetrics: true,
        enableOperationTracking: true,
        enableResourceTracking: true,
        enableAlerts: true
      },
      processingTimeTracker: {
        enableDetailedTracking: true,
        enableBottleneckDetection: true,
        enableOptimizationSuggestions: true,
        slowOperationThreshold: 3000 // 3 seconds
      }
    };

    this.isInitialized = true;
    console.log('✅ ConfigurationManager initialized');
  }

  /**
   * Get configuration for a specific service
   * @param {string} serviceName - Name of the service
   * @returns {Object} Service configuration
   */
  getServiceConfig(serviceName) {
    return this.config[serviceName] || {};
  }

  /**
   * Get a specific configuration value
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if key not found
   * @returns {*} Configuration value
   */
  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  /**
   * Set a configuration value
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   */
  set(key, value) {
    const keys = key.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    const lastKey = keys[keys.length - 1];
    const oldValue = current[lastKey];
    current[lastKey] = value;
    
    // Notify listeners
    this.notifyListeners(key, value, oldValue);
  }

  /**
   * Add a configuration change listener
   * @param {Function} listener - Listener function
   */
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
   * Remove a configuration change listener
   * @param {Function} listener - Listener function to remove
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of configuration changes
   * @param {string} key - Changed key
   * @param {*} newValue - New value
   * @param {*} oldValue - Old value
   */
  notifyListeners(key, newValue, oldValue) {
    this.listeners.forEach(listener => {
      try {
        listener(key, newValue, oldValue);
      } catch (error) {
        console.error('❌ Error in configuration listener:', error);
      }
    });
  }

  /**
   * Get all configuration
   * @returns {Object} Complete configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Update configuration from object
   * @param {Object} newConfig - New configuration object
   */
  updateConfig(newConfig) {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Notify listeners of bulk change
    this.notifyListeners('*', this.config, oldConfig);
  }

  /**
   * Reset configuration to defaults
   */
  reset() {
    const oldConfig = { ...this.config };
    this.initialize();
    this.notifyListeners('*', this.config, oldConfig);
  }
}

module.exports = new ConfigurationManager();