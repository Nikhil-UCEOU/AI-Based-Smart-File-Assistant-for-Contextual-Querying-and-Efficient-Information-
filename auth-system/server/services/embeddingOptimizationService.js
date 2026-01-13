const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * Embedding Optimization Service
 * Provides batched embedding requests, caching, and performance optimization
 */
class EmbeddingOptimizationService {
  constructor() {
    this.config = {
      // Batching configuration
      maxBatchSize: 10, // Maximum texts per batch request
      batchTimeout: 500, // Wait 500ms to collect batch
      maxConcurrentBatches: 3, // Maximum concurrent batch requests
      
      // Caching configuration
      enableCaching: true,
      cacheDirectory: path.join(__dirname, '../cache/embeddings'),
      maxCacheSize: 1000, // Maximum cached embeddings
      cacheExpiryTime: 7 * 24 * 60 * 60 * 1000, // 7 days
      
      // Performance optimization
      enableDeduplication: true,
      minTextLength: 10, // Minimum text length to process
      maxTextLength: 8000, // Maximum text length (truncate if longer)
      
      // Retry configuration
      maxRetries: 3,
      retryDelay: 1000, // 1 second base delay
      
      // Monitoring
      metricsEnabled: true
    };
    
    // Batching state
    this.pendingBatches = [];
    this.activeBatches = 0;
    this.batchQueue = [];
    
    // Cache state
    this.embeddingCache = new Map(); // textHash -> { embedding, timestamp, accessCount }
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      batchedRequests: 0,
      cachedRequests: 0,
      deduplicatedRequests: 0,
      totalProcessingTime: 0,
      avgProcessingTime: 0,
      avgBatchSize: 0,
      totalBatches: 0
    };
    
    // Initialize cache directory
    this.initializeCache();
    
    // Start batch processor
    this.startBatchProcessor();
    
    console.log('🚀 Embedding Optimization Service initialized');
    console.log(`   Max batch size: ${this.config.maxBatchSize}`);
    console.log(`   Cache enabled: ${this.config.enableCaching}`);
    console.log(`   Deduplication enabled: ${this.config.enableDeduplication}`);
  }

  /**
   * Generate embeddings with optimization
   */
  async generateEmbeddings(texts, options = {}) {
    const startTime = Date.now();
    
    if (!Array.isArray(texts)) {
      texts = [texts];
    }
    
    // Validate and preprocess texts
    const processedTexts = this.preprocessTexts(texts);
    
    // Check cache first
    const cacheResults = this.config.enableCaching ? 
      await this.checkCache(processedTexts) : 
      { cached: [], uncached: processedTexts.map((text, index) => ({ text, originalIndex: index })) };
    
    let embeddings = new Array(processedTexts.length);
    
    // Fill cached results
    cacheResults.cached.forEach(({ embedding, originalIndex }) => {
      embeddings[originalIndex] = embedding;
    });
    
    // Process uncached texts
    if (cacheResults.uncached.length > 0) {
      const uncachedTexts = cacheResults.uncached.map(item => item.text);
      const newEmbeddings = await this.batchGenerateEmbeddings(uncachedTexts, options);
      
      // Fill uncached results and update cache
      cacheResults.uncached.forEach(({ originalIndex }, index) => {
        embeddings[originalIndex] = newEmbeddings[index];
        
        // Cache the new embedding
        if (this.config.enableCaching) {
          this.cacheEmbedding(processedTexts[originalIndex], newEmbeddings[index]);
        }
      });
    }
    
    // Update metrics
    const processingTime = Date.now() - startTime;
    this.updateMetrics(texts.length, cacheResults.cached.length, processingTime);
    
    return texts.length === 1 ? embeddings[0] : embeddings;
  }

  /**
   * Batch generate embeddings with optimization
   */
  async batchGenerateEmbeddings(texts, options = {}) {
    if (texts.length === 0) {
      return [];
    }
    
    // Deduplicate texts if enabled
    const { uniqueTexts, indexMap } = this.config.enableDeduplication ? 
      this.deduplicateTexts(texts) : 
      { uniqueTexts: texts, indexMap: texts.map((_, index) => index) };
    
    // Split into batches
    const batches = this.createBatches(uniqueTexts);
    
    // Process batches
    const batchPromises = batches.map(batch => this.processBatch(batch, options));
    const batchResults = await Promise.all(batchPromises);
    
    // Flatten results
    const uniqueEmbeddings = batchResults.flat();
    
    // Map back to original order (handling deduplication)
    const embeddings = indexMap.map(uniqueIndex => uniqueEmbeddings[uniqueIndex]);
    
    return embeddings;
  }

  /**
   * Process a single batch of texts
   */
  async processBatch(texts, options = {}) {
    return new Promise((resolve, reject) => {
      const batchRequest = {
        texts,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        retries: 0
      };
      
      this.batchQueue.push(batchRequest);
    });
  }

  /**
   * Start the batch processor
   */
  startBatchProcessor() {
    setInterval(async () => {
      if (this.batchQueue.length === 0 || this.activeBatches >= this.config.maxConcurrentBatches) {
        return;
      }
      
      // Take next batch from queue
      const batchRequest = this.batchQueue.shift();
      this.activeBatches++;
      
      try {
        const embeddings = await this.executeBatch(batchRequest);
        batchRequest.resolve(embeddings);
      } catch (error) {
        // Retry logic
        if (batchRequest.retries < this.config.maxRetries) {
          batchRequest.retries++;
          console.log(`🔄 Retrying batch (attempt ${batchRequest.retries}/${this.config.maxRetries})`);
          
          // Add back to queue with delay
          setTimeout(() => {
            this.batchQueue.unshift(batchRequest);
          }, this.config.retryDelay * batchRequest.retries);
        } else {
          batchRequest.reject(error);
        }
      } finally {
        this.activeBatches--;
      }
    }, this.config.batchTimeout);
  }

  /**
   * Execute a batch request
   */
  async executeBatch(batchRequest) {
    const { texts, options } = batchRequest;
    
    // Import the embedding service (avoid circular dependency)
    const { HfInference } = require('@huggingface/inference');
    const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
    
    try {
      // Generate embeddings for the batch
      const embeddings = [];
      
      for (const text of texts) {
        const response = await hf.featureExtraction({
          model: options.model || 'sentence-transformers/all-MiniLM-L6-v2',
          inputs: text
        });
        
        embeddings.push(Array.from(response));
      }
      
      // Update metrics
      this.metrics.totalBatches++;
      this.metrics.batchedRequests += texts.length;
      this.metrics.avgBatchSize = this.metrics.batchedRequests / this.metrics.totalBatches;
      
      console.log(`✅ Processed batch of ${texts.length} embeddings`);
      
      return embeddings;
      
    } catch (error) {
      console.error('Batch embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Preprocess texts for embedding generation
   */
  preprocessTexts(texts) {
    return texts.map(text => {
      if (typeof text !== 'string') {
        text = String(text);
      }
      
      // Trim whitespace
      text = text.trim();
      
      // Check minimum length
      if (text.length < this.config.minTextLength) {
        return text.padEnd(this.config.minTextLength, ' ');
      }
      
      // Truncate if too long
      if (text.length > this.config.maxTextLength) {
        text = text.substring(0, this.config.maxTextLength);
      }
      
      return text;
    });
  }

  /**
   * Check cache for existing embeddings
   */
  async checkCache(texts) {
    const cached = [];
    const uncached = [];
    
    texts.forEach((text, index) => {
      const textHash = this.hashText(text);
      const cacheEntry = this.embeddingCache.get(textHash);
      
      if (cacheEntry && !this.isCacheExpired(cacheEntry)) {
        // Cache hit
        cacheEntry.accessCount++;
        cached.push({ embedding: cacheEntry.embedding, originalIndex: index });
        this.cacheStats.hits++;
      } else {
        // Cache miss
        uncached.push({ text, originalIndex: index });
        this.cacheStats.misses++;
      }
    });
    
    return { cached, uncached };
  }

  /**
   * Cache an embedding
   */
  cacheEmbedding(text, embedding) {
    const textHash = this.hashText(text);
    
    // Check cache size limit
    if (this.embeddingCache.size >= this.config.maxCacheSize) {
      this.evictLeastUsed();
    }
    
    this.embeddingCache.set(textHash, {
      embedding,
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  /**
   * Evict least recently used cache entries
   */
  evictLeastUsed() {
    // Find least accessed entry
    let leastUsedKey = null;
    let leastAccessCount = Infinity;
    
    for (const [key, entry] of this.embeddingCache.entries()) {
      if (entry.accessCount < leastAccessCount) {
        leastAccessCount = entry.accessCount;
        leastUsedKey = key;
      }
    }
    
    if (leastUsedKey) {
      this.embeddingCache.delete(leastUsedKey);
      this.cacheStats.evictions++;
    }
  }

  /**
   * Deduplicate texts
   */
  deduplicateTexts(texts) {
    const uniqueTexts = [];
    const textToIndex = new Map();
    const indexMap = [];
    
    texts.forEach((text, originalIndex) => {
      const textHash = this.hashText(text);
      
      if (textToIndex.has(textHash)) {
        // Duplicate found
        indexMap.push(textToIndex.get(textHash));
        this.metrics.deduplicatedRequests++;
      } else {
        // New unique text
        const uniqueIndex = uniqueTexts.length;
        uniqueTexts.push(text);
        textToIndex.set(textHash, uniqueIndex);
        indexMap.push(uniqueIndex);
      }
    });
    
    return { uniqueTexts, indexMap };
  }

  /**
   * Create batches from texts
   */
  createBatches(texts) {
    const batches = [];
    
    for (let i = 0; i < texts.length; i += this.config.maxBatchSize) {
      batches.push(texts.slice(i, i + this.config.maxBatchSize));
    }
    
    return batches;
  }

  /**
   * Hash text for caching and deduplication
   */
  hashText(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Check if cache entry is expired
   */
  isCacheExpired(cacheEntry) {
    return Date.now() - cacheEntry.timestamp > this.config.cacheExpiryTime;
  }

  /**
   * Update performance metrics
   */
  updateMetrics(totalRequests, cachedRequests, processingTime) {
    this.metrics.totalRequests += totalRequests;
    this.metrics.cachedRequests += cachedRequests;
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.avgProcessingTime = this.metrics.totalProcessingTime / this.metrics.totalRequests;
  }

  /**
   * Get service status and metrics
   */
  getStatus() {
    return {
      config: {
        maxBatchSize: this.config.maxBatchSize,
        batchTimeout: this.config.batchTimeout,
        maxConcurrentBatches: this.config.maxConcurrentBatches,
        enableCaching: this.config.enableCaching,
        enableDeduplication: this.config.enableDeduplication
      },
      
      state: {
        activeBatches: this.activeBatches,
        queuedBatches: this.batchQueue.length,
        cacheSize: this.embeddingCache.size,
        maxCacheSize: this.config.maxCacheSize
      },
      
      metrics: this.metrics,
      
      cacheStats: {
        ...this.cacheStats,
        hitRate: this.cacheStats.hits + this.cacheStats.misses > 0 ? 
          (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100).toFixed(2) + '%' : '0%'
      }
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    const clearedEntries = this.embeddingCache.size;
    this.embeddingCache.clear();
    this.cacheStats.hits = 0;
    this.cacheStats.misses = 0;
    this.cacheStats.evictions = 0;
    
    console.log(`🧹 Cleared ${clearedEntries} cached embeddings`);
    
    return clearedEntries;
  }

  /**
   * Initialize cache directory
   */
  async initializeCache() {
    try {
      await fs.mkdir(this.config.cacheDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize embedding cache directory:', error);
    }
  }
}

module.exports = new EmbeddingOptimizationService();