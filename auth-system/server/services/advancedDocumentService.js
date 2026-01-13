const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const cheerio = require('cheerio');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { pipeline: transformerPipeline } = require('@xenova/transformers');
const pineconeService = require('./pineconeService');
const pdfParsingService = require('./pdfParsingService');

class AdvancedDocumentService {
  constructor() {
    this.supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'text/html', // .html
      'text/plain' // .txt
    ];
    
    // Basic configuration - Updated based on Python reference for better processing
    this.config = {
      chunkSize: 200,  // Reduced from 2000 to 200 for better granularity
      chunkOverlap: 40, // Reduced proportionally from 200 to 40
      separators: ["\n\n", "\n", " ", ""],  // Simplified separators like Python version
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      embeddingDimensions: 384,
      modelCacheDir: './model_cache',
      normalizeEmbeddings: true,
      batchSize: 32,
      enableModelCaching: true,
      maxConcurrentDocuments: 5,
      maxConcurrentChunks: 10,
      maxConcurrentEmbeddings: 8,
      // Text encoding fallbacks (inspired by Python reference)
      encodingFallbacks: ['utf-8', 'utf-8-sig', 'latin-1']
    };
    
    // Initialize text splitter
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
      separators: this.config.separators
    });
    
    // Embedding model configuration
    this.embeddingModel = null;
    this.modelName = this.config.embeddingModel;
    this.batchSize = this.config.batchSize;
    this.modelInitialized = false;
    this.modelInitializationPromise = null;
    this.fallbackMode = false;
    
    // Basic concurrent processing
    this.concurrentConfig = {
      maxConcurrentDocuments: this.config.maxConcurrentDocuments,
      maxConcurrentChunks: this.config.maxConcurrentChunks,
      maxConcurrentEmbeddings: this.config.maxConcurrentEmbeddings,
      activeDocuments: 0,
      activeChunks: 0,
      activeEmbeddings: 0,
      documentQueue: [],
      chunkQueue: [],
      embeddingQueue: []
    };
    
    // Initialize embedding model
    this.initializeEmbeddingModel();
  }

  async initializeEmbeddingModel() {
    if (this.modelInitializationPromise) {
      return this.modelInitializationPromise;
    }
    
    this.modelInitializationPromise = this._performModelInitialization();
    return this.modelInitializationPromise;
  }

  async _performModelInitialization() {
    try {
      console.log('🤖 Initializing embedding model...');
      
      this.embeddingModel = await transformerPipeline('feature-extraction', this.modelName, {
        cache_dir: this.config.modelCacheDir,
        local_files_only: false,
        revision: 'main'
      });
      
      // Validate the model
      await this.validateEmbeddingModel();
      
      this.modelInitialized = true;
      console.log('✅ Embedding model initialized successfully');
      
      return this.embeddingModel;
    } catch (error) {
      console.error('❌ Failed to initialize embedding model:', error.message);
      console.log('⚠️ Switching to fallback mode');
      
      this.fallbackMode = true;
      this.modelInitialized = false;
      return null;
    }
  }

  async validateEmbeddingModel() {
    if (!this.embeddingModel) {
      throw new Error('Model not initialized');
    }
    
    try {
      const testText = "This is a test sentence for model validation.";
      const testOutput = await this.embeddingModel(testText, { 
        pooling: 'mean', 
        normalize: this.config.normalizeEmbeddings 
      });
      
      if (!testOutput || !testOutput.data || testOutput.data.length === 0) {
        throw new Error('Model validation failed: Invalid output format');
      }
      
      console.log('✅ Embedding model validation successful');
      return true;
    } catch (error) {
      console.error('❌ Model validation failed:', error.message);
      throw error;
    }
  }

  // Concurrent processing methods
  async acquireDocumentSlot() {
    return new Promise((resolve) => {
      if (this.concurrentConfig.activeDocuments < this.concurrentConfig.maxConcurrentDocuments) {
        this.concurrentConfig.activeDocuments++;
        resolve();
      } else {
        this.concurrentConfig.documentQueue.push({ resolve });
      }
    });
  }

  async acquireChunkSlot() {
    return new Promise((resolve) => {
      if (this.concurrentConfig.activeChunks < this.concurrentConfig.maxConcurrentChunks) {
        this.concurrentConfig.activeChunks++;
        resolve();
      } else {
        this.concurrentConfig.chunkQueue.push({ resolve });
      }
    });
  }

  async acquireEmbeddingSlot() {
    return new Promise((resolve) => {
      if (this.concurrentConfig.activeEmbeddings < this.concurrentConfig.maxConcurrentEmbeddings) {
        this.concurrentConfig.activeEmbeddings++;
        resolve();
      } else {
        this.concurrentConfig.embeddingQueue.push({ resolve });
      }
    });
  }

  releaseDocumentSlot() {
    this.concurrentConfig.activeDocuments = Math.max(0, this.concurrentConfig.activeDocuments - 1);
    this.processQueue();
  }

  releaseChunkSlot() {
    this.concurrentConfig.activeChunks = Math.max(0, this.concurrentConfig.activeChunks - 1);
    this.processQueue();
  }

  releaseEmbeddingSlot() {
    this.concurrentConfig.activeEmbeddings = Math.max(0, this.concurrentConfig.activeEmbeddings - 1);
    this.processQueue();
  }

  processQueue() {
    // Process document queue
    while (this.concurrentConfig.documentQueue.length > 0 && 
           this.concurrentConfig.activeDocuments < this.concurrentConfig.maxConcurrentDocuments) {
      const queuedOperation = this.concurrentConfig.documentQueue.shift();
      this.concurrentConfig.activeDocuments++;
      queuedOperation.resolve();
    }
    
    // Process chunk queue
    while (this.concurrentConfig.chunkQueue.length > 0 && 
           this.concurrentConfig.activeChunks < this.concurrentConfig.maxConcurrentChunks) {
      const queuedOperation = this.concurrentConfig.chunkQueue.shift();
      this.concurrentConfig.activeChunks++;
      queuedOperation.resolve();
    }
    
    // Process embedding queue
    while (this.concurrentConfig.embeddingQueue.length > 0 && 
           this.concurrentConfig.activeEmbeddings < this.concurrentConfig.maxConcurrentEmbeddings) {
      const queuedOperation = this.concurrentConfig.embeddingQueue.shift();
      this.concurrentConfig.activeEmbeddings++;
      queuedOperation.resolve();
    }
  }

  // Document processing methods
  async processDocument(filePath, userPineconeId, metadata = {}) {
    try {
      await this.acquireDocumentSlot();
      
      console.log(`📄 Processing document: ${path.basename(filePath)}`);
      
      // Extract text from document
      const text = await this.extractTextFromFile(filePath);
      
      if (!text || text.trim().length === 0) {
        throw new Error('No text content extracted from document');
      }
      
      // Split text into chunks
      const chunks = await this.splitTextIntoChunks(text);
      
      // Generate embeddings and store
      const results = await this.processChunksWithEmbeddings(chunks, userPineconeId, {
        ...metadata,
        fileName: path.basename(filePath),
        filePath: filePath,
        processedAt: new Date().toISOString()
      });
      
      console.log(`✅ Document processed: ${chunks.length} chunks, ${results.stored} stored`);
      
      return {
        success: true,
        chunksProcessed: chunks.length,
        chunksStored: results.stored,
        fileName: path.basename(filePath)
      };
      
    } catch (error) {
      console.error(`❌ Error processing document ${filePath}:`, error.message);
      throw error;
    } finally {
      this.releaseDocumentSlot();
    }
  }

  async extractTextFromFile(filePath) {
    const fileExtension = path.extname(filePath).toLowerCase();
    const fileBuffer = fs.readFileSync(filePath);
    
    switch (fileExtension) {
      case '.pdf':
        return await this.extractTextFromPDF(fileBuffer);
      case '.docx':
        return await this.extractTextFromDOCX(fileBuffer);
      case '.html':
      case '.htm':
        return await this.extractTextFromHTML(fileBuffer);
      case '.txt':
        return this.extractTextFromTXT(fileBuffer);
      default:
        throw new Error(`Unsupported file type: ${fileExtension}`);
    }
  }

  // Improved TXT extraction with multiple encoding attempts (inspired by Python reference)
  extractTextFromTXT(buffer) {
    for (const encoding of this.config.encodingFallbacks) {
      try {
        const text = buffer.toString(encoding);
        // Validate the text doesn't contain replacement characters
        if (!text.includes('\uFFFD')) {
          return text;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to decode with ${encoding}:`, error.message);
      }
    }
    
    // If all encodings fail, throw an error
    throw new Error('Could not decode text file with any supported encoding');
  }

  async extractTextFromPDF(buffer) {
    try {
      return await pdfParsingService.extractText(buffer);
    } catch (error) {
      console.error('❌ PDF extraction error:', error.message);
      throw error; // Re-throw the user-friendly error from pdfParsingService
    }
  }

  async extractTextFromDOCX(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error('❌ DOCX extraction error:', error.message);
      throw new Error(`Failed to extract text from DOCX: ${error.message}`);
    }
  }

  async extractTextFromHTML(buffer) {
    // Try multiple encodings for HTML files (inspired by Python reference)
    for (const encoding of this.config.encodingFallbacks) {
      try {
        const html = buffer.toString(encoding);
        
        // Validate the text doesn't contain replacement characters
        if (html.includes('\uFFFD')) {
          continue;
        }
        
        const $ = cheerio.load(html);
        
        // Remove script and style elements
        $('script, style').remove();
        
        // Extract text content
        const text = $('body').text() || $.text();
        return text;
      } catch (error) {
        console.warn(`⚠️ Failed to process HTML with ${encoding}:`, error.message);
      }
    }
    
    throw new Error('Failed to extract text from HTML with any supported encoding');
  }

  async splitTextIntoChunks(text) {
    try {
      const chunks = await this.textSplitter.splitText(text);
      return chunks.filter(chunk => chunk.trim().length > 0);
    } catch (error) {
      console.error('❌ Text splitting error:', error.message);
      throw new Error(`Failed to split text: ${error.message}`);
    }
  }

  async processChunksWithEmbeddings(chunks, userPineconeId, metadata = {}) {
    const results = { processed: 0, stored: 0, errors: [] };
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        await this.acquireChunkSlot();
        
        const chunk = chunks[i];
        const chunkId = `${metadata.fileName || 'document'}_chunk_${i}`;
        
        // Generate embedding
        const embedding = await this.generateEmbedding(chunk);
        
        if (embedding) {
          // Store in Pinecone
          const vector = {
            id: chunkId,
            values: embedding,
            metadata: {
              ...metadata,
              chunkIndex: i,
              text: chunk,
              chunkId: chunkId
            }
          };
          
          await pineconeService.storeDocument(vector, userPineconeId);
          results.stored++;
        }
        
        results.processed++;
        
      } catch (error) {
        console.error(`❌ Error processing chunk ${i}:`, error.message);
        results.errors.push({ chunkIndex: i, error: error.message });
      } finally {
        this.releaseChunkSlot();
      }
    }
    
    return results;
  }

  async generateEmbedding(text) {
    try {
      await this.acquireEmbeddingSlot();
      
      // Wait for model initialization if it's in progress
      if (!this.modelInitialized && !this.fallbackMode) {
        console.log('⏳ Waiting for embedding model initialization...');
        await this.initializeEmbeddingModel();
      }
      
      if (this.fallbackMode || !this.modelInitialized) {
        console.warn('⚠️ Embedding model not available, skipping embedding generation');
        return null;
      }
      
      if (!this.embeddingModel) {
        await this.initializeEmbeddingModel();
      }
      
      const output = await this.embeddingModel(text, {
        pooling: 'mean',
        normalize: this.config.normalizeEmbeddings
      });
      
      return Array.from(output.data);
      
    } catch (error) {
      console.error('❌ Embedding generation error:', error.message);
      return null;
    } finally {
      this.releaseEmbeddingSlot();
    }
  }

  /**
   * Enhanced search functionality for analytical queries with metadata enrichment
   */
  async searchDocuments(userPineconeId, query, limit = 5, options = {}) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      // Enhanced search parameters for analytical queries
      const searchOptions = {
        includeMetadata: true,
        includeValues: false,
        ...options
      };

      // Increase search limit for analytical queries to get more comprehensive results
      const enhancedLimit = Math.min(limit * 3, 50); // Get more results initially for better filtering
      
      const searchResults = await pineconeService.searchDocuments(
        queryEmbedding,
        userPineconeId,
        searchOptions,
        enhancedLimit
      );
      
      // Group results by document for better chunk selection
      const documentGroups = this.groupResultsByDocument(searchResults.matches || []);
      
      // Apply intelligent chunk selection for comprehensive analysis
      const selectedResults = this.selectChunksForAnalysis(documentGroups, limit, options);
      
      // Enrich with enhanced metadata for better citations
      const enrichedResults = await this.enrichResultsWithMetadata(selectedResults, userPineconeId);
      
      // Transform results to match expected format with enhanced chunk information
      const transformedResults = {
        matches: enrichedResults.map(docGroup => ({
          fileName: docGroup.fileName,
          fileType: docGroup.fileType || 'Unknown',
          fileSize: docGroup.fileSize || 0,
          uploadDate: docGroup.uploadDate || new Date().toISOString(),
          maxScore: docGroup.maxScore,
          avgScore: docGroup.avgScore,
          // Enhanced metadata
          documentMetadata: docGroup.documentMetadata || {},
          structureInfo: docGroup.structureInfo || {},
          chunks: docGroup.chunks.map(chunk => ({
            text: chunk.text,
            fullText: chunk.text, // Include full text for better context
            score: chunk.score,
            chunkIndex: chunk.chunkIndex,
            relevanceRank: chunk.relevanceRank,
            // Enhanced chunk metadata
            documentPosition: chunk.documentPosition,
            relativeImportance: chunk.relativeImportance,
            contextIndicators: chunk.contextIndicators,
            selectionReason: chunk.selectionReason,
            // Citation metadata
            citationMetadata: {
              chunkId: chunk.id,
              position: chunk.documentPosition,
              section: this.inferSectionFromChunk(chunk),
              pageEstimate: this.estimatePageFromChunk(chunk, docGroup)
            }
          }))
        })),
        totalChunks: enrichedResults.reduce((total, doc) => total + doc.chunks.length, 0),
        totalDocuments: enrichedResults.length,
        searchStrategy: options.isAnalytical ? 'analytical' : 'standard',
        // Enhanced search metadata
        searchMetadata: {
          queryProcessingTime: Date.now(),
          enhancedMetadata: true,
          citationEnrichment: true
        }
      };
      
      return transformedResults;
      
    } catch (error) {
      console.error('❌ Document search error:', error.message);
      throw error;
    }
  }

  /**
   * Enrich search results with enhanced metadata for better citations
   * @param {Array} results - Search results to enrich
   * @param {string} userPineconeId - User's Pinecone namespace
   * @returns {Array} Enriched results
   */
  async enrichResultsWithMetadata(results, userPineconeId) {
    return Promise.all(results.map(async (docGroup) => {
      try {
        // Get additional document metadata if available
        const documentMetadata = await this.getDocumentMetadata(docGroup.fileName, userPineconeId);
        
        // Analyze document structure
        const structureInfo = this.analyzeDocumentStructure(docGroup.chunks);
        
        // Enrich chunks with position and context information
        const enrichedChunks = docGroup.chunks.map(chunk => ({
          ...chunk,
          // Add estimated section information
          estimatedSection: this.inferSectionFromChunk(chunk),
          // Add page estimation
          estimatedPage: this.estimatePageFromChunk(chunk, docGroup),
          // Add surrounding context indicators
          contextClues: this.extractContextClues(chunk.text),
          // Add document structure position
          structuralPosition: this.determineStructuralPosition(chunk, structureInfo)
        }));
        
        return {
          ...docGroup,
          documentMetadata,
          structureInfo,
          chunks: enrichedChunks
        };
      } catch (error) {
        console.warn(`⚠️ Failed to enrich metadata for ${docGroup.fileName}:`, error.message);
        return docGroup; // Return original if enrichment fails
      }
    }));
  }

  /**
   * Get additional document metadata from storage
   * @param {string} fileName - Document filename
   * @param {string} userPineconeId - User's Pinecone namespace
   * @returns {Object} Document metadata
   */
  async getDocumentMetadata(fileName, userPineconeId) {
    try {
      // This would typically query a database or metadata store
      // For now, return basic metadata structure
      return {
        fileName: fileName,
        extractedAt: new Date().toISOString(),
        processingVersion: '2.0',
        chunkingStrategy: 'recursive-character',
        embeddingModel: this.config.embeddingModel,
        // Additional metadata could include:
        // - Document creation date
        // - Author information
        // - Document version
        // - Processing timestamps
      };
    } catch (error) {
      console.warn(`⚠️ Could not retrieve metadata for ${fileName}:`, error.message);
      return {};
    }
  }

  /**
   * Analyze document structure from chunks
   * @param {Array} chunks - Document chunks
   * @returns {Object} Structure analysis
   */
  analyzeDocumentStructure(chunks) {
    const structure = {
      totalChunks: chunks.length,
      chunkIndices: chunks.map(c => c.chunkIndex).sort((a, b) => a - b),
      estimatedSections: new Set(),
      structuralElements: []
    };
    
    // Analyze chunk distribution
    structure.minChunkIndex = Math.min(...structure.chunkIndices);
    structure.maxChunkIndex = Math.max(...structure.chunkIndices);
    structure.chunkSpread = structure.maxChunkIndex - structure.minChunkIndex;
    
    // Identify potential sections
    chunks.forEach(chunk => {
      const sectionIndicators = this.findSectionIndicators(chunk.text);
      sectionIndicators.forEach(indicator => structure.estimatedSections.add(indicator));
    });
    
    structure.estimatedSections = Array.from(structure.estimatedSections);
    
    return structure;
  }

  /**
   * Infer section information from chunk content
   * @param {Object} chunk - Document chunk
   * @returns {string} Inferred section
   */
  inferSectionFromChunk(chunk) {
    const text = chunk.text.toLowerCase();
    
    // Look for explicit section markers
    const sectionPatterns = [
      /section\s+(\d+)/i,
      /article\s+(\d+)/i,
      /chapter\s+(\d+)/i,
      /part\s+(\d+)/i,
      /clause\s+(\d+)/i,
      /paragraph\s+(\d+)/i
    ];
    
    for (const pattern of sectionPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    // Look for heading-like content
    const lines = chunk.text.split('\n');
    for (const line of lines) {
      if (line.trim().length > 0 && line.trim().length < 100) {
        // Check if line looks like a heading (short, potentially capitalized)
        if (line.trim().toUpperCase() === line.trim() || 
            /^\d+\./.test(line.trim()) ||
            /^[A-Z][a-z\s]+$/.test(line.trim())) {
          return line.trim();
        }
      }
    }
    
    return `Chunk ${chunk.chunkIndex}`;
  }

  /**
   * Estimate page number from chunk position
   * @param {Object} chunk - Document chunk
   * @param {Object} docGroup - Document group information
   * @returns {number} Estimated page number
   */
  estimatePageFromChunk(chunk, docGroup) {
    // Rough estimation: assume ~500 words per page, ~100 characters per chunk
    const estimatedChunksPerPage = 20; // Rough estimate
    const estimatedPage = Math.ceil((chunk.chunkIndex + 1) / estimatedChunksPerPage);
    
    return Math.max(1, estimatedPage);
  }

  /**
   * Extract context clues from chunk text
   * @param {string} text - Chunk text
   * @returns {Array} Context clues
   */
  extractContextClues(text) {
    const clues = [];
    const lowerText = text.toLowerCase();
    
    // Temporal clues
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
      /\b\d{4}-\d{2}-\d{2}\b/g,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/gi
    ];
    
    datePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        clues.push(...matches.map(match => ({ type: 'date', value: match })));
      }
    });
    
    // Reference clues
    if (lowerText.includes('see section') || lowerText.includes('refer to')) {
      clues.push({ type: 'cross-reference', value: 'contains cross-references' });
    }
    
    // Legal/formal language clues
    const formalTerms = ['whereas', 'therefore', 'notwithstanding', 'pursuant to', 'in accordance with'];
    formalTerms.forEach(term => {
      if (lowerText.includes(term)) {
        clues.push({ type: 'formal-language', value: term });
      }
    });
    
    return clues;
  }

  /**
   * Determine structural position of chunk within document
   * @param {Object} chunk - Document chunk
   * @param {Object} structureInfo - Document structure information
   * @returns {Object} Structural position information
   */
  determineStructuralPosition(chunk, structureInfo) {
    const relativePosition = structureInfo.chunkSpread > 0 
      ? (chunk.chunkIndex - structureInfo.minChunkIndex) / structureInfo.chunkSpread
      : 0;
    
    let position = 'middle';
    if (relativePosition < 0.2) position = 'beginning';
    else if (relativePosition > 0.8) position = 'end';
    
    return {
      relativePosition: relativePosition,
      positionLabel: position,
      chunkIndex: chunk.chunkIndex,
      totalChunks: structureInfo.totalChunks,
      estimatedSection: structureInfo.estimatedSections.length > 0 
        ? structureInfo.estimatedSections[Math.floor(relativePosition * structureInfo.estimatedSections.length)]
        : null
    };
  }

  /**
   * Find section indicators in text
   * @param {string} text - Text to analyze
   * @returns {Array} Section indicators found
   */
  findSectionIndicators(text) {
    const indicators = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Look for numbered sections
      if (/^\d+\./.test(trimmed) || /^Section\s+\d+/i.test(trimmed)) {
        indicators.push(trimmed);
      }
      
      // Look for lettered sections
      if (/^[A-Z]\./.test(trimmed)) {
        indicators.push(trimmed);
      }
      
      // Look for roman numerals
      if (/^[IVX]+\./.test(trimmed)) {
        indicators.push(trimmed);
      }
    });
    
    return indicators;
  }

  /**
   * Group search results by document for better chunk selection
   * @param {Array} matches - Raw search results from Pinecone
   * @returns {Map} Document groups with chunks
   */
  groupResultsByDocument(matches) {
    const documentGroups = new Map();
    
    matches.forEach((match, index) => {
      const fileName = match.metadata?.fileName || 'Unknown';
      
      if (!documentGroups.has(fileName)) {
        documentGroups.set(fileName, {
          fileName: fileName,
          fileType: match.metadata?.fileType || 'Unknown',
          fileSize: match.metadata?.fileSize || 0,
          uploadDate: match.metadata?.uploadDate || new Date().toISOString(),
          chunks: [],
          maxScore: 0,
          totalScore: 0,
          chunkCount: 0
        });
      }
      
      const docGroup = documentGroups.get(fileName);
      const chunk = {
        text: match.metadata?.text || '',
        score: match.score || 0,
        chunkIndex: match.metadata?.chunkIndex || 0,
        relevanceRank: index + 1,
        id: match.id
      };
      
      docGroup.chunks.push(chunk);
      docGroup.maxScore = Math.max(docGroup.maxScore, chunk.score);
      docGroup.totalScore += chunk.score;
      docGroup.chunkCount++;
    });
    
    // Calculate average scores
    documentGroups.forEach(docGroup => {
      docGroup.avgScore = docGroup.totalScore / docGroup.chunkCount;
    });
    
    return documentGroups;
  }

  /**
   * Select chunks intelligently for comprehensive analysis
   * @param {Map} documentGroups - Grouped documents with chunks
   * @param {number} limit - Maximum number of documents to return
   * @param {Object} options - Search options
   * @returns {Array} Selected document groups with optimized chunks
   */
  selectChunksForAnalysis(documentGroups, limit, options = {}) {
    const isAnalytical = options.isAnalytical || false;
    const maxChunksPerDoc = isAnalytical ? 5 : 3; // Increased for better analysis
    const minRelevanceScore = 0.25; // Lowered threshold for more comprehensive results
    
    // Convert to array and sort by relevance
    const sortedDocuments = Array.from(documentGroups.values())
      .sort((a, b) => b.maxScore - a.maxScore)
      .slice(0, limit);
    
    // For each document, select the best chunks using enhanced selection
    return sortedDocuments.map(docGroup => {
      // Filter chunks by minimum relevance score
      const relevantChunks = docGroup.chunks
        .filter(chunk => chunk.score >= minRelevanceScore)
        .sort((a, b) => b.score - a.score);
      
      // Enhanced chunk selection for analytical queries
      let selectedChunks;
      if (isAnalytical && relevantChunks.length > maxChunksPerDoc) {
        selectedChunks = this.selectComprehensiveChunks(relevantChunks, maxChunksPerDoc, options);
      } else {
        selectedChunks = relevantChunks.slice(0, maxChunksPerDoc);
      }
      
      // Add contextual information to chunks
      selectedChunks = this.enrichChunksWithContext(selectedChunks, docGroup);
      
      return {
        ...docGroup,
        chunks: selectedChunks
      };
    });
  }

  /**
   * Enhanced chunk selection for comprehensive analysis
   * @param {Array} chunks - All relevant chunks from a document
   * @param {number} maxChunks - Maximum number of chunks to select
   * @param {Object} options - Selection options
   * @returns {Array} Comprehensively selected chunks
   */
  selectComprehensiveChunks(chunks, maxChunks, options = {}) {
    if (chunks.length <= maxChunks) {
      return chunks;
    }
    
    const { queryType = 'standard', includeContext = true } = options;
    
    // Always include the highest scoring chunk
    const selected = [chunks[0]];
    const remaining = [...chunks.slice(1)];
    
    // Sort by chunk index to understand document structure
    const sortedByIndex = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
    const documentLength = Math.max(...sortedByIndex.map(c => c.chunkIndex));
    
    // Strategy 1: Ensure coverage across document sections
    if (includeContext && documentLength > maxChunks) {
      const sectionSize = Math.ceil(documentLength / (maxChunks - 1));
      
      for (let i = 1; i < maxChunks && remaining.length > 0; i++) {
        const targetSection = i * sectionSize;
        
        // Find chunks in this section, prioritizing by relevance
        const sectionChunks = remaining
          .filter(chunk => Math.abs(chunk.chunkIndex - targetSection) <= sectionSize)
          .sort((a, b) => b.score - a.score);
        
        if (sectionChunks.length > 0) {
          const selectedChunk = sectionChunks[0];
          selected.push(selectedChunk);
          const index = remaining.indexOf(selectedChunk);
          remaining.splice(index, 1);
        } else if (remaining.length > 0) {
          // If no chunk in target section, take the next best overall
          selected.push(remaining[0]);
          remaining.shift();
        }
      }
    } else {
      // Strategy 2: Select by relevance with diversity consideration
      while (selected.length < maxChunks && remaining.length > 0) {
        let nextChunk = remaining[0];
        
        // For analytical queries, prefer chunks that are not too close to already selected ones
        if (queryType === 'analytical' && selected.length > 1) {
          const diverseChunks = remaining.filter(chunk => {
            return selected.every(selectedChunk => 
              Math.abs(chunk.chunkIndex - selectedChunk.chunkIndex) >= 2
            );
          });
          
          if (diverseChunks.length > 0) {
            nextChunk = diverseChunks[0];
          }
        }
        
        selected.push(nextChunk);
        const index = remaining.indexOf(nextChunk);
        remaining.splice(index, 1);
      }
    }
    
    // Sort selected chunks back by relevance score for consistent ordering
    return selected.sort((a, b) => b.score - a.score);
  }

  /**
   * Enrich chunks with contextual information for better analysis
   * @param {Array} chunks - Selected chunks
   * @param {Object} docGroup - Document group information
   * @returns {Array} Enriched chunks
   */
  enrichChunksWithContext(chunks, docGroup) {
    return chunks.map((chunk, index) => ({
      ...chunk,
      // Add position information
      documentPosition: this.calculateDocumentPosition(chunk.chunkIndex, docGroup),
      // Add relative importance within document
      relativeImportance: this.calculateRelativeImportance(chunk, chunks),
      // Add context indicators
      contextIndicators: this.identifyContextIndicators(chunk.text),
      // Add selection reason
      selectionReason: index === 0 ? 'highest-relevance' : 
                      index < 3 ? 'high-relevance' : 'contextual-coverage'
    }));
  }

  /**
   * Calculate the position of a chunk within the document
   * @param {number} chunkIndex - Index of the chunk
   * @param {Object} docGroup - Document group with all chunks
   * @returns {string} Position description
   */
  calculateDocumentPosition(chunkIndex, docGroup) {
    const allIndices = docGroup.chunks.map(c => c.chunkIndex).sort((a, b) => a - b);
    const maxIndex = Math.max(...allIndices);
    const minIndex = Math.min(...allIndices);
    
    const relativePosition = (chunkIndex - minIndex) / (maxIndex - minIndex || 1);
    
    if (relativePosition < 0.25) return 'beginning';
    if (relativePosition < 0.75) return 'middle';
    return 'end';
  }

  /**
   * Calculate the relative importance of a chunk within the selected set
   * @param {Object} chunk - The chunk to evaluate
   * @param {Array} allChunks - All selected chunks
   * @returns {number} Importance score (0-1)
   */
  calculateRelativeImportance(chunk, allChunks) {
    const maxScore = Math.max(...allChunks.map(c => c.score));
    const minScore = Math.min(...allChunks.map(c => c.score));
    
    if (maxScore === minScore) return 1.0;
    
    return (chunk.score - minScore) / (maxScore - minScore);
  }

  /**
   * Identify context indicators in chunk text
   * @param {string} text - Chunk text
   * @returns {Array} Context indicators
   */
  identifyContextIndicators(text) {
    const indicators = [];
    const lowerText = text.toLowerCase();
    
    // Structural indicators
    if (lowerText.includes('section') || lowerText.includes('article') || lowerText.includes('clause')) {
      indicators.push('structural');
    }
    
    // Definitional content
    if (lowerText.includes('means') || lowerText.includes('defined as') || lowerText.includes('refers to')) {
      indicators.push('definitional');
    }
    
    // Procedural content
    if (lowerText.includes('shall') || lowerText.includes('must') || lowerText.includes('required')) {
      indicators.push('procedural');
    }
    
    // Comparative content
    if (lowerText.includes('however') || lowerText.includes('whereas') || lowerText.includes('unlike')) {
      indicators.push('comparative');
    }
    
    // Temporal content
    if (lowerText.includes('before') || lowerText.includes('after') || lowerText.includes('during')) {
      indicators.push('temporal');
    }
    
    return indicators;
  }

  /**
   * Select diverse chunks from different parts of a document for comprehensive analysis
   * @param {Array} chunks - All relevant chunks from a document
   * @param {number} maxChunks - Maximum number of chunks to select
   * @returns {Array} Diversely selected chunks
   */
  selectDiverseChunks(chunks, maxChunks) {
    if (chunks.length <= maxChunks) {
      return chunks;
    }
    
    // Sort by chunk index to understand document structure
    const sortedByIndex = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
    
    // Always include the highest scoring chunk
    const selected = [chunks[0]];
    const remaining = chunks.slice(1);
    
    // Try to select chunks from different parts of the document
    const documentLength = Math.max(...sortedByIndex.map(c => c.chunkIndex));
    const sectionSize = Math.ceil(documentLength / (maxChunks - 1));
    
    for (let i = 1; i < maxChunks && remaining.length > 0; i++) {
      const targetSection = i * sectionSize;
      
      // Find the best chunk in this section
      const sectionChunk = remaining.find(chunk => 
        Math.abs(chunk.chunkIndex - targetSection) <= sectionSize
      );
      
      if (sectionChunk) {
        selected.push(sectionChunk);
        const index = remaining.indexOf(sectionChunk);
        remaining.splice(index, 1);
      } else {
        // If no chunk in target section, take the next best overall
        selected.push(remaining[0]);
        remaining.shift();
      }
    }
    
    // Sort selected chunks back by relevance score
    return selected.sort((a, b) => b.score - a.score);
  }

  /**
   * Enhanced search specifically for cross-document analysis
   * @param {string} userPineconeId - User's Pinecone namespace
   * @param {string} query - Search query
   * @param {Object} analysisOptions - Analysis-specific options
   * @returns {Object} Enhanced search results for analysis
   */
  async searchForAnalysis(userPineconeId, query, analysisOptions = {}) {
    const {
      minDocuments = 2,
      maxDocuments = 8,
      chunksPerDocument = 4,
      includeContext = true
    } = analysisOptions;

    const searchOptions = {
      isAnalytical: true,
      includeContext: includeContext
    };

    // Search with higher limit to ensure we get results from multiple documents
    const results = await this.searchDocuments(
      userPineconeId, 
      query, 
      maxDocuments, 
      searchOptions
    );

    // Ensure we have results from multiple documents for comparison
    if (results.matches.length < minDocuments) {
      console.warn(`⚠️ Analysis query returned only ${results.matches.length} documents, minimum ${minDocuments} recommended`);
    }

    // Add analysis metadata
    results.analysisMetadata = {
      queryType: 'cross-document-analysis',
      documentsFound: results.matches.length,
      totalChunksAnalyzed: results.totalChunks,
      averageRelevanceScore: results.matches.reduce((sum, doc) => sum + doc.avgScore, 0) / results.matches.length,
      documentDiversity: this.calculateDocumentDiversity(results.matches)
    };

    return results;
  }

  /**
   * Enhanced search specifically for comparison queries
   * @param {string} userPineconeId - User's Pinecone namespace
   * @param {string} query - Comparison query
   * @param {Array} entities - Entities to compare (extracted from query)
   * @param {Object} comparisonOptions - Comparison-specific options
   * @returns {Object} Enhanced search results for comparison
   */
  async searchForComparison(userPineconeId, query, entities = [], comparisonOptions = {}) {
    const {
      minDocuments = 2,
      maxDocuments = 10,
      chunksPerDocument = 4,
      includeContext = true,
      diversityBoost = true
    } = comparisonOptions;

    console.log(`🔍 Performing comparison search for entities: ${entities.join(' vs ')}`);

    // First, search for the main query
    const mainSearchResults = await this.searchDocuments(
      userPineconeId, 
      query, 
      maxDocuments, 
      {
        isAnalytical: true,
        includeContext: includeContext,
        diversityBoost: diversityBoost
      }
    );

    // If we have specific entities, search for each entity separately
    let entitySearchResults = [];
    if (entities.length >= 2) {
      for (const entity of entities) {
        try {
          const entityResults = await this.searchDocuments(
            userPineconeId,
            entity.trim(),
            Math.ceil(maxDocuments / 2),
            {
              isAnalytical: true,
              includeContext: includeContext,
              targetEntity: entity
            }
          );
          
          if (entityResults.matches && entityResults.matches.length > 0) {
            entitySearchResults.push({
              entity: entity,
              results: entityResults.matches
            });
          }
        } catch (error) {
          console.warn(`⚠️ Failed to search for entity "${entity}":`, error.message);
        }
      }
    }

    // Merge and deduplicate results
    const mergedResults = this.mergeComparisonResults(mainSearchResults, entitySearchResults);
    
    // Ensure we have documents that can be compared
    if (mergedResults.matches.length < minDocuments) {
      console.warn(`⚠️ Comparison query returned only ${mergedResults.matches.length} documents, minimum ${minDocuments} recommended for effective comparison`);
    }

    // Add comparison metadata
    mergedResults.comparisonMetadata = {
      queryType: 'comparison',
      entities: entities,
      documentsFound: mergedResults.matches.length,
      totalChunksAnalyzed: mergedResults.totalChunks,
      entitySearchPerformed: entitySearchResults.length > 0,
      comparisonViability: this.assessComparisonViability(mergedResults.matches, entities)
    };

    return mergedResults;
  }

  /**
   * Merge main search results with entity-specific search results
   * @param {Object} mainResults - Main search results
   * @param {Array} entityResults - Entity-specific search results
   * @returns {Object} Merged results
   */
  mergeComparisonResults(mainResults, entityResults) {
    const documentMap = new Map();
    
    // Add main results
    mainResults.matches.forEach(doc => {
      documentMap.set(doc.fileName, {
        ...doc,
        comparisonRelevance: 'main-query',
        entityMatches: []
      });
    });

    // Add entity-specific results
    entityResults.forEach(entityResult => {
      entityResult.results.forEach(doc => {
        if (documentMap.has(doc.fileName)) {
          // Document already exists, add entity match info
          const existingDoc = documentMap.get(doc.fileName);
          existingDoc.entityMatches.push(entityResult.entity);
          
          // Merge chunks, avoiding duplicates
          const existingChunkIds = new Set(existingDoc.chunks.map(c => `${c.chunkIndex}`));
          doc.chunks.forEach(chunk => {
            if (!existingChunkIds.has(`${chunk.chunkIndex}`)) {
              existingDoc.chunks.push({
                ...chunk,
                entityRelevance: entityResult.entity
              });
            }
          });
        } else {
          // New document, add it
          documentMap.set(doc.fileName, {
            ...doc,
            comparisonRelevance: 'entity-specific',
            entityMatches: [entityResult.entity],
            chunks: doc.chunks.map(chunk => ({
              ...chunk,
              entityRelevance: entityResult.entity
            }))
          });
        }
      });
    });

    // Convert back to array and sort by comparison relevance
    const mergedMatches = Array.from(documentMap.values())
      .sort((a, b) => {
        // Prioritize documents that match multiple entities
        if (a.entityMatches.length !== b.entityMatches.length) {
          return b.entityMatches.length - a.entityMatches.length;
        }
        // Then by relevance score
        return b.maxScore - a.maxScore;
      });

    return {
      matches: mergedMatches,
      totalChunks: mergedMatches.reduce((total, doc) => total + doc.chunks.length, 0),
      totalDocuments: mergedMatches.length,
      searchStrategy: 'comparison'
    };
  }

  /**
   * Enhanced search specifically for differentiation queries
   * @param {string} userPineconeId - User's Pinecone namespace
   * @param {string} query - Differentiation query
   * @param {Object} differentiationOptions - Differentiation-specific options
   * @returns {Object} Enhanced search results for differentiation
   */
  async searchForDifferentiation(userPineconeId, query, differentiationOptions = {}) {
    const {
      minDocuments = 2,
      maxDocuments = 8,
      chunksPerDocument = 4,
      includeContext = true,
      contrastiveSearch = true
    } = differentiationOptions;

    console.log(`🔍 Performing differentiation search for query: "${query}"`);

    // Search for the main query with emphasis on finding contrasting information
    const mainSearchResults = await this.searchDocuments(
      userPineconeId, 
      query, 
      maxDocuments, 
      {
        isAnalytical: true,
        includeContext: includeContext,
        contrastiveSearch: contrastiveSearch
      }
    );

    // Extract potential differentiation keywords from the query
    const differentiationKeywords = this.extractDifferentiationKeywords(query);
    
    // Perform additional searches for differentiation keywords
    let keywordSearchResults = [];
    if (differentiationKeywords.length > 0) {
      for (const keyword of differentiationKeywords.slice(0, 3)) { // Limit to top 3 keywords
        try {
          const keywordResults = await this.searchDocuments(
            userPineconeId,
            keyword,
            Math.ceil(maxDocuments / 2),
            {
              isAnalytical: true,
              includeContext: includeContext,
              targetKeyword: keyword
            }
          );
          
          if (keywordResults.matches && keywordResults.matches.length > 0) {
            keywordSearchResults.push({
              keyword: keyword,
              results: keywordResults.matches
            });
          }
        } catch (error) {
          console.warn(`⚠️ Failed to search for differentiation keyword "${keyword}":`, error.message);
        }
      }
    }

    // Merge and organize results for differentiation analysis
    const mergedResults = this.mergeDifferentiationResults(mainSearchResults, keywordSearchResults);
    
    // Ensure we have sufficient documents for differentiation
    if (mergedResults.matches.length < minDocuments) {
      console.warn(`⚠️ Differentiation query returned only ${mergedResults.matches.length} documents, minimum ${minDocuments} recommended for effective differentiation`);
    }

    // Add differentiation metadata
    mergedResults.differentiationMetadata = {
      queryType: 'differentiation',
      keywords: differentiationKeywords,
      documentsFound: mergedResults.matches.length,
      totalChunksAnalyzed: mergedResults.totalChunks,
      keywordSearchPerformed: keywordSearchResults.length > 0,
      differentiationPotential: this.assessDifferentiationPotential(mergedResults.matches, differentiationKeywords)
    };

    return mergedResults;
  }

  /**
   * Extract keywords that might indicate differentiation points
   * @param {string} query - Differentiation query
   * @returns {Array} Differentiation keywords
   */
  extractDifferentiationKeywords(query) {
    const keywords = [];
    const lowerQuery = query.toLowerCase();
    
    // Common differentiation indicators
    const differentiationTerms = [
      'different', 'difference', 'differs', 'distinguish', 'unique', 'distinct',
      'separate', 'contrast', 'unlike', 'versus', 'compared to', 'rather than',
      'instead of', 'alternative', 'variation', 'divergent', 'dissimilar'
    ];
    
    // Extract terms that appear near differentiation indicators
    differentiationTerms.forEach(term => {
      const regex = new RegExp(`${term}\\s+([\\w\\s]{1,30})`, 'gi');
      const matches = lowerQuery.match(regex);
      if (matches) {
        matches.forEach(match => {
          const extracted = match.replace(new RegExp(term, 'gi'), '').trim();
          if (extracted.length > 2 && extracted.length < 30) {
            keywords.push(extracted);
          }
        });
      }
    });
    
    // Extract quoted terms (likely important concepts)
    const quotedTerms = query.match(/"([^"]+)"/g);
    if (quotedTerms) {
      quotedTerms.forEach(term => {
        const cleaned = term.replace(/"/g, '').trim();
        if (cleaned.length > 2) {
          keywords.push(cleaned);
        }
      });
    }
    
    // Remove duplicates and return
    return [...new Set(keywords)].slice(0, 5); // Limit to 5 keywords
  }

  /**
   * Merge main search results with keyword-specific search results for differentiation
   * @param {Object} mainResults - Main search results
   * @param {Array} keywordResults - Keyword-specific search results
   * @returns {Object} Merged results optimized for differentiation
   */
  mergeDifferentiationResults(mainResults, keywordResults) {
    const documentMap = new Map();
    
    // Add main results
    mainResults.matches.forEach(doc => {
      documentMap.set(doc.fileName, {
        ...doc,
        differentiationRelevance: 'main-query',
        keywordMatches: [],
        contrastiveElements: []
      });
    });

    // Add keyword-specific results
    keywordResults.forEach(keywordResult => {
      keywordResult.results.forEach(doc => {
        if (documentMap.has(doc.fileName)) {
          // Document already exists, add keyword match info
          const existingDoc = documentMap.get(doc.fileName);
          existingDoc.keywordMatches.push(keywordResult.keyword);
          
          // Merge chunks, prioritizing those with keyword relevance
          const existingChunkIds = new Set(existingDoc.chunks.map(c => `${c.chunkIndex}`));
          doc.chunks.forEach(chunk => {
            if (!existingChunkIds.has(`${chunk.chunkIndex}`)) {
              existingDoc.chunks.push({
                ...chunk,
                keywordRelevance: keywordResult.keyword,
                differentiationValue: this.calculateDifferentiationValue(chunk.text, keywordResult.keyword)
              });
            }
          });
        } else {
          // New document, add it
          documentMap.set(doc.fileName, {
            ...doc,
            differentiationRelevance: 'keyword-specific',
            keywordMatches: [keywordResult.keyword],
            chunks: doc.chunks.map(chunk => ({
              ...chunk,
              keywordRelevance: keywordResult.keyword,
              differentiationValue: this.calculateDifferentiationValue(chunk.text, keywordResult.keyword)
            }))
          });
        }
      });
    });

    // Sort documents by differentiation potential
    const mergedMatches = Array.from(documentMap.values())
      .sort((a, b) => {
        // Prioritize documents with multiple keyword matches
        if (a.keywordMatches.length !== b.keywordMatches.length) {
          return b.keywordMatches.length - a.keywordMatches.length;
        }
        // Then by relevance score
        return b.maxScore - a.maxScore;
      });

    return {
      matches: mergedMatches,
      totalChunks: mergedMatches.reduce((total, doc) => total + doc.chunks.length, 0),
      totalDocuments: mergedMatches.length,
      searchStrategy: 'differentiation'
    };
  }

  /**
   * Calculate differentiation value of a text chunk
   * @param {string} text - Chunk text
   * @param {string} keyword - Differentiation keyword
   * @returns {number} Differentiation value (0-1)
   */
  calculateDifferentiationValue(text, keyword) {
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    let score = 0;
    
    // Base score for keyword presence
    if (lowerText.includes(lowerKeyword)) {
      score += 0.3;
    }
    
    // Bonus for contrastive language
    const contrastiveTerms = [
      'however', 'but', 'although', 'whereas', 'while', 'unlike', 'different',
      'contrast', 'instead', 'rather', 'alternatively', 'conversely', 'on the other hand'
    ];
    
    contrastiveTerms.forEach(term => {
      if (lowerText.includes(term)) {
        score += 0.1;
      }
    });
    
    // Bonus for specific differentiation indicators
    const differentiationIndicators = [
      'unique', 'distinct', 'special', 'exclusive', 'particular', 'specific',
      'only', 'solely', 'exclusively', 'distinctly', 'specifically'
    ];
    
    differentiationIndicators.forEach(indicator => {
      if (lowerText.includes(indicator)) {
        score += 0.15;
      }
    });
    
    return Math.min(score, 1.0);
  }

  /**
   * Assess the potential for effective differentiation analysis
   * @param {Array} documents - Document results
   * @param {Array} keywords - Differentiation keywords
   * @returns {Object} Differentiation potential assessment
   */
  assessDifferentiationPotential(documents, keywords) {
    const assessment = {
      score: 0,
      maxScore: 100,
      factors: {},
      recommendation: 'poor'
    };

    // Factor 1: Document count (20 points)
    if (documents.length >= 2) {
      assessment.factors.documentCount = Math.min(20, documents.length * 4);
      assessment.score += assessment.factors.documentCount;
    }

    // Factor 2: Keyword coverage (25 points)
    if (keywords.length > 0) {
      const keywordsWithDocuments = keywords.filter(keyword => 
        documents.some(doc => doc.keywordMatches && doc.keywordMatches.includes(keyword))
      );
      assessment.factors.keywordCoverage = Math.round((keywordsWithDocuments.length / keywords.length) * 25);
      assessment.score += assessment.factors.keywordCoverage;
    }

    // Factor 3: Contrastive content (30 points)
    const chunksWithContrastiveValue = documents.reduce((count, doc) => {
      return count + doc.chunks.filter(chunk => 
        chunk.differentiationValue && chunk.differentiationValue > 0.3
      ).length;
    }, 0);
    
    const totalChunks = documents.reduce((count, doc) => count + doc.chunks.length, 0);
    if (totalChunks > 0) {
      assessment.factors.contrastiveContent = Math.round((chunksWithContrastiveValue / totalChunks) * 30);
      assessment.score += assessment.factors.contrastiveContent;
    }

    // Factor 4: Document diversity (25 points)
    const fileTypes = new Set(documents.map(doc => doc.fileType));
    const avgRelevance = documents.reduce((sum, doc) => sum + doc.avgScore, 0) / documents.length;
    
    assessment.factors.diversity = Math.min(25, (fileTypes.size * 10) + Math.round(avgRelevance * 15));
    assessment.score += assessment.factors.diversity;

    // Determine recommendation
    if (assessment.score >= 75) {
      assessment.recommendation = 'excellent';
    } else if (assessment.score >= 55) {
      assessment.recommendation = 'good';
    } else if (assessment.score >= 35) {
      assessment.recommendation = 'fair';
    } else {
      assessment.recommendation = 'poor';
    }

    return assessment;
  }

  // Utility methods
  isFileSupported(filePath) {
    const fileExtension = path.extname(filePath).toLowerCase();
    const supportedExtensions = ['.pdf', '.docx', '.html', '.htm', '.txt'];
    return supportedExtensions.includes(fileExtension);
  }

  isSupportedFileType(mimeType) {
    return this.supportedTypes.includes(mimeType);
  }

  getFileType(filePath) {
    const fileExtension = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.txt': 'text/plain'
    };
    return typeMap[fileExtension] || 'application/octet-stream';
  }

  getFileTypeFromMime(mimeType) {
    const mimeToType = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'text/html': 'HTML',
      'text/plain': 'TXT'
    };
    return mimeToType[mimeType] || 'UNKNOWN';
  }

  async storeInPinecone(userPineconeId, documentData, extractedText) {
    try {
      // Split text into chunks
      const chunks = await this.splitTextIntoChunks(extractedText);
      console.log(`📄 Split document into ${chunks.length} chunks`);
      
      // Try to process chunks with embeddings, but don't fail if embeddings don't work
      try {
        const results = await this.processChunksWithEmbeddings(chunks, userPineconeId, {
          fileName: documentData.originalName,
          fileType: documentData.fileType,
          fileSize: documentData.fileSize,
          uploadDate: new Date().toISOString()
        });
        console.log(`✅ Stored ${results.stored} chunks with embeddings`);
      } catch (embeddingError) {
        console.warn('⚠️ Failed to generate embeddings, document stored without vector search capability:', embeddingError.message);
        // Continue without embeddings - document text is still extracted and stored in database
      }
      
      // Return a vector ID (using filename as base)
      return `${documentData.fileName}_${Date.now()}`;
    } catch (error) {
      console.error('❌ Error storing in Pinecone:', error.message);
      throw error;
    }
  }

  // Health check
  getStatus() {
    return {
      modelInitialized: this.modelInitialized,
      fallbackMode: this.fallbackMode,
      supportedTypes: this.supportedTypes,
      concurrentConfig: {
        activeDocuments: this.concurrentConfig.activeDocuments,
        activeChunks: this.concurrentConfig.activeChunks,
        activeEmbeddings: this.concurrentConfig.activeEmbeddings,
        queuedDocuments: this.concurrentConfig.documentQueue.length,
        queuedChunks: this.concurrentConfig.chunkQueue.length,
        queuedEmbeddings: this.concurrentConfig.embeddingQueue.length
      }
    };
  }


}

module.exports = new AdvancedDocumentService();