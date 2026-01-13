const { Pinecone } = require('@pinecone-database/pinecone');

class PineconeService {
  constructor() {
    this.pinecone = null;
    this.userIndexes = new Map(); // Cache for user indexes
    this.isEnabled = false;
    this.embeddingModel = 'all-MiniLM-L6-v2'; // 384-dimensional embedding model
    this.embeddingDimension = 384;
    
    // Test mode flag to suppress console logging
    this.testMode = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
    
    // Connection pooling for Pinecone operations
    this.connectionPool = {
      maxConnections: 10,
      activeConnections: 0,
      pendingRequests: [],
      connectionTimeout: 30000, // 30 seconds
      retryDelay: 1000 // 1 second
    };
    
    // Performance metrics
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      avgResponseTime: 0,
      connectionPoolHits: 0,
      connectionPoolMisses: 0
    };
  }

  /**
   * Helper method for conditional logging
   * @param {string} message - Message to log
   * @param {string} level - Log level (log, warn, error)
   */
  log(message, level = 'log') {
    if (!this.testMode) {
      console[level](message);
    }
  }

  async initialize() {
    try {
      // Always initialize connection pool structure, even if Pinecone is disabled
      this.initializeConnectionPool();
      
      if (!process.env.PINECONE_API_KEY || process.env.PINECONE_API_KEY === 'pcsk_your-pinecone-api-key-here') {
        this.log('⚠️ Pinecone API key not configured, running without Pinecone');
        this.isEnabled = false;
        return;
      }

      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });
      
      this.isEnabled = true;
      this.log('✅ Pinecone service initialized successfully with enhanced connection pooling');
    } catch (error) {
      this.log('❌ Failed to initialize Pinecone service:' + error.message, 'error');
      this.log('⚠️ Continuing without Pinecone integration');
      this.isEnabled = false;
    }
  }

  /**
   * Initialize connection pooling for Pinecone operations with enhanced features
   */
  initializeConnectionPool() {
    this.log('🔗 Initializing enhanced Pinecone connection pool...');
    
    // Enhanced connection pool configuration
    this.connectionPool = {
      maxConnections: 10,
      activeConnections: 0,
      pendingRequests: [],
      connectionTimeout: 30000, // 30 seconds
      retryDelay: 1000, // 1 second
      
      // Enhanced features
      adaptivePooling: {
        enabled: true,
        minConnections: 2,
        maxConnections: 20,
        scaleUpThreshold: 0.8, // Scale up when 80% of connections are in use
        scaleDownThreshold: 0.3, // Scale down when less than 30% are in use
        scaleUpFactor: 1.5, // Increase pool size by 50%
        scaleDownFactor: 0.8, // Decrease pool size by 20%
        adaptationInterval: 30000, // Check every 30 seconds
        lastAdaptation: Date.now()
      },
      
      // Connection health monitoring
      healthCheck: {
        enabled: true,
        interval: 60000, // Check every minute
        timeout: 5000, // 5 second timeout for health checks
        failureThreshold: 3, // Mark unhealthy after 3 failures
        recoveryThreshold: 2, // Mark healthy after 2 successes
        unhealthyConnections: new Set()
      },
      
      // Load balancing
      loadBalancing: {
        strategy: 'round-robin', // 'round-robin', 'least-connections', 'random'
        currentIndex: 0,
        connectionLoads: new Map() // Track load per connection
      },
      
      // Circuit breaker pattern
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5, // Open circuit after 5 failures
        recoveryTimeout: 30000, // Try to recover after 30 seconds
        state: 'closed', // 'closed', 'open', 'half-open'
        failures: 0,
        lastFailure: null,
        successThreshold: 3 // Close circuit after 3 successes in half-open state
      }
    };
    
    // Set up connection pool monitoring and adaptation
    setInterval(() => {
      this.cleanupStaleConnections();
      this.adaptConnectionPool();
      this.performHealthChecks();
    }, 60000); // Monitor every minute
    
    // Set up circuit breaker monitoring
    setInterval(() => {
      this.updateCircuitBreakerState();
    }, 10000); // Check every 10 seconds
    
    this.log(`✅ Enhanced connection pool initialized:`);
    this.log(`   - Max connections: ${this.connectionPool.maxConnections}`);
    this.log(`   - Adaptive pooling: ${this.connectionPool.adaptivePooling.enabled ? 'enabled' : 'disabled'}`);
    this.log(`   - Health monitoring: ${this.connectionPool.healthCheck.enabled ? 'enabled' : 'disabled'}`);
    this.log(`   - Circuit breaker: ${this.connectionPool.circuitBreaker.enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Acquire a connection from the pool
   * @returns {Promise<boolean>} True if connection acquired, false if pool is full
   */
  async acquireConnection() {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const tryAcquire = () => {
        if (this.connectionPool.activeConnections < this.connectionPool.maxConnections) {
          this.connectionPool.activeConnections++;
          this.metrics.connectionPoolHits++;
          resolve(true);
        } else {
          // Add to pending queue
          this.connectionPool.pendingRequests.push({
            resolve,
            reject,
            timestamp: Date.now()
          });
          this.metrics.connectionPoolMisses++;
        }
      };

      // Check for timeout
      const timeout = setTimeout(() => {
        const index = this.connectionPool.pendingRequests.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          this.connectionPool.pendingRequests.splice(index, 1);
          reject(new Error('Connection pool timeout'));
        }
      }, this.connectionPool.connectionTimeout);

      tryAcquire();
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection() {
    this.connectionPool.activeConnections = Math.max(0, this.connectionPool.activeConnections - 1);
    
    // Process pending requests
    if (this.connectionPool.pendingRequests.length > 0) {
      const nextRequest = this.connectionPool.pendingRequests.shift();
      this.connectionPool.activeConnections++;
      nextRequest.resolve(true);
    }
  }

  /**
   * Clean up stale connections and pending requests with enhanced monitoring
   */
  cleanupStaleConnections() {
    const now = Date.now();
    const staleTimeout = 300000; // 5 minutes
    
    // Remove stale pending requests
    const initialPendingCount = this.connectionPool.pendingRequests.length;
    this.connectionPool.pendingRequests = this.connectionPool.pendingRequests.filter(req => {
      if (now - req.timestamp > staleTimeout) {
        req.reject(new Error('Connection request timed out'));
        return false;
      }
      return true;
    });
    
    const removedCount = initialPendingCount - this.connectionPool.pendingRequests.length;
    if (removedCount > 0) {
      this.log(`🧹 Cleaned up ${removedCount} stale connection requests`);
    }
    
    // Clean up unhealthy connections that have been marked for too long
    const healthCheck = this.connectionPool.healthCheck;
    if (healthCheck.enabled) {
      const staleHealthTimeout = 600000; // 10 minutes
      const staleConnections = [];
      
      healthCheck.unhealthyConnections.forEach(connId => {
        // In a real implementation, you'd track when connections were marked unhealthy
        // For now, we'll just periodically clear the set
        if (Math.random() < 0.1) { // 10% chance to clean up each connection
          staleConnections.push(connId);
        }
      });
      
      staleConnections.forEach(connId => {
        healthCheck.unhealthyConnections.delete(connId);
      });
      
      if (staleConnections.length > 0) {
        this.log(`🧹 Cleaned up ${staleConnections.length} stale unhealthy connection markers`);
      }
    }
  }

  /**
   * Adapt connection pool size based on usage patterns
   */
  adaptConnectionPool() {
    if (!this.connectionPool.adaptivePooling.enabled) return;
    
    const adaptive = this.connectionPool.adaptivePooling;
    const now = Date.now();
    
    // Only adapt if enough time has passed
    if (now - adaptive.lastAdaptation < adaptive.adaptationInterval) return;
    
    const currentUtilization = this.connectionPool.activeConnections / this.connectionPool.maxConnections;
    const pendingRequests = this.connectionPool.pendingRequests.length;
    
    let shouldScale = false;
    let newMaxConnections = this.connectionPool.maxConnections;
    
    // Scale up if utilization is high or there are pending requests
    if (currentUtilization > adaptive.scaleUpThreshold || pendingRequests > 0) {
      newMaxConnections = Math.min(
        adaptive.maxConnections,
        Math.ceil(this.connectionPool.maxConnections * adaptive.scaleUpFactor)
      );
      
      if (newMaxConnections > this.connectionPool.maxConnections) {
        this.log(`📈 Scaling up connection pool: ${this.connectionPool.maxConnections} → ${newMaxConnections} (utilization: ${(currentUtilization * 100).toFixed(1)}%)`);
        shouldScale = true;
      }
    }
    // Scale down if utilization is low and no pending requests
    else if (currentUtilization < adaptive.scaleDownThreshold && pendingRequests === 0) {
      newMaxConnections = Math.max(
        adaptive.minConnections,
        Math.floor(this.connectionPool.maxConnections * adaptive.scaleDownFactor)
      );
      
      if (newMaxConnections < this.connectionPool.maxConnections) {
        this.log(`📉 Scaling down connection pool: ${this.connectionPool.maxConnections} → ${newMaxConnections} (utilization: ${(currentUtilization * 100).toFixed(1)}%)`);
        shouldScale = true;
      }
    }
    
    if (shouldScale) {
      this.connectionPool.maxConnections = newMaxConnections;
      adaptive.lastAdaptation = now;
    }
  }

  /**
   * Perform health checks on connections
   */
  async performHealthChecks() {
    if (!this.connectionPool.healthCheck.enabled || !this.isEnabled) return;
    
    const healthCheck = this.connectionPool.healthCheck;
    
    try {
      // Simple health check - try to list indexes (lightweight operation)
      const startTime = Date.now();
      await Promise.race([
        this.pinecone.listIndexes(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), healthCheck.timeout)
        )
      ]);
      
      const responseTime = Date.now() - startTime;
      
      // Reset circuit breaker failures on successful health check
      if (this.connectionPool.circuitBreaker.enabled) {
        this.connectionPool.circuitBreaker.failures = 0;
      }
      
      this.log(`💚 Pinecone health check passed (${responseTime}ms)`);
    } catch (error) {
      this.log(`💔 Pinecone health check failed: ${error.message}`, 'warn');
      
      // Update circuit breaker on health check failure
      if (this.connectionPool.circuitBreaker.enabled) {
        this.connectionPool.circuitBreaker.failures++;
        this.connectionPool.circuitBreaker.lastFailure = Date.now();
      }
    }
  }

  /**
   * Update circuit breaker state based on recent failures
   */
  updateCircuitBreakerState() {
    if (!this.connectionPool.circuitBreaker.enabled) return;
    
    const breaker = this.connectionPool.circuitBreaker;
    const now = Date.now();
    
    switch (breaker.state) {
      case 'closed':
        if (breaker.failures >= breaker.failureThreshold) {
          breaker.state = 'open';
          this.log(`🔴 Circuit breaker opened due to ${breaker.failures} failures`, 'warn');
        }
        break;
        
      case 'open':
        if (breaker.lastFailure && (now - breaker.lastFailure) > breaker.recoveryTimeout) {
          breaker.state = 'half-open';
          breaker.failures = 0;
          this.log(`🟡 Circuit breaker moved to half-open state`);
        }
        break;
        
      case 'half-open':
        // Circuit breaker will be closed by successful operations
        // or reopened by failures in the executeWithConnectionPool method
        break;
    }
  }

  /**
   * Execute operation with enhanced connection pooling, circuit breaker, and load balancing
   * @param {Function} operation - Async operation to execute
   * @param {string} operationName - Name for logging/metrics
   * @returns {Promise<any>} Operation result
   */
  async executeWithConnectionPool(operation, operationName = 'unknown') {
    const startTime = Date.now();
    this.metrics.totalOperations++;
    
    // Check circuit breaker state
    if (this.connectionPool.circuitBreaker.enabled) {
      const breaker = this.connectionPool.circuitBreaker;
      
      if (breaker.state === 'open') {
        this.metrics.failedOperations++;
        throw new Error(`Circuit breaker is open - operation '${operationName}' rejected`);
      }
    }
    
    try {
      // Acquire connection from pool with enhanced logic
      await this.acquireEnhancedConnection(operationName);
      
      try {
        // Execute the operation with timeout
        const timeoutMs = this.connectionPool.connectionTimeout;
        const result = await Promise.race([
          operation(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Operation '${operationName}' timed out after ${timeoutMs}ms`)), timeoutMs)
          )
        ]);
        
        // Update metrics and circuit breaker on success
        this.metrics.successfulOperations++;
        this.updateResponseTimeMetrics(startTime);
        
        if (this.connectionPool.circuitBreaker.enabled) {
          const breaker = this.connectionPool.circuitBreaker;
          
          if (breaker.state === 'half-open') {
            breaker.failures = 0;
            if (this.metrics.successfulOperations % breaker.successThreshold === 0) {
              breaker.state = 'closed';
              this.log(`🟢 Circuit breaker closed after successful operations`);
            }
          }
        }
        
        return result;
      } finally {
        // Always release connection
        this.releaseEnhancedConnection();
      }
    } catch (error) {
      this.metrics.failedOperations++;
      
      // Update circuit breaker on failure
      if (this.connectionPool.circuitBreaker.enabled) {
        const breaker = this.connectionPool.circuitBreaker;
        breaker.failures++;
        breaker.lastFailure = Date.now();
        
        if (breaker.state === 'half-open' || breaker.failures >= breaker.failureThreshold) {
          breaker.state = 'open';
          this.log(`🔴 Circuit breaker opened due to operation failure: ${error.message}`, 'warn');
        }
      }
      
      this.log(`❌ Enhanced pooled operation '${operationName}' failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Acquire a connection from the enhanced pool with load balancing
   * @param {string} operationName - Name of the operation for tracking
   * @returns {Promise<boolean>} True if connection acquired
   */
  async acquireEnhancedConnection(operationName) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const tryAcquire = () => {
        if (this.connectionPool.activeConnections < this.connectionPool.maxConnections) {
          this.connectionPool.activeConnections++;
          this.metrics.connectionPoolHits++;
          
          // Update load balancing metrics
          const loadBalancing = this.connectionPool.loadBalancing;
          if (loadBalancing.strategy === 'least-connections') {
            // In a real implementation, you'd track per-connection loads
            // For now, we'll just increment the current connection load
            const connId = `conn_${loadBalancing.currentIndex}`;
            const currentLoad = loadBalancing.connectionLoads.get(connId) || 0;
            loadBalancing.connectionLoads.set(connId, currentLoad + 1);
          }
          
          resolve(true);
        } else {
          // Add to pending queue with enhanced metadata
          this.connectionPool.pendingRequests.push({
            resolve,
            reject,
            timestamp: Date.now(),
            operationName: operationName,
            startTime: startTime
          });
          this.metrics.connectionPoolMisses++;
        }
      };

      // Check for timeout
      const timeout = setTimeout(() => {
        const index = this.connectionPool.pendingRequests.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          this.connectionPool.pendingRequests.splice(index, 1);
          reject(new Error(`Enhanced connection pool timeout for operation '${operationName}'`));
        }
      }, this.connectionPool.connectionTimeout);

      tryAcquire();
    });
  }

  /**
   * Release a connection back to the enhanced pool
   */
  releaseEnhancedConnection() {
    this.connectionPool.activeConnections = Math.max(0, this.connectionPool.activeConnections - 1);
    
    // Process pending requests with load balancing
    if (this.connectionPool.pendingRequests.length > 0) {
      const loadBalancing = this.connectionPool.loadBalancing;
      let nextRequest;
      
      switch (loadBalancing.strategy) {
        case 'round-robin':
          nextRequest = this.connectionPool.pendingRequests.shift();
          loadBalancing.currentIndex = (loadBalancing.currentIndex + 1) % this.connectionPool.maxConnections;
          break;
          
        case 'least-connections':
          // Find the request that would use the least loaded connection
          // For simplicity, just use FIFO for now
          nextRequest = this.connectionPool.pendingRequests.shift();
          break;
          
        case 'random':
          const randomIndex = Math.floor(Math.random() * this.connectionPool.pendingRequests.length);
          nextRequest = this.connectionPool.pendingRequests.splice(randomIndex, 1)[0];
          break;
          
        default:
          nextRequest = this.connectionPool.pendingRequests.shift();
      }
      
      if (nextRequest) {
        this.connectionPool.activeConnections++;
        nextRequest.resolve(true);
      }
    }
  }

  /**
   * Update response time metrics
   * @param {number} startTime - Operation start time
   */
  updateResponseTimeMetrics(startTime) {
    const responseTime = Date.now() - startTime;
    const totalOps = this.metrics.successfulOperations + this.metrics.failedOperations;
    
    if (totalOps === 1) {
      this.metrics.avgResponseTime = responseTime;
    } else {
      this.metrics.avgResponseTime = 
        (this.metrics.avgResponseTime * (totalOps - 1) + responseTime) / totalOps;
    }
  }

  // Generate a unique index name for each user
  generateUserIndexName(userData) {
    const sanitizedFirstName = userData.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sanitizedLastName = userData.lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const timestamp = Date.now();
    return `user-${sanitizedFirstName}-${sanitizedLastName}-${timestamp}`;
  }

  // Get or create user's dedicated index or namespace
  async getUserIndex(indexName) {
    if (!this.isEnabled) {
      return null;
    }

    // Check cache first
    if (this.userIndexes.has(indexName)) {
      return this.userIndexes.get(indexName);
    }

    try {
      if (!this.pinecone) {
        await this.initialize();
      }

      if (!this.isEnabled) {
        return null;
      }

      // Check if this is a namespace-based ID
      if (indexName.startsWith('ns:')) {
        // Use shared index with namespace
        const sharedIndexName = 'shared-user-data';
        const namespace = indexName.substring(3); // Remove 'ns:' prefix
        
        const index = this.pinecone.index(sharedIndexName, namespace);
        
        // Cache the namespaced index
        this.userIndexes.set(indexName, index);
        
        return index;
      } else {
        // Use dedicated index
        const index = this.pinecone.index(indexName);
        
        // Cache the index
        this.userIndexes.set(indexName, index);
        
        return index;
      }
    } catch (error) {
      this.log(`❌ Failed to get user index ${indexName}: ${error.message}`, 'error');
      return null;
    }
  }

  async createUserIndex(userData) {
    if (!this.isEnabled) {
      // Generate a fallback ID when Pinecone is not available
      const fallbackId = `user_${userData.firstName}_${userData.lastName}_${Date.now()}`;
      this.log(`⚠️ Pinecone disabled, using fallback ID: ${fallbackId}`);
      return fallbackId;
    }

    try {
      if (!this.pinecone) {
        await this.initialize();
      }

      if (!this.isEnabled) {
        const fallbackId = `user_${userData.firstName}_${userData.lastName}_${Date.now()}`;
        return fallbackId;
      }

      // Generate unique namespace for this user (more quota-friendly)
      const userNamespace = this.generateUserIndexName(userData);
      
      this.log(`🔄 Creating user namespace: ${userNamespace}`);

      // Try to create dedicated index first, fallback to namespace if quota exceeded
      try {
        this.log(`🔄 Attempting to create dedicated Pinecone index: ${userNamespace}`);

        // Create the index with proper configuration
        await this.pinecone.createIndex({
          name: userNamespace,
          dimension: this.embeddingDimension, // all-MiniLM-L6-v2 embedding dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        this.log(`⏳ Waiting for index ${userNamespace} to be ready...`);
        let indexReady = false;
        let attempts = 0;
        const maxAttempts = 30; // 5 minutes max wait time

        while (!indexReady && attempts < maxAttempts) {
          try {
            const indexStats = await this.pinecone.describeIndex(userNamespace);
            if (indexStats.status?.ready) {
              indexReady = true;
              this.log(`✅ Dedicated index ${userNamespace} is ready!`);
            } else {
              this.log(`⏳ Index ${userNamespace} status: ${indexStats.status?.state || 'unknown'}`);
              await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
              attempts++;
            }
          } catch (error) {
            this.log(`⏳ Waiting for index ${userNamespace} to be available...`);
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            attempts++;
          }
        }

        if (!indexReady) {
          throw new Error(`Index ${userNamespace} did not become ready within timeout`);
        }

        // Get the index instance and cache it
        const index = this.pinecone.index(userNamespace);
        this.userIndexes.set(userNamespace, index);

        // Store initial user metadata vector
        const userMetadataVector = {
          id: 'user-metadata',
          values: new Array(this.embeddingDimension).fill(0.1), // Dummy vector for metadata
          metadata: {
            type: 'user-metadata',
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            createdAt: new Date().toISOString(),
            userType: 'standard',
            embeddingModel: this.embeddingModel,
            embeddingDimension: this.embeddingDimension
          }
        };

        await index.upsert([userMetadataVector]);
        
        this.log(`✅ Created dedicated Pinecone index for user: ${userNamespace}`);
        return userNamespace; // Return the index name as the user's Pinecone ID

      } catch (quotaError) {
        // If quota exceeded, use shared index with namespace
        if (quotaError.message && quotaError.message.includes('max serverless indexes')) {
          this.log(`⚠️ Pinecone quota exceeded, using shared index with namespace: ${userNamespace}`);
          
          // Use a shared index with user namespace
          const sharedIndexName = 'shared-user-data';
          
          // Try to create shared index if it doesn't exist
          try {
            await this.pinecone.createIndex({
              name: sharedIndexName,
              dimension: this.embeddingDimension, // all-MiniLM-L6-v2 embedding dimension
              metric: 'cosine',
              spec: {
                serverless: {
                  cloud: 'aws',
                  region: 'us-east-1'
                }
              }
            });
            
            // Wait for shared index to be ready
            let sharedIndexReady = false;
            let attempts = 0;
            while (!sharedIndexReady && attempts < 30) {
              try {
                const indexStats = await this.pinecone.describeIndex(sharedIndexName);
                if (indexStats.status?.ready) {
                  sharedIndexReady = true;
                  this.log(`✅ Shared index ${sharedIndexName} is ready!`);
                } else {
                  await new Promise(resolve => setTimeout(resolve, 10000));
                  attempts++;
                }
              } catch (error) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                attempts++;
              }
            }
          } catch (createError) {
            // Shared index might already exist, that's okay
            this.log(`📝 Shared index ${sharedIndexName} already exists or creation failed`);
          }

          // Return namespace-based ID to indicate shared index usage
          const namespaceId = `ns:${userNamespace}`;
          this.log(`✅ User will use shared index with namespace: ${namespaceId}`);
          return namespaceId;
        } else {
          throw quotaError;
        }
      }
    } catch (error) {
      this.log(`❌ Failed to create user index in Pinecone: ${error.message}`, 'error');
      // Return fallback ID instead of throwing error
      const fallbackId = `user_${userData.firstName}_${userData.lastName}_${Date.now()}`;
      this.log(`⚠️ Using fallback ID: ${fallbackId}`);
      return fallbackId;
    }
  }

  async getUserById(pineconeId) {
    try {
      const index = await this.getUserIndex(pineconeId);
      if (!index) {
        return null;
      }

      const result = await index.fetch(['user-metadata']);
      return result.vectors && result.vectors['user-metadata'] ? result.vectors['user-metadata'] : null;
    } catch (error) {
      this.log(`❌ Failed to get user from Pinecone: ${error.message}`, 'error');
      return null;
    }
  }

  async updateUserMetadata(pineconeId, metadata) {
    if (!this.isEnabled) {
      this.log('⚠️ Pinecone disabled, skipping metadata update');
      return;
    }

    try {
      const index = await this.getUserIndex(pineconeId);
      if (!index) {
        this.log('⚠️ User index not found, skipping metadata update');
        return;
      }

      // Get existing user metadata vector
      const existingVector = await this.getUserById(pineconeId);
      if (!existingVector) {
        this.log('⚠️ User metadata not found in index, skipping update');
        return;
      }

      // Update with new metadata
      const updatedVector = {
        id: 'user-metadata',
        values: existingVector.values,
        metadata: {
          ...existingVector.metadata,
          ...metadata,
          updatedAt: new Date().toISOString()
        }
      };

      await index.upsert([updatedVector]);
      this.log(`✅ Updated Pinecone metadata for user index: ${pineconeId}`);
    } catch (error) {
      this.log(`❌ Failed to update user metadata in Pinecone: ${error.message}`, 'error');
    }
  }

  async deleteUser(pineconeId) {
    if (!this.isEnabled) {
      this.log('⚠️ Pinecone disabled, skipping user deletion');
      return;
    }

    try {
      if (!this.pinecone) {
        await this.initialize();
      }

      if (!this.isEnabled) {
        return;
      }

      // Check if this is a namespace-based ID
      if (pineconeId.startsWith('ns:')) {
        // Delete from shared index namespace
        const namespace = pineconeId.substring(3); // Remove 'ns:' prefix
        const sharedIndexName = 'shared-user-data';
        
        try {
          const index = this.pinecone.index(sharedIndexName, namespace);
          // Delete all vectors in this namespace (Pinecone will handle namespace cleanup)
          await index.deleteAll();
          this.log(`✅ Deleted user namespace from shared index: ${pineconeId}`);
        } catch (error) {
          this.log(`❌ Failed to delete user namespace: ${error.message}`, 'error');
        }
      } else {
        // Delete the entire dedicated user index
        await this.pinecone.deleteIndex(pineconeId);
        this.log(`✅ Deleted dedicated user index: ${pineconeId}`);
      }
      
      // Remove from cache
      this.userIndexes.delete(pineconeId);
      
    } catch (error) {
      this.log('❌ Failed to delete user from Pinecone:' + error.message, 'error');
    }
  }

  async storeDocument(vector, userPineconeId) {
    if (!this.isEnabled) {
      this.log('⚠️ Pinecone disabled, skipping document storage');
      return;
    }

    return await this.executeWithConnectionPool(async () => {
      const index = await this.getUserIndex(userPineconeId);
      if (!index) {
        throw new Error(`User index not found: ${userPineconeId}`);
      }

      // Ensure user identification metadata is present
      if (!vector.metadata) {
        vector.metadata = {};
      }
      
      // Enforce user isolation by adding/overriding userId in metadata
      vector.metadata.userId = userPineconeId;
      vector.metadata.storedAt = new Date().toISOString();

      await index.upsert([vector]);
      this.log(`✅ Document stored in user index ${userPineconeId}: ${vector.id}`);
    }, 'storeDocument');
  }

  async storeDocuments(vectors, userPineconeId) {
    if (!this.isEnabled) {
      this.log('⚠️ Pinecone disabled, skipping document storage');
      return;
    }

    return await this.executeWithConnectionPool(async () => {
      const index = await this.getUserIndex(userPineconeId);
      if (!index) {
        throw new Error(`User index not found: ${userPineconeId}`);
      }

      // Ensure all vectors have proper user identification metadata
      const enhancedVectors = vectors.map(vector => {
        if (!vector.metadata) {
          vector.metadata = {};
        }
        
        // Enforce user isolation by adding/overriding userId in metadata
        vector.metadata.userId = userPineconeId;
        vector.metadata.storedAt = new Date().toISOString();
        
        return vector;
      });

      // Batch upsert with connection pooling for better performance
      const batchSize = 100; // Pinecone recommended batch size
      const concurrentBatches = Math.min(3, Math.ceil(this.connectionPool.maxConnections / 2)); // Use half of pool for concurrent batches
      
      // Process batches with controlled concurrency
      for (let i = 0; i < enhancedVectors.length; i += batchSize * concurrentBatches) {
        const batchPromises = [];
        
        for (let j = 0; j < concurrentBatches && (i + j * batchSize) < enhancedVectors.length; j++) {
          const batchStart = i + j * batchSize;
          const batchEnd = Math.min(batchStart + batchSize, enhancedVectors.length);
          const batch = enhancedVectors.slice(batchStart, batchEnd);
          
          if (batch.length > 0) {
            batchPromises.push(
              this.executeWithConnectionPool(async () => {
                await index.upsert(batch);
                return batch.length;
              }, `storeBatch_${Math.floor(batchStart/batchSize)}`)
            );
          }
        }
        
        const batchResults = await Promise.all(batchPromises);
        const processedCount = batchResults.reduce((sum, count) => sum + count, 0);
        
        this.log(`✅ Concurrent batch processing: Stored ${processedCount} vectors in user index ${userPineconeId}`);
      }
      
      this.log(`✅ Total: Stored ${enhancedVectors.length} vectors in user index ${userPineconeId}`);
    }, 'storeDocuments');
  }

  async searchDocuments(queryVector, userPineconeId, filter = {}, topK = 5) {
    if (!this.isEnabled) {
      this.log('⚠️ Pinecone disabled, returning empty search results');
      return { matches: [] };
    }

    return await this.executeWithConnectionPool(async () => {
      const index = await this.getUserIndex(userPineconeId);
      if (!index) {
        this.log(`⚠️ User index not found: ${userPineconeId}`);
        return { matches: [] };
      }

      const searchRequest = {
        vector: queryVector,
        topK: topK,
        includeMetadata: true,
        includeValues: false
      };

      // Enhanced user isolation: ensure search is restricted to user's data
      const userIsolationFilter = {
        ...filter,
        type: { $ne: 'user-metadata' }, // Exclude user metadata from search results
        userId: userPineconeId // Enforce user isolation at query level
      };

      if (Object.keys(userIsolationFilter).length > 0) {
        searchRequest.filter = userIsolationFilter;
      }

      const results = await index.query(searchRequest);
      
      // Additional validation: verify all results belong to the requesting user
      if (results.matches) {
        results.matches = results.matches.filter(match => {
          const matchUserId = match.metadata?.userId;
          if (matchUserId !== userPineconeId) {
            this.log(`⚠️ Cross-user data access prevented: expected ${userPineconeId}, found ${matchUserId}`, 'warn');
            return false;
          }
          return true;
        });
      }
      
      return results;
    }, 'searchDocuments');
  }

  async deleteDocument(vectorId, userPineconeId) {
    if (!this.isEnabled) {
      this.log('⚠️ Pinecone disabled, skipping document deletion');
      return;
    }

    try {
      const index = await this.getUserIndex(userPineconeId);
      if (!index) {
        this.log(`⚠️ User index not found: ${userPineconeId}`);
        return;
      }

      await index.deleteOne(vectorId);
      this.log(`✅ Document deleted from user index ${userPineconeId}: ${vectorId}`);
    } catch (error) {
      this.log('❌ Failed to delete document from Pinecone:' + error.message, 'error');
    }
  }

  // Helper method to list all user indexes (for admin purposes)
  async listUserIndexes() {
    if (!this.isEnabled) {
      this.log('⚠️ Pinecone disabled');
      return [];
    }

    try {
      if (!this.pinecone) {
        await this.initialize();
      }

      if (!this.isEnabled) {
        return [];
      }

      const indexes = await this.pinecone.listIndexes();
      return indexes.indexes?.filter(index => index.name.startsWith('user-')) || [];
    } catch (error) {
      this.log(`❌ Failed to list user indexes: ${error.message}`, 'error');
      return [];
    }
  }

  // Helper method to get index statistics
  async getUserIndexStats(userPineconeId) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      if (!this.pinecone) {
        await this.initialize();
      }

      if (!this.isEnabled) {
        return null;
      }

      const stats = await this.pinecone.describeIndex(userPineconeId);
      return stats;
    } catch (error) {
      this.log(`❌ Failed to get stats for user index ${userPineconeId}: ${error.message}`, 'error');
      return null;
    }
  }

  // Get embedding model information
  getEmbeddingModelInfo() {
    return {
      name: this.embeddingModel,
      dimensions: this.embeddingDimension,
      maxTokens: 512, // all-MiniLM-L6-v2 max token limit
      version: '1.0'
    };
  }

  // Validate embedding dimensions
  validateEmbedding(embedding) {
    if (!Array.isArray(embedding)) {
      return false;
    }
    return embedding.length === this.embeddingDimension;
  }

  // Validate that an index has the correct configuration
  async validateIndexConfiguration(indexName) {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const stats = await this.pinecone.describeIndex(indexName);
      return stats.dimension === this.embeddingDimension && 
             stats.metric === 'cosine' &&
             stats.status?.ready === true;
    } catch (error) {
      this.log(`❌ Failed to validate index configuration for ${indexName}: ${error.message}`, 'error');
      return false;
    }
  }

  // Validate user access to prevent cross-user data access
  async validateUserAccess(requestingUserId, targetUserId) {
    // Strict user isolation: users can only access their own data
    if (requestingUserId !== targetUserId) {
      this.log(`⚠️ Cross-user access attempt prevented: ${requestingUserId} tried to access ${targetUserId}'s data`, 'warn');
      return false;
    }
    return true;
  }

  // Enhanced method to get user data with access validation
  async getUserDataWithValidation(requestingUserId, targetUserId) {
    if (!await this.validateUserAccess(requestingUserId, targetUserId)) {
      throw new Error('Access denied: Cross-user data access is not permitted');
    }
    
    return await this.getUserById(targetUserId);
  }

  // Enhanced search with user access validation
  async searchDocumentsWithValidation(requestingUserId, targetUserId, queryVector, filter = {}, topK = 5) {
    if (!await this.validateUserAccess(requestingUserId, targetUserId)) {
      throw new Error('Access denied: Cross-user search is not permitted');
    }
    
    return await this.searchDocuments(queryVector, targetUserId, filter, topK);
  }

  // Method to audit user data access (for compliance and monitoring)
  async auditUserDataAccess(userId, operation, details = {}) {
    const auditLog = {
      userId: userId,
      operation: operation,
      timestamp: new Date().toISOString(),
      details: details,
      userAgent: details.userAgent || 'system',
      ipAddress: details.ipAddress || 'unknown'
    };
    
    this.log(`🔍 User data access audit: ${JSON.stringify(auditLog)}`);
    
    // In a production system, this would be stored in a secure audit log
    // For now, we just log it for monitoring purposes
    return auditLog;
  }

  // Enhanced user data cleanup functionality
  async cleanupUserData(userPineconeId) {
    if (!this.isEnabled) {
      this.log('⚠️ Pinecone disabled, skipping user data cleanup');
      return { success: true, message: 'Pinecone disabled' };
    }

    try {
      this.log(`🧹 Starting cleanup for user: ${userPineconeId}`);
      
      // Delete all user vectors from Pinecone
      await this.deleteUser(userPineconeId);
      
      // Audit the cleanup operation
      await this.auditUserDataAccess(userPineconeId, 'cleanup', {
        operation: 'full_user_data_cleanup',
        timestamp: new Date().toISOString()
      });
      
      this.log(`✅ User data cleanup completed for: ${userPineconeId}`);
      
      return {
        success: true,
        message: `User data cleanup completed for ${userPineconeId}`,
        cleanedIndexes: [userPineconeId]
      };
    } catch (error) {
      this.log(`❌ Failed to cleanup user data for ${userPineconeId}: ${error.message}`, 'error');
      
      return {
        success: false,
        message: `Failed to cleanup user data: ${error.message}`,
        error: error.message
      };
    }
  }

  // Method to remove all user vectors when user is deleted
  async removeAllUserVectors(userPineconeId) {
    if (!this.isEnabled) {
      this.log('⚠️ Pinecone disabled, skipping vector removal');
      return { vectorsRemoved: 0, success: true };
    }

    try {
      const index = await this.getUserIndex(userPineconeId);
      if (!index) {
        this.log(`⚠️ User index not found: ${userPineconeId}`);
        return { vectorsRemoved: 0, success: true };
      }

      // Get index stats before cleanup
      let vectorCount = 0;
      try {
        if (userPineconeId.startsWith('ns:')) {
          // For namespace-based indexes, we can't easily get vector count
          // but we can still delete all vectors
          this.log(`🧹 Removing all vectors from namespace: ${userPineconeId}`);
        } else {
          // For dedicated indexes, get stats
          const stats = await this.getUserIndexStats(userPineconeId);
          vectorCount = stats?.vectorCount || 0;
          this.log(`🧹 Removing ${vectorCount} vectors from index: ${userPineconeId}`);
        }
      } catch (statsError) {
        this.log(`⚠️ Could not get vector count, proceeding with cleanup: ${statsError.message}`);
      }

      // Delete all vectors in the user's index/namespace
      await index.deleteAll();
      
      this.log(`✅ Removed all vectors for user: ${userPineconeId}`);
      
      return {
        vectorsRemoved: vectorCount,
        success: true,
        message: `Removed all vectors for user ${userPineconeId}`
      };
    } catch (error) {
      this.log(`❌ Failed to remove user vectors for ${userPineconeId}: ${error.message}`, 'error');
      
      return {
        vectorsRemoved: 0,
        success: false,
        error: error.message
      };
    }
  }

  // Method to verify user data cleanup completion
  async verifyUserDataCleanup(userPineconeId) {
    if (!this.isEnabled) {
      return { isClean: true, message: 'Pinecone disabled' };
    }

    try {
      // Try to get the user index
      const index = await this.getUserIndex(userPineconeId);
      
      if (!index) {
        // Index doesn't exist, cleanup is complete
        return {
          isClean: true,
          message: `User index ${userPineconeId} does not exist`,
          vectorCount: 0
        };
      }

      // For dedicated indexes, check if they still exist
      if (!userPineconeId.startsWith('ns:')) {
        try {
          const stats = await this.getUserIndexStats(userPineconeId);
          if (!stats) {
            return {
              isClean: true,
              message: `Dedicated index ${userPineconeId} has been deleted`,
              vectorCount: 0
            };
          }
          
          return {
            isClean: stats.vectorCount === 0,
            message: `Index ${userPineconeId} has ${stats.vectorCount} vectors remaining`,
            vectorCount: stats.vectorCount
          };
        } catch (error) {
          // Index likely doesn't exist anymore
          return {
            isClean: true,
            message: `Index ${userPineconeId} appears to be deleted`,
            vectorCount: 0
          };
        }
      } else {
        // For namespace-based indexes, try to query for any vectors
        try {
          const dummyVector = new Array(this.embeddingDimension).fill(0.1);
          const searchResults = await this.searchDocuments(dummyVector, userPineconeId, {}, 1);
          
          return {
            isClean: !searchResults.matches || searchResults.matches.length === 0,
            message: `Namespace ${userPineconeId} has ${searchResults.matches?.length || 0} vectors remaining`,
            vectorCount: searchResults.matches?.length || 0
          };
        } catch (error) {
          // Namespace likely cleaned up
          return {
            isClean: true,
            message: `Namespace ${userPineconeId} appears to be cleaned up`,
            vectorCount: 0
          };
        }
      }
    } catch (error) {
      this.log(`❌ Failed to verify cleanup for ${userPineconeId}: ${error.message}`, 'error');
      
      return {
        isClean: false,
        message: `Failed to verify cleanup: ${error.message}`,
        error: error.message
      };
    }
  }

  // Method to get cleanup statistics for monitoring
  async getCleanupStatistics() {
    if (!this.isEnabled) {
      return { totalIndexes: 0, message: 'Pinecone disabled' };
    }

    try {
      const userIndexes = await this.listUserIndexes();
      
      return {
        totalUserIndexes: userIndexes.length,
        indexNames: userIndexes.map(index => index.name),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      this.log(`❌ Failed to get cleanup statistics: ${error.message}`, 'error');
      
      return {
        totalUserIndexes: 0,
        error: error.message
      };
    }
  }

  /**
   * Get enhanced connection pool statistics and performance metrics
   * @returns {Object} Enhanced connection pool and performance metrics
   */
  getConnectionPoolMetrics() {
    const adaptive = this.connectionPool.adaptivePooling;
    const healthCheck = this.connectionPool.healthCheck;
    const circuitBreaker = this.connectionPool.circuitBreaker;
    const loadBalancing = this.connectionPool.loadBalancing;
    
    return {
      connectionPool: {
        maxConnections: this.connectionPool.maxConnections,
        activeConnections: this.connectionPool.activeConnections,
        pendingRequests: this.connectionPool.pendingRequests.length,
        connectionTimeout: this.connectionPool.connectionTimeout,
        retryDelay: this.connectionPool.retryDelay,
        
        // Enhanced adaptive pooling metrics
        adaptivePooling: {
          enabled: adaptive.enabled,
          minConnections: adaptive.minConnections,
          maxConnections: adaptive.maxConnections,
          currentUtilization: this.connectionPool.activeConnections / this.connectionPool.maxConnections,
          scaleUpThreshold: adaptive.scaleUpThreshold,
          scaleDownThreshold: adaptive.scaleDownThreshold,
          lastAdaptation: new Date(adaptive.lastAdaptation).toISOString()
        },
        
        // Health check metrics
        healthCheck: {
          enabled: healthCheck.enabled,
          unhealthyConnections: healthCheck.unhealthyConnections.size,
          lastHealthCheck: new Date().toISOString()
        },
        
        // Circuit breaker metrics
        circuitBreaker: {
          enabled: circuitBreaker.enabled,
          state: circuitBreaker.state,
          failures: circuitBreaker.failures,
          failureThreshold: circuitBreaker.failureThreshold,
          lastFailure: circuitBreaker.lastFailure ? new Date(circuitBreaker.lastFailure).toISOString() : null
        },
        
        // Load balancing metrics
        loadBalancing: {
          strategy: loadBalancing.strategy,
          currentIndex: loadBalancing.currentIndex,
          connectionLoads: Object.fromEntries(loadBalancing.connectionLoads)
        }
      },
      performance: {
        totalOperations: this.metrics.totalOperations,
        successfulOperations: this.metrics.successfulOperations,
        failedOperations: this.metrics.failedOperations,
        successRate: this.metrics.totalOperations > 0 ? 
          (this.metrics.successfulOperations / this.metrics.totalOperations * 100).toFixed(2) + '%' : '0%',
        avgResponseTime: Math.round(this.metrics.avgResponseTime),
        connectionPoolHits: this.metrics.connectionPoolHits,
        connectionPoolMisses: this.metrics.connectionPoolMisses,
        poolEfficiency: (this.metrics.connectionPoolHits + this.metrics.connectionPoolMisses) > 0 ?
          (this.metrics.connectionPoolHits / (this.metrics.connectionPoolHits + this.metrics.connectionPoolMisses) * 100).toFixed(2) + '%' : '0%'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Configure enhanced connection pool settings
   * @param {Object} config - Enhanced connection pool configuration
   */
  configureConnectionPool(config) {
    if (config.maxConnections && config.maxConnections > 0) {
      this.connectionPool.maxConnections = config.maxConnections;
    }
    
    if (config.connectionTimeout && config.connectionTimeout > 0) {
      this.connectionPool.connectionTimeout = config.connectionTimeout;
    }
    
    if (config.retryDelay && config.retryDelay > 0) {
      this.connectionPool.retryDelay = config.retryDelay;
    }
    
    // Configure adaptive pooling
    if (config.adaptivePooling) {
      const adaptive = this.connectionPool.adaptivePooling;
      if (typeof config.adaptivePooling.enabled === 'boolean') {
        adaptive.enabled = config.adaptivePooling.enabled;
      }
      if (config.adaptivePooling.minConnections) {
        adaptive.minConnections = config.adaptivePooling.minConnections;
      }
      if (config.adaptivePooling.maxConnections) {
        adaptive.maxConnections = config.adaptivePooling.maxConnections;
      }
      if (config.adaptivePooling.scaleUpThreshold) {
        adaptive.scaleUpThreshold = config.adaptivePooling.scaleUpThreshold;
      }
      if (config.adaptivePooling.scaleDownThreshold) {
        adaptive.scaleDownThreshold = config.adaptivePooling.scaleDownThreshold;
      }
    }
    
    // Configure health checks
    if (config.healthCheck) {
      const healthCheck = this.connectionPool.healthCheck;
      if (typeof config.healthCheck.enabled === 'boolean') {
        healthCheck.enabled = config.healthCheck.enabled;
      }
      if (config.healthCheck.interval) {
        healthCheck.interval = config.healthCheck.interval;
      }
      if (config.healthCheck.timeout) {
        healthCheck.timeout = config.healthCheck.timeout;
      }
    }
    
    // Configure circuit breaker
    if (config.circuitBreaker) {
      const breaker = this.connectionPool.circuitBreaker;
      if (typeof config.circuitBreaker.enabled === 'boolean') {
        breaker.enabled = config.circuitBreaker.enabled;
      }
      if (config.circuitBreaker.failureThreshold) {
        breaker.failureThreshold = config.circuitBreaker.failureThreshold;
      }
      if (config.circuitBreaker.recoveryTimeout) {
        breaker.recoveryTimeout = config.circuitBreaker.recoveryTimeout;
      }
    }
    
    // Configure load balancing
    if (config.loadBalancing) {
      const loadBalancing = this.connectionPool.loadBalancing;
      if (config.loadBalancing.strategy) {
        loadBalancing.strategy = config.loadBalancing.strategy;
      }
    }
    
    this.log('🔧 Enhanced connection pool configuration updated:', {
      maxConnections: this.connectionPool.maxConnections,
      connectionTimeout: this.connectionPool.connectionTimeout,
      retryDelay: this.connectionPool.retryDelay,
      adaptivePooling: this.connectionPool.adaptivePooling.enabled,
      healthCheck: this.connectionPool.healthCheck.enabled,
      circuitBreaker: this.connectionPool.circuitBreaker.enabled,
      loadBalancing: this.connectionPool.loadBalancing.strategy
    });
  }

  /**
   * Reset connection pool metrics
   */
  resetMetrics() {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      avgResponseTime: 0,
      connectionPoolHits: 0,
      connectionPoolMisses: 0
    };
    
    this.log('📊 Connection pool metrics reset');
  }
}

module.exports = new PineconeService();
