class ResourceCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.defaultTTL || 3600000; // 1 hour
    this.maxMemoryUsage = options.maxMemoryUsage || 100 * 1024 * 1024; // 100MB
    this.enableMetrics = options.enableMetrics || false;
    this.enableCompression = options.enableCompression || false;
    
    this.cache = new Map();
    this.accessTimes = new Map();
    this.expirationTimes = new Map();
    this.resourceTypes = new Map();
    
    // Metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      memoryUsage: 0,
      totalRequests: 0
    };
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @param {string} resourceType - Type of resource
   * @returns {*} Cached value or null
   */
  get(key, resourceType = 'default') {
    this.metrics.totalRequests++;
    
    if (!this.cache.has(key)) {
      this.metrics.misses++;
      return null;
    }
    
    // Check expiration
    const expirationTime = this.expirationTimes.get(key);
    if (expirationTime && Date.now() > expirationTime) {
      this.delete(key);
      this.metrics.misses++;
      return null;
    }
    
    // Update access time
    this.accessTimes.set(key, Date.now());
    this.metrics.hits++;
    
    return this.cache.get(key);
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {Object} options - Cache options
   */
  set(key, value, options = {}) {
    const ttl = options.ttl || this.defaultTTL;
    const resourceType = options.resourceType || 'default';
    const priority = options.priority || 'normal';
    
    // Check if we need to evict items
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    // Store the item
    this.cache.set(key, value);
    this.accessTimes.set(key, Date.now());
    this.expirationTimes.set(key, Date.now() + ttl);
    this.resourceTypes.set(key, { type: resourceType, priority });
    
    // Update memory usage estimate
    this.updateMemoryUsage();
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
    this.accessTimes.delete(key);
    this.expirationTimes.delete(key);
    this.resourceTypes.delete(key);
    this.updateMemoryUsage();
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  has(key) {
    if (!this.cache.has(key)) {
      return false;
    }
    
    // Check expiration
    const expirationTime = this.expirationTimes.get(key);
    if (expirationTime && Date.now() > expirationTime) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.accessTimes.clear();
    this.expirationTimes.clear();
    this.resourceTypes.clear();
    this.metrics.memoryUsage = 0;
  }

  /**
   * Evict least recently used item
   */
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, accessTime] of this.accessTimes) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey);
      this.metrics.evictions++;
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, expirationTime] of this.expirationTimes) {
      if (expirationTime && now > expirationTime) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`🧹 ResourceCache: Cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Update memory usage estimate
   */
  updateMemoryUsage() {
    let totalSize = 0;
    
    for (const value of this.cache.values()) {
      totalSize += this.estimateSize(value);
    }
    
    this.metrics.memoryUsage = totalSize;
    
    // If memory usage is too high, evict items
    while (this.metrics.memoryUsage > this.maxMemoryUsage && this.cache.size > 0) {
      this.evictLRU();
      this.updateMemoryUsage();
    }
  }

  /**
   * Estimate size of a value in bytes
   * @param {*} value - Value to estimate
   * @returns {number} Estimated size in bytes
   */
  estimateSize(value) {
    if (value === null || value === undefined) {
      return 0;
    }
    
    if (typeof value === 'string') {
      return value.length * 2; // Rough estimate for UTF-16
    }
    
    if (typeof value === 'number') {
      return 8;
    }
    
    if (typeof value === 'boolean') {
      return 4;
    }
    
    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + this.estimateSize(item), 0);
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value).length * 2;
    }
    
    return 100; // Default estimate
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const hitRate = this.metrics.totalRequests > 0 ? 
      (this.metrics.hits / this.metrics.totalRequests * 100).toFixed(2) : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      evictions: this.metrics.evictions,
      memoryUsage: this.metrics.memoryUsage,
      maxMemoryUsage: this.maxMemoryUsage,
      memoryUtilization: `${(this.metrics.memoryUsage / this.maxMemoryUsage * 100).toFixed(2)}%`
    };
  }

  /**
   * Get cache entries by resource type
   * @param {string} resourceType - Resource type to filter by
   * @returns {Array} Array of cache entries
   */
  getByResourceType(resourceType) {
    const entries = [];
    
    for (const [key, typeInfo] of this.resourceTypes) {
      if (typeInfo.type === resourceType) {
        entries.push({
          key,
          value: this.cache.get(key),
          accessTime: this.accessTimes.get(key),
          expirationTime: this.expirationTimes.get(key),
          priority: typeInfo.priority
        });
      }
    }
    
    return entries;
  }

  /**
   * Destroy the cache and cleanup
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

module.exports = ResourceCache;