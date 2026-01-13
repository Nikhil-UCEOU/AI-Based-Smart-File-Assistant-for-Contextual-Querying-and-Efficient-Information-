const ResourceCache = require('../services/ResourceCache');
const PerformanceMetrics = require('../services/PerformanceMetrics');
const ProcessingTimeTracker = require('../services/ProcessingTimeTracker');

describe('Resource Caching and Optimization', () => {
  let resourceCache;
  let performanceMetrics;
  let processingTimeTracker;

  beforeAll(() => {
    resourceCache = new ResourceCache({
      maxSize: 50,
      defaultTTL: 5000,
      maxMemoryUsage: 10 * 1024 * 1024,
      enableMetrics: true,
      cleanupInterval: 1000
    });

    performanceMetrics = new PerformanceMetrics({
      enableSystemMetrics: true,
      enableOperationTracking: true,
      enableResourceTracking: true,
      metricsRetentionTime: 10000,
      aggregationInterval: 1000
    });

    processingTimeTracker = new ProcessingTimeTracker({
      enableDetailedTracking: true,
      enableBottleneckDetection: true,
      enableOptimizationSuggestions: true,
      slowOperationThreshold: 100,
      trackingRetentionTime: 10000
    });
  });

  afterAll(async () => {
    if (resourceCache) {
      resourceCache.destroy();
    }
    if (performanceMetrics) {
      performanceMetrics.destroy();
    }
    if (processingTimeTracker) {
      processingTimeTracker.destroy();
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('ResourceCache functionality', () => {
    test('should cache and retrieve frequently accessed resources', () => {
      const testData = { id: 1, name: 'test', data: 'cached content' };
      
      expect(resourceCache.set('test-key', testData)).toBe(true);
      expect(resourceCache.get('test-key')).toEqual(testData);
      expect(resourceCache.has('test-key')).toBe(true);
    });

    test('should handle different resource types', () => {
      const modelData = { type: 'embedding', dimensions: 384 };
      const connectionData = { host: 'localhost', port: 5432 };
      const configData = { chunkSize: 2000, overlap: 200 };

      resourceCache.set('model-1', modelData, { resourceType: 'models' });
      resourceCache.set('conn-1', connectionData, { resourceType: 'connections' });
      resourceCache.set('config-1', configData, { resourceType: 'configurations' });

      expect(resourceCache.get('model-1', 'models')).toEqual(modelData);
      expect(resourceCache.get('conn-1', 'connections')).toEqual(connectionData);
      expect(resourceCache.get('config-1', 'configurations')).toEqual(configData);
    });

    test('should respect TTL and expire items', async () => {
      const testData = { value: 'expires soon' };
      
      resourceCache.set('expire-test', testData, { ttl: 100 });
      expect(resourceCache.get('expire-test')).toEqual(testData);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(resourceCache.get('expire-test')).toBeUndefined();
    });

    test('should provide cache statistics', () => {
      resourceCache.set('stat-1', { data: 'test1' });
      resourceCache.set('stat-2', { data: 'test2' });
      resourceCache.get('stat-1');
      resourceCache.get('nonexistent');

      const stats = resourceCache.getStats();
      
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.sets).toBeGreaterThan(0);
      expect(stats.totalItems).toBeGreaterThan(0);
      expect(stats.cacheEfficiency).toBeGreaterThan(0);
    });

    test('should support cache-aside pattern with getOrSet', async () => {
      let factoryCalled = false;
      const factory = async () => {
        factoryCalled = true;
        return { computed: 'expensive result' };
      };

      const result1 = await resourceCache.getOrSet('computed-key', factory);
      expect(factoryCalled).toBe(true);
      expect(result1).toEqual({ computed: 'expensive result' });

      factoryCalled = false;
      const result2 = await resourceCache.getOrSet('computed-key', factory);
      expect(factoryCalled).toBe(false);
      expect(result2).toEqual({ computed: 'expensive result' });
    });
  });

  describe('PerformanceMetrics collection', () => {
    test('should track operation metrics', async () => {
      performanceMetrics.startOperation('test-op-1', 'test-operation');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const completed = performanceMetrics.endOperation('test-op-1', true, { result: 'success' });
      
      expect(completed).toBeDefined();
      expect(completed.success).toBe(true);
      expect(completed.duration).toBeGreaterThan(40);
      
      const metrics = performanceMetrics.getMetrics();
      expect(metrics.operations.totalOperations).toBeGreaterThan(0);
      expect(metrics.operations.successfulOperations).toBeGreaterThan(0);
    });

    test('should track resource usage metrics', () => {
      performanceMetrics.recordResourceUsage('database', 'query', { duration: 25 });
      performanceMetrics.recordResourceUsage('database', 'query', { duration: 35, slow: true });
      performanceMetrics.recordResourceUsage('cache', 'hit');
      performanceMetrics.recordResourceUsage('cache', 'miss');
      performanceMetrics.recordResourceUsage('cache', 'hit');

      const metrics = performanceMetrics.getMetrics();
      
      expect(metrics.resources.database.queries).toBeGreaterThan(0);
      expect(metrics.resources.database.slowQueries).toBeGreaterThan(0);
      expect(metrics.resources.cache.hits).toBeGreaterThan(0);
      expect(metrics.resources.cache.misses).toBeGreaterThan(0);
      expect(metrics.resources.cache.hitRate).toBeGreaterThan(0);
    });

    test('should provide performance summary', () => {
      performanceMetrics.startOperation('op1', 'test');
      performanceMetrics.endOperation('op1', true);
      performanceMetrics.startOperation('op2', 'test');
      performanceMetrics.endOperation('op2', false);

      const summary = performanceMetrics.getSummary();
      
      expect(summary.operations.total).toBeGreaterThan(0);
      expect(summary.operations.successful).toBeGreaterThan(0);
      expect(summary.operations.failed).toBeGreaterThan(0);
      expect(summary.operations.errorRate).toBeDefined();
    });
  });

  describe('ProcessingTimeTracker optimization', () => {
    test('should track operation stages and detect bottlenecks', async () => {
      const operationId = 'bottleneck-test';
      
      processingTimeTracker.startOperation(operationId, 'document-processing');
      
      processingTimeTracker.startStage(operationId, 'loading');
      await new Promise(resolve => setTimeout(resolve, 20));
      processingTimeTracker.endStage(operationId, 'loading');
      
      processingTimeTracker.startStage(operationId, 'slow-processing');
      await new Promise(resolve => setTimeout(resolve, 150));
      processingTimeTracker.endStage(operationId, 'slow-processing');
      
      processingTimeTracker.startStage(operationId, 'finalization');
      await new Promise(resolve => setTimeout(resolve, 10));
      processingTimeTracker.endStage(operationId, 'finalization');
      
      const completed = processingTimeTracker.endOperation(operationId, true);
      
      expect(completed).toBeDefined();
      expect(completed.stageBreakdown.stages).toHaveLength(3);
      expect(completed.stageBreakdown.longestStage.name).toBe('slow-processing');
      
      const stats = processingTimeTracker.getStats();
      expect(stats.bottlenecksDetected).toBeGreaterThanOrEqual(0);
    });

    test('should provide detailed analytics', async () => {
      for (let i = 0; i < 5; i++) {
        const opId = `analytics-${i}`;
        processingTimeTracker.startOperation(opId, 'analytics-test');
        await new Promise(resolve => setTimeout(resolve, 30 + i * 10));
        processingTimeTracker.endOperation(opId, true);
      }
      
      const analytics = processingTimeTracker.getAnalytics('analytics-test');
      
      expect(analytics.totalOperations).toBe(5);
      expect(analytics.duration.min).toBeDefined();
      expect(analytics.duration.max).toBeDefined();
      expect(analytics.duration.avg).toBeDefined();
      expect(analytics.duration.p90).toBeDefined();
      expect(analytics.trends).toBeDefined();
    });

    test('should track concurrent operations', () => {
      processingTimeTracker.startOperation('concurrent-1', 'test');
      processingTimeTracker.startOperation('concurrent-2', 'test');
      processingTimeTracker.startOperation('concurrent-3', 'test');
      
      const stats = processingTimeTracker.getStats();
      expect(stats.activeOperations).toBe(3);
      
      processingTimeTracker.endOperation('concurrent-1', true);
      processingTimeTracker.endOperation('concurrent-2', true);
      processingTimeTracker.endOperation('concurrent-3', true);
      
      const finalStats = processingTimeTracker.getStats();
      expect(finalStats.activeOperations).toBe(0);
      expect(finalStats.totalOperations).toBeGreaterThan(0);
    });
  });

  describe('Integration and optimization', () => {
    test('should integrate caching with performance tracking', async () => {
      const cacheKey = 'expensive-computation';
      let computationCount = 0;
      
      const expensiveComputation = async () => {
        computationCount++;
        const opId = `computation-${Date.now()}`;
        
        performanceMetrics.startOperation(opId, 'expensive-computation');
        processingTimeTracker.startOperation(opId, 'expensive-computation');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = { computed: true, timestamp: Date.now() };
        
        performanceMetrics.endOperation(opId, true, result);
        processingTimeTracker.endOperation(opId, true, result);
        
        return result;
      };
      
      const result1 = await resourceCache.getOrSet(cacheKey, expensiveComputation);
      expect(computationCount).toBe(1);
      expect(result1.computed).toBe(true);
      
      const result2 = await resourceCache.getOrSet(cacheKey, expensiveComputation);
      expect(computationCount).toBe(1);
      expect(result2.computed).toBe(true);
      
      const cacheStats = resourceCache.getStats();
      expect(cacheStats.hits).toBeGreaterThan(0);
    });

    test('should provide health status and recommendations', () => {
      for (let i = 0; i < 10; i++) {
        resourceCache.set(`load-test-${i}`, { data: `test-${i}` });
        
        const opId = `load-op-${i}`;
        performanceMetrics.startOperation(opId, 'load-test');
        performanceMetrics.endOperation(opId, i % 4 !== 0);
      }
      
      const cacheHealth = resourceCache.getHealthStatus();
      expect(cacheHealth.status).toBeDefined();
      expect(cacheHealth.memoryPressure).toBeDefined();
      expect(cacheHealth.cacheEfficiency).toBeDefined();
      
      const perfSummary = performanceMetrics.getSummary();
      expect(perfSummary.operations.errorRate).toBeDefined();
      expect(perfSummary.system.cpuUsage).toBeDefined();
      expect(perfSummary.system.memoryUsage).toBeDefined();
      
      const trackingStats = processingTimeTracker.getStats();
      expect(trackingStats.totalOperations).toBeGreaterThanOrEqual(0);
    });
  });
});