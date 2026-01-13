const OpenAI = require('openai');
const advancedDocumentService = require('./advancedDocumentService');
const responseFormatter = require('./responseFormatter');

class ChatService {
  constructor() {
    this.openai = null;
    this.isEnabled = false;
    this.initialize();
  }

  async initialize() {
    try {
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
        console.log('⚠️ OpenAI API key not configured, chat functionality disabled');
        this.isEnabled = false;
        return;
      }

      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      this.isEnabled = true;
      console.log('✅ OpenAI chat service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI chat service:', error.message);
      console.log('⚠️ Continuing without chat functionality');
      this.isEnabled = false;
    }
  }

  async chatWithDocuments(userPineconeId, query, conversationHistory = []) {
    if (!this.isEnabled) {
      const errorResponse = responseFormatter.formatErrorResponse(
        'Chat service is not available. OpenAI API key is not configured.',
        'Please contact your system administrator to configure the OpenAI API key to enable chat functionality.'
      );
      
      return {
        response: errorResponse,
        sources: [],
        totalSources: 0,
        hasContext: false,
        error: 'Chat service disabled - OpenAI API key not configured',
        errorType: 'service_disabled'
      };
    }

    try {
      // Detect query type for enhanced processing
      const queryType = this.detectQueryType(query);
      const searchParams = this.getSearchParameters(queryType);
      
      console.log(`🔍 Query classified as: ${queryType.type} (confidence: ${Math.round(queryType.confidence * 100)}%)`);
      console.log(`📊 Search strategy: ${queryType.searchStrategy}, Response style: ${queryType.responseStyle}`);

      // Step 1: Search for relevant documents with dynamic parameters based on query type
      console.log(`🔍 Searching documents for ${queryType.type} query: "${query}"`);
      
      const searchOptions = {
        isAnalytical: queryType.isAnalytical,
        includeContext: true,
        queryType: queryType.type,
        searchStrategy: queryType.searchStrategy,
        ...searchParams
      };
      
      const searchResults = queryType.isAnalytical 
        ? queryType.type === 'comparison' && queryType.entities && queryType.entities.length >= 2
          ? await advancedDocumentService.searchForComparison(userPineconeId, query, queryType.entities, {
              minDocuments: 2,
              maxDocuments: searchParams.limit,
              chunksPerDocument: searchParams.chunksPerDoc,
              includeContext: true,
              diversityBoost: true
            })
          : queryType.type === 'differentiation'
          ? await advancedDocumentService.searchForDifferentiation(userPineconeId, query, {
              minDocuments: 2,
              maxDocuments: searchParams.limit,
              chunksPerDocument: searchParams.chunksPerDoc,
              includeContext: true,
              contrastiveSearch: true
            })
          : await advancedDocumentService.searchForAnalysis(userPineconeId, query, {
              minDocuments: queryType.type === 'comparison' ? 2 : 1,
              maxDocuments: searchParams.limit,
              chunksPerDocument: searchParams.chunksPerDoc,
              includeContext: true
            })
        : await advancedDocumentService.searchDocuments(
            userPineconeId,
            query,
            searchParams.limit,
            searchOptions
          );

      // Step 2: Build context from search results with enhanced chunk selection for analysis
      const contextBlocks = [];
      let totalChunks = 0;

      if (searchResults.matches && searchResults.matches.length > 0) {
        searchResults.matches.forEach(docResult => {
          // Use all chunks returned by the enhanced search (already optimally selected)
          docResult.chunks.forEach(chunk => {
            contextBlocks.push({
              source: docResult.fileName,
              chunkIndex: chunk.chunkIndex,
              score: chunk.score,
              text: chunk.fullText || chunk.text,
              fileType: docResult.fileType,
              relevanceRank: chunk.relevanceRank || 0,
              metadata: {
                date: docResult.uploadDate,
                fileSize: docResult.fileSize
              }
            });
            totalChunks++;
          });
        });

        // Log analysis metadata if available
        if (searchResults.analysisMetadata) {
          console.log(`📊 Analysis metadata:`, {
            documentsFound: searchResults.analysisMetadata.documentsFound,
            totalChunks: searchResults.analysisMetadata.totalChunksAnalyzed,
            avgRelevance: Math.round(searchResults.analysisMetadata.averageRelevanceScore * 100),
            diversity: Math.round(searchResults.analysisMetadata.documentDiversity * 100)
          });
        }
      }

      // Handle case where no relevant documents are found
      if (totalChunks === 0) {
        const noDocsResponse = this.handleNoDocumentsFound(query, queryType, userPineconeId);
        return noDocsResponse;
      }

      // Handle case where document context is insufficient
      if (totalChunks > 0 && totalChunks < this.getMinimumChunksForQuery(queryType)) {
        const insufficientContextResponse = this.handleInsufficientContext(
          query, 
          queryType, 
          totalChunks, 
          contextBlocks
        );
        return insufficientContextResponse;
      }

      // Step 3: Create enhanced system prompt with query type context
      const systemPrompt = this.createEnhancedSystemPrompt(contextBlocks, queryType);

      // Step 4: Build conversation messages
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: query }
      ];

      // Step 5: Get response from OpenAI with parameters optimized for query type
      console.log(`🤖 Generating ${queryType.type} response with ${totalChunks} document chunks`);
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: queryType.isAnalytical ? 0.2 : 0.3,
        max_tokens: queryType.isAnalytical ? 2000 : 1500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const rawResponse = completion.choices[0].message.content;

      // Validate AI response
      if (!rawResponse || rawResponse.trim().length === 0) {
        throw new Error('AI service returned empty response');
      }

      // Step 6: Format response using ResponseFormatter with enhanced validation
      let formattedResponse;
      let validationResult;
      
      try {
        formattedResponse = responseFormatter.formatLegalResponse(rawResponse, contextBlocks);
        
        // Perform comprehensive validation
        validationResult = responseFormatter.validateResponseStructure(formattedResponse, { strict: true });
        
        if (!validationResult.isValid) {
          console.warn(`⚠️ Response validation failed (Grade: ${validationResult.grade}, Score: ${validationResult.score}/${validationResult.maxScore})`);
          console.warn('Validation issues:', validationResult.issues);
          
          // Attempt auto-fix for common issues
          const fixedResponse = responseFormatter.autoFixValidationIssues(formattedResponse, validationResult);
          
          if (fixedResponse !== formattedResponse) {
            formattedResponse = fixedResponse;
            console.log('🔧 Applied automatic fixes to response');
            
            // Re-validate after fixes
            validationResult = responseFormatter.validateResponseStructure(formattedResponse, { strict: true });
          }
          
          // If still invalid, attempt to rebuild the response
          if (!validationResult.isValid && validationResult.score < 60) {
            console.log('🔄 Rebuilding malformed response due to low validation score');
            formattedResponse = this.rebuildMalformedResponse(rawResponse, contextBlocks, validationResult);
            validationResult = responseFormatter.validateResponseStructure(formattedResponse, { strict: true });
          }
        } else {
          console.log(`✅ Response validation passed (Grade: ${validationResult.grade}, Score: ${validationResult.score}/${validationResult.maxScore})`);
        }
        
      } catch (formatError) {
        console.error('❌ Response formatting failed:', formatError);
        // Create a fallback formatted response
        formattedResponse = this.createFallbackFormattedResponse(rawResponse, contextBlocks);
        validationResult = { isValid: false, grade: 'F', score: 0, issues: ['Formatting failed, using fallback'] };
      }

      // Step 7: Return structured response with enhanced source information
      return {
        response: formattedResponse,
        sources: responseFormatter.extractSourceInformation(contextBlocks),
        totalSources: totalChunks,
        hasContext: totalChunks > 0,
        queryType: queryType.type,
        queryClassification: {
          type: queryType.type,
          confidence: queryType.confidence,
          isAnalytical: queryType.isAnalytical,
          searchStrategy: queryType.searchStrategy,
          responseStyle: queryType.responseStyle,
          pattern: queryType.pattern
        },
        crossDocumentAnalysis: queryType.isAnalytical,
        searchStrategy: searchResults.searchStrategy || 'standard',
        analysisMetadata: searchResults.analysisMetadata || null,
        comparisonMetadata: searchResults.comparisonMetadata || null,
        differentiationMetadata: searchResults.differentiationMetadata || null,
        validation: {
          isValid: validationResult.isValid,
          grade: validationResult.grade,
          score: validationResult.score,
          maxScore: validationResult.maxScore,
          issueCount: validationResult.issues.length
        },
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0
        }
      };

    } catch (error) {
      console.error('❌ Chat service error:', error);
      
      // Enhanced error handling with professional formatting
      return this.handleChatError(error, query, userPineconeId);
    }
  }

  /**
   * Enhanced query classification for different response types
   * @param {string} query - User query
   * @returns {Object} Detailed query type information
   */
  detectQueryType(query) {
    const lowerQuery = query.toLowerCase();
    
    // Comparison patterns - enhanced with more variations
    const comparisonPatterns = [
      /compare\s+(.+?)\s+(?:and|with|to|vs|versus)\s+(.+)/i,
      /(?:difference|differences)\s+between\s+(.+?)\s+and\s+(.+)/i,
      /(?:what|how)\s+(?:is|are)\s+(.+?)\s+(?:different|similar)\s+(?:from|to)\s+(.+)/i,
      /(.+?)\s+(?:vs|versus)\s+(.+)/i,
      /contrast\s+(.+?)\s+(?:and|with)\s+(.+)/i,
      /(?:similarities|differences)\s+(?:between|of)\s+(.+?)\s+and\s+(.+)/i
    ];

    // Analysis patterns - enhanced with more analytical terms
    const analysisPatterns = [
      /analyze|analysis|examine|evaluate|assess|review/i,
      /pros\s+and\s+cons|advantages\s+and\s+disadvantages/i,
      /similarities\s+and\s+differences/i,
      /contrast|contrasting|comparative/i,
      /breakdown|break\s+down/i,
      /overview|summary|summarize/i,
      /implications|impact|effect/i,
      /trends|patterns|themes/i
    ];

    // Differentiation patterns - specific to "what's different" queries
    const differentiationPatterns = [
      /(?:what|how)\s+(?:makes|is)\s+(.+?)\s+different/i,
      /(?:what|how)\s+distinguishes\s+(.+?)\s+from/i,
      /unique\s+(?:features|aspects|characteristics)\s+of/i,
      /(?:what|how)\s+sets\s+(.+?)\s+apart/i,
      /distinctive\s+(?:features|aspects|elements)/i
    ];

    // Synthesis patterns - combining information from multiple sources
    const synthesisPatterns = [
      /combine|synthesis|synthesize|integrate/i,
      /overall|comprehensive|complete\s+picture/i,
      /(?:what|how)\s+do\s+(?:all|these|the)\s+documents\s+(?:say|tell|show)/i,
      /across\s+(?:all|these|the)\s+documents/i,
      /common\s+(?:themes|patterns|elements)/i
    ];

    // Specific document patterns
    const specificDocumentPatterns = [
      /(?:in|from|according\s+to)\s+(.+?\.(?:pdf|docx|html|txt))/i,
      /(?:document|file|paper)\s+(.+?)\s+(?:says|states|mentions)/i,
      /(?:what|how)\s+does\s+(.+?\.(?:pdf|docx|html|txt))/i
    ];

    // Multi-document patterns
    const multiDocumentPatterns = [
      /(?:all|both|these|multiple)\s+documents/i,
      /across\s+(?:documents|files|sources)/i,
      /(?:what|how)\s+do\s+(?:all|both|these)\s+(?:documents|files)/i,
      /from\s+(?:multiple|different|various)\s+sources/i
    ];

    // Check for comparison queries
    for (const pattern of comparisonPatterns) {
      const match = pattern.exec(query);
      if (match) {
        return {
          type: 'comparison',
          isAnalytical: true,
          pattern: 'comparison',
          entities: match.length > 2 ? [match[1]?.trim(), match[2]?.trim()] : [],
          confidence: 0.9,
          searchStrategy: 'cross-document',
          responseStyle: 'comparative'
        };
      }
    }

    // Check for differentiation queries
    for (const pattern of differentiationPatterns) {
      if (pattern.test(query)) {
        return {
          type: 'differentiation',
          isAnalytical: true,
          pattern: 'differentiation',
          confidence: 0.85,
          searchStrategy: 'cross-document',
          responseStyle: 'contrastive'
        };
      }
    }

    // Check for synthesis queries
    for (const pattern of synthesisPatterns) {
      if (pattern.test(query)) {
        return {
          type: 'synthesis',
          isAnalytical: true,
          pattern: 'synthesis',
          confidence: 0.8,
          searchStrategy: 'comprehensive',
          responseStyle: 'integrative'
        };
      }
    }

    // Check for analysis queries
    for (const pattern of analysisPatterns) {
      if (pattern.test(query)) {
        return {
          type: 'analysis',
          isAnalytical: true,
          pattern: 'analysis',
          confidence: 0.75,
          searchStrategy: 'comprehensive',
          responseStyle: 'analytical'
        };
      }
    }

    // Check for specific document queries
    for (const pattern of specificDocumentPatterns) {
      const match = pattern.exec(query);
      if (match) {
        return {
          type: 'specific-document',
          isAnalytical: false,
          pattern: 'specific-document',
          targetDocument: match[1]?.trim(),
          confidence: 0.9,
          searchStrategy: 'targeted',
          responseStyle: 'focused'
        };
      }
    }

    // Check for multi-document queries
    for (const pattern of multiDocumentPatterns) {
      if (pattern.test(query)) {
        return {
          type: 'multi-document',
          isAnalytical: true,
          pattern: 'multi-document',
          confidence: 0.7,
          searchStrategy: 'cross-document',
          responseStyle: 'comprehensive'
        };
      }
    }

    // Default to simple query
    return {
      type: 'simple',
      isAnalytical: false,
      pattern: 'simple',
      confidence: 0.5,
      searchStrategy: 'standard',
      responseStyle: 'direct'
    };
  }

  /**
   * Get search parameters based on query type
   * @param {Object} queryType - Query type information
   * @returns {Object} Search parameters
   */
  getSearchParameters(queryType) {
    const baseParams = {
      limit: 10,
      chunksPerDoc: 3,
      minRelevanceScore: 0.3
    };

    switch (queryType.type) {
      case 'comparison':
        return {
          ...baseParams,
          limit: 15,
          chunksPerDoc: 4,
          minRelevanceScore: 0.25,
          diversityBoost: true
        };

      case 'differentiation':
        return {
          ...baseParams,
          limit: 12,
          chunksPerDoc: 4,
          minRelevanceScore: 0.3,
          contrastiveSearch: true
        };

      case 'synthesis':
        return {
          ...baseParams,
          limit: 20,
          chunksPerDoc: 5,
          minRelevanceScore: 0.2,
          comprehensiveSearch: true
        };

      case 'analysis':
        return {
          ...baseParams,
          limit: 15,
          chunksPerDoc: 4,
          minRelevanceScore: 0.25,
          analyticalDepth: true
        };

      case 'specific-document':
        return {
          ...baseParams,
          limit: 8,
          chunksPerDoc: 6,
          minRelevanceScore: 0.4,
          targetedSearch: true
        };

      case 'multi-document':
        return {
          ...baseParams,
          limit: 18,
          chunksPerDoc: 3,
          minRelevanceScore: 0.25,
          crossDocumentSearch: true
        };

      default:
        return baseParams;
    }
  }

  /**
   * Create enhanced system prompt with query type awareness
   * @param {Array} contextBlocks - Document chunks
   * @param {Object} queryType - Query type information
   * @returns {string} Enhanced system prompt
   */
  createEnhancedSystemPrompt(contextBlocks, queryType) {
    const basePrompt = this.createSystemPrompt(contextBlocks);
    
    if (!queryType.isAnalytical) {
      return basePrompt;
    }

    // Add query-type specific instructions
    let analyticalInstructions = '';

    switch (queryType.type) {
      case 'comparison':
        analyticalInstructions = `
SPECIAL INSTRUCTIONS FOR COMPARISON QUERIES:
- Structure your response to clearly show similarities and differences
- Use comparative language (e.g., "while X shows..., Y indicates...", "in contrast to...", "similarly...")
- For each comparison point, cite the specific document chunks that support your analysis
- If documents conflict, present both perspectives with their sources clearly identified
- Organize your analysis using parallel structure for easy comparison
- Highlight key insights that emerge from comparing multiple documents
- Use section headers like "Similarities:" and "Differences:" when appropriate
- Ensure each compared entity gets balanced coverage in your analysis`;
        break;

      case 'differentiation':
        analyticalInstructions = `
SPECIAL INSTRUCTIONS FOR DIFFERENTIATION QUERIES:
- Focus on what makes each entity, concept, or document unique or distinct
- Use contrastive language to emphasize differences (e.g., "unlike...", "in contrast to...", "distinctly...")
- Highlight unique features, characteristics, or approaches found in each document
- Provide specific examples from the documents to illustrate distinctions
- Organize your response to clearly separate different entities or concepts
- If similarities exist, acknowledge them briefly but emphasize the differences
- Use section headers to organize different aspects of differentiation
- Ensure each distinct element gets adequate coverage with supporting evidence`;
        break;

      case 'synthesis':
        analyticalInstructions = `
SPECIAL INSTRUCTIONS FOR SYNTHESIS QUERIES:
- Integrate information from multiple document sources
- Look for common themes, patterns, or conclusions across documents
- Build a comprehensive understanding by combining insights
- Identify areas where documents complement or reinforce each other
- Present a unified view while acknowledging source diversity`;
        break;

      case 'analysis':
        analyticalInstructions = `
SPECIAL INSTRUCTIONS FOR ANALYTICAL QUERIES:
- Provide deep analysis of the topic using document evidence
- Break down complex concepts into understandable components
- Examine implications, causes, effects, or relationships
- Use analytical language and structured reasoning
- Support all analytical points with specific document citations`;
        break;

      case 'multi-document':
        analyticalInstructions = `
SPECIAL INSTRUCTIONS FOR MULTI-DOCUMENT QUERIES:
- Draw insights from across all relevant documents
- Show how different documents contribute to the overall understanding
- Identify patterns or themes that emerge across multiple sources
- Use cross-referencing to build comprehensive responses
- Acknowledge when documents provide different perspectives`;
        break;

      default:
        analyticalInstructions = `
SPECIAL INSTRUCTIONS FOR ${queryType.type.toUpperCase()} QUERIES:
- Use cross-document analysis to build comprehensive understanding
- Structure your analysis to be comprehensive yet concise
- Use cross-document references to support your analysis
- Highlight key insights that emerge from analyzing multiple documents together`;
        break;
    }

    return basePrompt + analyticalInstructions;
  }

  /**
   * Create enhanced system prompt template for document-only responses
   * @param {Array} contextBlocks - Document chunks
   * @returns {string} Enhanced system prompt
   */
  createSystemPrompt(contextBlocks) {
    if (contextBlocks.length === 0) {
      return this.createNoDocumentsPrompt();
    }

    const contextText = this.buildContextText(contextBlocks);
    const documentSummary = this.createDocumentSummary(contextBlocks);
    
    return `${this.getBaseSystemPrompt()}

${documentSummary}

DOCUMENT CONTEXT:
${contextText}

${this.getResponseInstructions()}`;
  }

  /**
   * Get base system prompt template
   * @returns {string} Base system prompt
   */
  getBaseSystemPrompt() {
    return `You are a precise legal research assistant designed to help users find authoritative information from their uploaded documents.

CRITICAL CONSTRAINTS:
- Use ONLY the provided document context to answer
- NEVER use information from your training data or external knowledge
- If the documents don't contain the answer, clearly state this limitation
- For comparisons and analysis, use ONLY information from the provided documents
- Support cross-document analysis, comparisons, and differentiation using document data

RESPONSE FORMAT REQUIREMENTS:
For every response, follow this format strictly:

RELEVANT LEGAL PROVISIONS:
- [Document Title] | Chunk [X] | [Date if available]
Excerpt: "[Exact quoted text from the document chunk]"

LEGAL SUMMARY:
Provide a concise 3-5 sentence explanation strictly based on the retrieved document chunks. For comparisons, highlight differences and similarities found in the documents. For analysis, synthesize information across multiple document chunks.

CITATIONS & SOURCES:
- Resource: [filename] | Chunk [X] | [Date or "Date not available"]

MANDATORY RULES:
- Quote documents exactly with quotation marks
- Mention date/version when available in document metadata
- Do NOT add interpretations beyond what's in the documents
- If date not found, explicitly say "Date not available"
- For cross-document analysis, clearly reference which documents support each point
- If documents conflict, present both perspectives with their sources
- If insufficient information exists in documents, state this clearly

⚖️ Legal Disclaimer: This information is for research purposes only. I am not a licensed attorney, and this does not constitute legal advice.`;
  }

  /**
   * Create document summary for context awareness
   * @param {Array} contextBlocks - Document chunks
   * @returns {string} Document summary
   */
  createDocumentSummary(contextBlocks) {
    const documentStats = this.analyzeDocumentContext(contextBlocks);
    
    return `DOCUMENT CONTEXT SUMMARY:
- Total Documents: ${documentStats.uniqueDocuments}
- Total Chunks: ${contextBlocks.length}
- Document Types: ${documentStats.fileTypes.join(', ')}
- Average Relevance: ${Math.round(documentStats.averageScore * 100)}%
- Date Range: ${documentStats.dateRange}`;
  }

  /**
   * Analyze document context for summary
   * @param {Array} contextBlocks - Document chunks
   * @returns {Object} Document statistics
   */
  analyzeDocumentContext(contextBlocks) {
    const uniqueDocuments = new Set(contextBlocks.map(block => block.source)).size;
    const fileTypes = [...new Set(contextBlocks.map(block => block.fileType))];
    const scores = contextBlocks.map(block => block.score).filter(score => score > 0);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    // Analyze date range
    const dates = contextBlocks
      .map(block => block.metadata?.date)
      .filter(date => date)
      .map(date => new Date(date))
      .sort((a, b) => a - b);
    
    let dateRange = 'Not available';
    if (dates.length > 0) {
      if (dates.length === 1) {
        dateRange = dates[0].toISOString().split('T')[0];
      } else {
        const earliest = dates[0].toISOString().split('T')[0];
        const latest = dates[dates.length - 1].toISOString().split('T')[0];
        dateRange = earliest === latest ? earliest : `${earliest} to ${latest}`;
      }
    }

    return {
      uniqueDocuments,
      fileTypes,
      averageScore,
      dateRange
    };
  }

  /**
   * Build formatted context text from document chunks
   * @param {Array} contextBlocks - Document chunks
   * @returns {string} Formatted context text
   */
  buildContextText(contextBlocks) {
    return contextBlocks.map((block, index) => {
      const relevancePercent = Math.round(block.score * 100);
      const date = block.metadata?.date || 'Date not available';
      
      return `[Document ${index + 1}: ${block.source} (${block.fileType}) - Chunk ${block.chunkIndex} - Relevance: ${relevancePercent}% - ${date}]
${block.text}
---`;
    }).join('\n');
  }

  /**
   * Get response instructions template
   * @returns {string} Response instructions
   */
  getResponseInstructions() {
    return `RESPONSE INSTRUCTIONS:
Remember: You are strictly limited to the information in the provided document chunks. Your role is to analyze, compare, and synthesize information from these documents while maintaining complete transparency about sources.

When analyzing multiple documents:
1. Clearly identify which document supports each point
2. Highlight agreements and disagreements between sources
3. Use exact quotes with proper attribution
4. Maintain professional legal research assistant tone
5. Structure responses for maximum clarity and usefulness`;
  }

  /**
   * Create prompt for when no documents are found
   * @returns {string} No documents prompt
   */
  createNoDocumentsPrompt() {
    return `You are a precise legal research assistant designed to help users find authoritative information from their uploaded documents.

CRITICAL: You can ONLY use information from uploaded documents. You cannot provide information from your training data or external knowledge.

Since no relevant documents were found in your uploaded files for this query:

RELEVANT LEGAL PROVISIONS:
No relevant documents found in your uploaded files for this query.

LEGAL SUMMARY:
I recommend uploading relevant documents (PDF, DOCX, HTML, TXT) or trying different search terms related to your question. I can only provide information based on your uploaded documents.

CITATIONS & SOURCES:
No sources available

⚖️ Legal Disclaimer: This information is for research purposes only. I am not a licensed attorney, and this does not constitute legal advice.`;
  }

  async generateTitle(query, response) {
    if (!this.isEnabled) {
      return this.generateSimpleTitle(query);
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Generate a short, descriptive title (max 6 words) for this conversation based on the user query and response. Return only the title, no quotes or extra text.'
          },
          {
            role: 'user',
            content: `Query: ${query}\n\nResponse: ${response.substring(0, 200)}...`
          }
        ],
        temperature: 0.3,
        max_tokens: 20
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('Title generation failed:', error);
      return this.generateSimpleTitle(query);
    }
  }

  generateSimpleTitle(query) {
    // Simple title generation fallback
    const words = query.split(' ').slice(0, 4);
    return words.join(' ') + (query.split(' ').length > 4 ? '...' : '');
  }

  /**
   * Handle chat errors with enhanced professional formatting
   * @param {Error} error - Error object
   * @param {string} query - Original user query
   * @param {string} userPineconeId - User's Pinecone ID
   * @returns {Object} Formatted error response
   */
  async handleChatError(error, query, userPineconeId) {
    const errorType = this.categorizeError(error);
    let errorMessage, suggestion, fallbackResponse;

    switch (errorType) {
      case 'ai_service':
        errorMessage = 'AI service is temporarily unavailable.';
        suggestion = 'Please try again in a few moments. If the issue persists, contact support.';
        fallbackResponse = await this.createAIServiceFallback(query, userPineconeId);
        break;

      case 'document_search':
        errorMessage = 'Document search service encountered an issue.';
        suggestion = 'Your documents may still be processing. Please try again or upload additional relevant documents.';
        fallbackResponse = await this.createDocumentSearchFallback(query, userPineconeId);
        break;

      case 'embedding_service':
        errorMessage = 'Document analysis service is temporarily unavailable.';
        suggestion = 'Please try again later or contact support if the issue continues.';
        fallbackResponse = this.createEmbeddingServiceFallback(query);
        break;

      case 'timeout':
        errorMessage = 'Request timed out while processing your query.';
        suggestion = 'Please try a more specific question or break complex queries into smaller parts.';
        fallbackResponse = this.createTimeoutFallback(query);
        break;

      case 'no_documents':
        errorMessage = 'No relevant documents found for your query.';
        suggestion = 'Try uploading relevant documents (PDF, DOCX, HTML, TXT) or using different search terms.';
        fallbackResponse = this.createNoDocumentsFallback(query);
        break;

      case 'insufficient_context':
        errorMessage = 'Available documents do not contain sufficient information to answer your query.';
        suggestion = 'Consider uploading additional relevant documents or rephrasing your question to be more specific.';
        fallbackResponse = this.createInsufficientContextFallback(query);
        break;

      case 'parsing_error':
        errorMessage = 'Some documents could not be processed properly.';
        suggestion = 'The system will continue with available document chunks. Consider re-uploading problematic documents.';
        fallbackResponse = await this.createParsingErrorFallback(query, userPineconeId);
        break;

      default:
        errorMessage = 'An unexpected error occurred while processing your request.';
        suggestion = 'Please try rephrasing your question or contact support if the problem persists.';
        fallbackResponse = this.createGenericErrorFallback(query);
        break;
    }

    // Use fallback response if available, otherwise use formatted error response
    const finalResponse = fallbackResponse || responseFormatter.formatErrorResponse(errorMessage, suggestion);

    return {
      response: finalResponse,
      sources: [],
      totalSources: 0,
      hasContext: false,
      error: error.message,
      errorType: errorType,
      fallbackUsed: !!fallbackResponse
    };
  }

  /**
   * Create fallback response when AI service fails but document search works
   * @param {string} query - User query
   * @param {string} userPineconeId - User's Pinecone ID
   * @returns {string|null} Fallback response or null
   */
  async createAIServiceFallback(query, userPineconeId) {
    try {
      // Attempt to search documents even if AI service is down
      const searchResults = await advancedDocumentService.searchDocuments(userPineconeId, query, 5);
      
      if (searchResults.matches && searchResults.matches.length > 0) {
        const contextBlocks = [];
        searchResults.matches.forEach(docResult => {
          const topChunks = docResult.chunks.slice(0, 2);
          topChunks.forEach(chunk => {
            contextBlocks.push({
              source: docResult.fileName,
              chunkIndex: chunk.chunkIndex,
              score: chunk.score,
              text: chunk.fullText || chunk.text,
              fileType: docResult.fileType,
              metadata: {
                date: docResult.uploadDate,
                fileSize: docResult.fileSize
              }
            });
          });
        });

        // Create a basic response using document chunks
        const provisions = contextBlocks.map(block => {
          const date = block.metadata?.date || "Date not available";
          const excerpt = block.text.substring(0, 150) + (block.text.length > 150 ? '...' : '');
          return `- ${block.source} | Chunk ${block.chunkIndex} | ${date}\nExcerpt: "${excerpt}"`;
        }).join('\n\n');

        const citations = responseFormatter.formatCitations(contextBlocks);

        return responseFormatter.buildFormattedResponse(
          provisions,
          'AI service is temporarily unavailable, but relevant document excerpts are provided above. Please review the provisions and contact support if you need assistance interpreting this information.',
          citations
        );
      }
    } catch (fallbackError) {
      console.error('Fallback search also failed:', fallbackError);
    }
    
    return null;
  }

  /**
   * Create fallback response when document search fails
   * @param {string} query - User query
   * @param {string} userPineconeId - User's Pinecone ID
   * @returns {string|null} Fallback response or null
   */
  async createDocumentSearchFallback(query, userPineconeId) {
    // For document search failures, we can't provide document-based fallback
    // Return a structured error response with helpful suggestions
    const suggestions = [
      'Check if your documents have finished uploading and processing',
      'Try using different keywords or phrases related to your question',
      'Upload additional relevant documents if available',
      'Contact support if the issue persists'
    ];

    const suggestionText = suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');

    return responseFormatter.formatErrorResponse(
      'Document search service is temporarily unavailable.',
      `Please try the following:\n${suggestionText}`
    );
  }

  /**
   * Create fallback response for embedding service failures
   * @param {string} query - User query
   * @returns {string} Fallback response
   */
  createEmbeddingServiceFallback(query) {
    return responseFormatter.formatErrorResponse(
      'Document analysis service is temporarily unavailable.',
      'The system cannot currently process your query against uploaded documents. Please try again later or contact support if the issue continues.'
    );
  }

  /**
   * Create fallback response for timeout errors
   * @param {string} query - User query
   * @returns {string} Fallback response
   */
  createTimeoutFallback(query) {
    const suggestions = [
      'Break complex questions into smaller, more specific parts',
      'Use more targeted keywords in your query',
      'Try asking about specific documents or topics',
      'Contact support if timeouts persist'
    ];

    const suggestionText = suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');

    return responseFormatter.formatErrorResponse(
      'Request timed out while processing your query.',
      `To improve response time, please try:\n${suggestionText}`
    );
  }

  /**
   * Create fallback response when no documents are found
   * @param {string} query - User query
   * @returns {string} Fallback response
   */
  createNoDocumentsFallback(query) {
    const suggestions = [
      'Upload relevant documents (PDF, DOCX, HTML, TXT files)',
      'Try different search terms or keywords',
      'Check if your documents contain information related to your question',
      'Use more general terms if your query is very specific'
    ];

    const suggestionText = suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');

    return responseFormatter.formatErrorResponse(
      'No relevant documents found for your query.',
      `To get better results:\n${suggestionText}`
    );
  }

  /**
   * Create fallback response for insufficient context
   * @param {string} query - User query
   * @returns {string} Fallback response
   */
  createInsufficientContextFallback(query) {
    return responseFormatter.formatErrorResponse(
      'Available documents do not contain sufficient information to answer your query.',
      'Consider uploading additional relevant documents or rephrasing your question to be more specific to the content in your uploaded files.'
    );
  }

  /**
   * Create fallback response when document parsing fails
   * @param {string} query - User query
   * @param {string} userPineconeId - User's Pinecone ID
   * @returns {string|null} Fallback response or null
   */
  async createParsingErrorFallback(query, userPineconeId) {
    try {
      // Try to get any available document chunks despite parsing errors
      const searchResults = await advancedDocumentService.searchDocuments(userPineconeId, query, 3);
      
      if (searchResults.matches && searchResults.matches.length > 0) {
        const contextBlocks = [];
        searchResults.matches.forEach(docResult => {
          const topChunk = docResult.chunks[0];
          if (topChunk) {
            contextBlocks.push({
              source: docResult.fileName,
              chunkIndex: topChunk.chunkIndex,
              score: topChunk.score,
              text: topChunk.fullText || topChunk.text,
              fileType: docResult.fileType,
              metadata: {
                date: docResult.uploadDate,
                fileSize: docResult.fileSize
              }
            });
          }
        });

        if (contextBlocks.length > 0) {
          const provisions = contextBlocks.map(block => {
            const date = block.metadata?.date || "Date not available";
            const excerpt = block.text.substring(0, 150) + (block.text.length > 150 ? '...' : '');
            return `- ${block.source} | Chunk ${block.chunkIndex} | ${date}\nExcerpt: "${excerpt}"`;
          }).join('\n\n');

          const citations = responseFormatter.formatCitations(contextBlocks);

          return responseFormatter.buildFormattedResponse(
            provisions,
            'Some documents could not be processed properly, but available information is provided above. Consider re-uploading problematic documents for better results.',
            citations
          );
        }
      }
    } catch (fallbackError) {
      console.error('Parsing error fallback failed:', fallbackError);
    }
    
    return null;
  }

  /**
   * Create generic fallback response for unknown errors
   * @param {string} query - User query
   * @returns {string} Fallback response
   */
  createGenericErrorFallback(query) {
    return responseFormatter.formatErrorResponse(
      'An unexpected error occurred while processing your request.',
      'Please try rephrasing your question, check your internet connection, or contact support if the problem persists.'
    );
  }

  /**
   * Rebuild malformed response with available components
   * @param {string} rawResponse - Original AI response
   * @param {Array} contextBlocks - Document chunks
   * @param {Object} validation - Validation result
   * @returns {string} Rebuilt response
   */
  rebuildMalformedResponse(rawResponse, contextBlocks, validation) {
    console.log('Rebuilding malformed response, missing:', validation.missingElements);
    
    // Extract what we can from the raw response
    const provisions = validation.hasProvisions 
      ? responseFormatter.extractProvisions(rawResponse, contextBlocks)
      : responseFormatter.extractProvisions('', contextBlocks);
    
    const summary = validation.hasSummary 
      ? responseFormatter.extractSummary(rawResponse)
      : 'Based on the retrieved document chunks, please refer to the provisions above for detailed information.';
    
    const citations = responseFormatter.formatCitations(contextBlocks);
    
    return responseFormatter.buildFormattedResponse(provisions, summary, citations);
  }

  /**
   * Create fallback formatted response when formatting completely fails
   * @param {string} rawResponse - Original AI response
   * @param {Array} contextBlocks - Document chunks
   * @returns {string} Fallback formatted response
   */
  createFallbackFormattedResponse(rawResponse, contextBlocks) {
    console.log('Creating fallback formatted response due to formatting failure');
    
    // Create basic provisions from context blocks
    const provisions = contextBlocks.map(block => {
      const date = block.metadata?.date || "Date not available";
      const excerpt = block.text.substring(0, 150) + (block.text.length > 150 ? '...' : '');
      return `- ${block.source} | Chunk ${block.chunkIndex} | ${date}\nExcerpt: "${excerpt}"`;
    }).join('\n\n');

    // Use raw response as summary if it exists, otherwise create basic summary
    const summary = rawResponse && rawResponse.trim().length > 0
      ? `AI response formatting encountered an issue. Raw response: ${rawResponse.substring(0, 300)}${rawResponse.length > 300 ? '...' : ''}`
      : 'Response formatting failed. Please refer to the document excerpts above.';

    const citations = responseFormatter.formatCitations(contextBlocks);
    
    return responseFormatter.buildFormattedResponse(provisions, summary, citations);
  }

  /**
   * Categorize error for better handling
   * @param {Error} error - Error object
   * @returns {string} Error category
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('openai') || message.includes('api key') || message.includes('ai service')) {
      return 'ai_service';
    } else if (message.includes('pinecone') || message.includes('search') || message.includes('vector')) {
      return 'document_search';
    } else if (message.includes('embedding') || message.includes('model')) {
      return 'embedding_service';
    } else if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    } else if (message.includes('no documents') || message.includes('no matches') || message.includes('no results')) {
      return 'no_documents';
    } else if (message.includes('insufficient') || message.includes('not enough')) {
      return 'insufficient_context';
    } else if (message.includes('parsing') || message.includes('parse') || message.includes('malformed')) {
      return 'parsing_error';
    } else if (message.includes('network') || message.includes('connection')) {
      return 'network_error';
    } else if (message.includes('rate limit') || message.includes('quota')) {
      return 'rate_limit';
    } else {
      return 'unknown';
    }
  }

  // Utility method to format conversation history for OpenAI
  formatConversationHistory(messages) {
    return messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
  }

  /**
   * Handle no documents found scenario with enhanced suggestions
   * @param {string} query - User query
   * @param {Object} queryType - Query type information
   * @param {string} userPineconeId - User's Pinecone namespace
   * @returns {Object} Structured no documents response
   */
  handleNoDocumentsFound(query, queryType, userPineconeId) {
    console.log(`📭 No documents found for ${queryType.type} query: "${query}"`);
    
    // Analyze query to provide specific suggestions
    const suggestions = this.generateSearchSuggestions(query, queryType);
    
    const noDocsResponse = responseFormatter.formatStructuredErrorResponse(
      'No relevant documents found in your uploaded files for this query.',
      suggestions,
      queryType.isAnalytical 
        ? 'For analytical queries, I need multiple relevant documents to provide comprehensive comparisons and analysis.'
        : 'I can only provide information based on your uploaded documents.'
    );

    return {
      response: noDocsResponse,
      sources: [],
      totalSources: 0,
      hasContext: false,
      queryType: queryType.type,
      crossDocumentAnalysis: queryType.isAnalytical,
      errorType: 'no_documents',
      suggestions: suggestions,
      searchStrategy: 'no_results'
    };
  }

  /**
   * Handle insufficient document context scenario
   * @param {string} query - User query
   * @param {Object} queryType - Query type information
   * @param {number} totalChunks - Number of chunks found
   * @param {Array} contextBlocks - Available context blocks
   * @returns {Object} Structured insufficient context response
   */
  handleInsufficientContext(query, queryType, totalChunks, contextBlocks) {
    console.log(`📄 Insufficient context for ${queryType.type} query: ${totalChunks} chunks found, ${this.getMinimumChunksForQuery(queryType)} required`);
    
    // Analyze what's missing
    const contextAnalysis = this.analyzeInsufficientContext(query, queryType, contextBlocks);
    
    const insufficientResponse = responseFormatter.formatStructuredErrorResponse(
      `Limited information found for your ${queryType.type} query (${totalChunks} relevant sections found).`,
      [
        ...contextAnalysis.suggestions,
        'Upload additional documents that contain more detailed information about your topic',
        'Try breaking down complex queries into simpler, more specific questions',
        'Use different keywords that might appear in your documents'
      ],
      contextAnalysis.explanation
    );

    return {
      response: insufficientResponse,
      sources: contextBlocks.map(block => ({
        fileName: block.source,
        fileType: block.fileType,
        chunkIndex: block.chunkIndex,
        relevanceScore: block.score,
        preview: block.text.substring(0, 100) + '...'
      })),
      totalSources: totalChunks,
      hasContext: true,
      queryType: queryType.type,
      crossDocumentAnalysis: queryType.isAnalytical,
      errorType: 'insufficient_context',
      contextAnalysis: contextAnalysis,
      searchStrategy: 'limited_results'
    };
  }

  /**
   * Generate search suggestions based on query analysis
   * @param {string} query - User query
   * @param {Object} queryType - Query type information
   * @returns {Array} Search suggestions
   */
  generateSearchSuggestions(query, queryType) {
    const suggestions = [
      'Upload relevant documents (PDF, DOCX, HTML, TXT files)',
      'Try different search terms or keywords',
      'Use more general terms if your query is very specific'
    ];

    // Add query-type specific suggestions
    if (queryType.isAnalytical) {
      suggestions.push(
        'For analytical queries, ensure you have multiple documents that contain relevant information',
        'Try searching for individual concepts first, then ask for comparisons'
      );
    }

    if (queryType.type === 'comparison' && queryType.entities) {
      suggestions.push(
        `Try searching for "${queryType.entities[0]}" and "${queryType.entities[1]}" separately first`,
        'Ensure your documents contain information about both items you want to compare'
      );
    }

    if (queryType.type === 'differentiation') {
      suggestions.push(
        'Make sure your documents contain information about the concepts you want to differentiate',
        'Try using more specific terms related to the differences you\'re looking for'
      );
    }

    // Add query-specific suggestions based on content
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    if (queryWords.length > 0) {
      suggestions.push(`Try searching for individual terms like: ${queryWords.slice(0, 3).join(', ')}`);
    }

    return suggestions;
  }

  /**
   * Analyze insufficient context to provide specific guidance
   * @param {string} query - User query
   * @param {Object} queryType - Query type information
   * @param {Array} contextBlocks - Available context blocks
   * @returns {Object} Context analysis
   */
  analyzeInsufficientContext(query, queryType, contextBlocks) {
    const analysis = {
      foundDocuments: new Set(contextBlocks.map(block => block.source)).size,
      totalChunks: contextBlocks.length,
      avgRelevance: contextBlocks.reduce((sum, block) => sum + block.score, 0) / contextBlocks.length,
      suggestions: [],
      explanation: ''
    };

    // Analyze what type of content is missing
    if (queryType.isAnalytical && analysis.foundDocuments < 2) {
      analysis.suggestions.push(
        'Upload additional documents to enable comprehensive analysis',
        'Analytical queries work best with multiple relevant documents'
      );
      analysis.explanation = 'Comprehensive analysis requires information from multiple documents to provide meaningful comparisons and insights.';
    } else if (analysis.avgRelevance < 0.5) {
      analysis.suggestions.push(
        'The found information has low relevance to your query',
        'Try using more specific terms that appear in your documents',
        'Consider uploading documents that more directly address your question'
      );
      analysis.explanation = 'The available information is only loosely related to your query. More targeted documents would provide better results.';
    } else {
      analysis.suggestions.push(
        'The available information is relevant but limited',
        'Upload additional documents with more detailed information',
        'Try asking more specific questions about the available content'
      );
      analysis.explanation = 'Some relevant information was found, but additional context would help provide a more comprehensive response.';
    }

    return analysis;
  }

  /**
   * Get minimum chunks required for different query types
   * @param {Object} queryType - Query type information
   * @returns {number} Minimum chunks required
   */
  getMinimumChunksForQuery(queryType) {
    switch (queryType.type) {
      case 'comparison':
        return 4; // Need chunks from multiple documents
      case 'differentiation':
        return 3; // Need sufficient context for contrasts
      case 'analysis':
        return 3; // Need comprehensive information
      case 'summary':
        return 2; // Need reasonable amount of content
      default:
        return 1; // Basic queries can work with single chunk
    }
  }
}

module.exports = new ChatService();