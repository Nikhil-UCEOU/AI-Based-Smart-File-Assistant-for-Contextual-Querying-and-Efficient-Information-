class ResponseFormatter {
  constructor() {
    this.legalDisclaimer = "⚖️ Legal Disclaimer: This information is for research purposes only. I am not a licensed attorney, and this does not constitute legal advice.";
  }

  /**
   * Format AI response into legal research assistant structure
   * @param {string} aiResponse - Raw AI response
   * @param {Array} contextBlocks - Document chunks used for context
   * @returns {string} Formatted response
   */
  formatLegalResponse(aiResponse, contextBlocks) {
    // Check if AI response already follows the format
    if (this.isAlreadyFormatted(aiResponse)) {
      return aiResponse;
    }

    // Extract or create sections from AI response
    const provisions = this.extractProvisions(aiResponse, contextBlocks);
    const summary = this.extractSummary(aiResponse);
    const citations = this.formatCitations(contextBlocks);

    return this.buildFormattedResponse(provisions, summary, citations);
  }

  /**
   * Check if response is already in legal format
   * @param {string} response - AI response to check
   * @returns {boolean} True if already formatted
   */
  isAlreadyFormatted(response) {
    return response.includes('RELEVANT LEGAL PROVISIONS:') && 
           response.includes('LEGAL SUMMARY:') && 
           response.includes('CITATIONS & SOURCES:');
  }

  /**
   * Extract provisions section from AI response or create from context
   * @param {string} aiResponse - AI response
   * @param {Array} contextBlocks - Document chunks
   * @returns {string} Provisions section
   */
  extractProvisions(aiResponse, contextBlocks) {
    // If AI response already has provisions, extract them
    const provisionsMatch = aiResponse.match(/RELEVANT LEGAL PROVISIONS:(.*?)(?=LEGAL SUMMARY:|CITATIONS & SOURCES:|$)/s);
    if (provisionsMatch) {
      return provisionsMatch[1].trim();
    }

    // Create provisions from context blocks
    if (contextBlocks.length === 0) {
      return "No relevant documents found in your uploaded files for this query.";
    }

    return contextBlocks.map(block => {
      const date = block.metadata?.date || "Date not available";
      const excerpt = this.extractQuotedText(block.text);
      return `- ${block.source} | Chunk ${block.chunkIndex} | ${date}\nExcerpt: "${excerpt}"`;
    }).join('\n\n');
  }

  /**
   * Extract summary section from AI response
   * @param {string} aiResponse - AI response
   * @returns {string} Summary section
   */
  extractSummary(aiResponse) {
    const summaryMatch = aiResponse.match(/LEGAL SUMMARY:(.*?)(?=CITATIONS & SOURCES:|⚖️|$)/s);
    if (summaryMatch) {
      return summaryMatch[1].trim();
    }

    // If no summary found, use the main content as summary
    const cleanResponse = aiResponse
      .replace(/RELEVANT LEGAL PROVISIONS:.*?(?=LEGAL SUMMARY:|CITATIONS & SOURCES:|$)/s, '')
      .replace(/CITATIONS & SOURCES:.*$/s, '')
      .replace(/⚖️.*$/s, '')
      .trim();

    return cleanResponse || "Based on the retrieved document chunks, please refer to the provisions above for detailed information.";
  }

  /**
   * Format citations from context blocks with enhanced chunk-level granularity
   * @param {Array} contextBlocks - Document chunks
   * @returns {string} Citations section
   */
  formatCitations(contextBlocks) {
    if (contextBlocks.length === 0) {
      return "No sources available";
    }

    const citations = new Map();
    
    contextBlocks.forEach(block => {
      const key = `${block.source}_${block.chunkIndex}`;
      if (!citations.has(key)) {
        const date = this.extractDate(block);
        citations.set(key, {
          fileName: block.source,
          chunkIndex: block.chunkIndex,
          date: date,
          fileType: block.fileType || 'Unknown'
        });
      }
    });

    return Array.from(citations.values())
      .sort((a, b) => {
        // Sort by filename first, then by chunk index
        if (a.fileName !== b.fileName) {
          return a.fileName.localeCompare(b.fileName);
        }
        return a.chunkIndex - b.chunkIndex;
      })
      .map(source => `- Resource: ${source.fileName} | Chunk ${source.chunkIndex} | ${source.date}`)
      .join('\n');
  }

  /**
   * Extract date from block metadata with fallback handling
   * @param {Object} block - Document chunk block
   * @returns {string} Date string or "Date not available"
   */
  extractDate(block) {
    if (block.metadata?.date) {
      return block.metadata.date;
    }
    if (block.metadata?.uploadDate) {
      return new Date(block.metadata.uploadDate).toISOString().split('T')[0];
    }
    if (block.metadata?.processedAt) {
      return new Date(block.metadata.processedAt).toISOString().split('T')[0];
    }
    return "Date not available";
  }

  /**
   * Format citations for cross-document analysis with grouping
   * @param {Array} contextBlocks - Document chunks
   * @returns {Object} Grouped citations by document
   */
  formatCitationsGrouped(contextBlocks) {
    const grouped = new Map();
    
    contextBlocks.forEach(block => {
      if (!grouped.has(block.source)) {
        grouped.set(block.source, {
          fileName: block.source,
          fileType: block.fileType || 'Unknown',
          chunks: new Set(),
          date: this.extractDate(block)
        });
      }
      grouped.get(block.source).chunks.add(block.chunkIndex);
    });

    return Array.from(grouped.entries()).map(([fileName, info]) => ({
      fileName,
      fileType: info.fileType,
      chunks: Array.from(info.chunks).sort((a, b) => a - b),
      date: info.date,
      chunkCount: info.chunks.size
    }));
  }

  /**
   * Create resource labels for API responses
   * @param {Array} contextBlocks - Document chunks
   * @returns {Array} Resource labels
   */
  createResourceLabels(contextBlocks) {
    return contextBlocks.map(block => ({
      resourceLabel: `Resource: ${block.source}`,
      chunkLabel: `Chunk ${block.chunkIndex}`,
      fullLabel: `Resource: ${block.source} | Chunk ${block.chunkIndex}`,
      fileName: block.source,
      chunkIndex: block.chunkIndex,
      preservedExtension: this.preserveFileExtension(block.source)
    }));
  }

  /**
   * Preserve original file extension in citations
   * @param {string} fileName - Original filename
   * @returns {string} Filename with preserved extension
   */
  preserveFileExtension(fileName) {
    // Ensure the filename retains its original extension
    return fileName; // Already includes extension from source
  }

  /**
   * Build complete formatted response
   * @param {string} provisions - Provisions section
   * @param {string} summary - Summary section
   * @param {string} citations - Citations section
   * @returns {string} Complete formatted response
   */
  buildFormattedResponse(provisions, summary, citations) {
    return `RELEVANT LEGAL PROVISIONS:
${provisions}

LEGAL SUMMARY:
${summary}

CITATIONS & SOURCES:
${citations}

${this.legalDisclaimer}`;
  }

  /**
   * Extract quoted text from document chunk (first 150 chars)
   * @param {string} text - Full text
   * @returns {string} Quoted excerpt
   */
  extractQuotedText(text) {
    const excerpt = text.substring(0, 150).trim();
    return excerpt + (text.length > 150 ? '...' : '');
  }

  /**
   * Format error responses in legal format with enhanced suggestions
   * @param {string} errorMessage - Error message
   * @param {string} suggestion - Suggestion for user
   * @returns {string} Formatted error response
   */
  formatErrorResponse(errorMessage, suggestion = null) {
    const defaultSuggestion = "Please upload relevant documents or try different search terms.";
    
    return `RELEVANT LEGAL PROVISIONS:
${errorMessage}

LEGAL SUMMARY:
${suggestion || defaultSuggestion}

CITATIONS & SOURCES:
No sources available

${this.legalDisclaimer}`;
  }

  /**
   * Format error response with structured suggestions
   * @param {string} errorMessage - Error message
   * @param {Array} suggestions - Array of suggestion strings
   * @param {string} context - Additional context about the error
   * @returns {string} Formatted error response with structured suggestions
   */
  formatStructuredErrorResponse(errorMessage, suggestions = [], context = null) {
    const suggestionText = suggestions.length > 0 
      ? suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')
      : "Please try again or contact support if the issue persists.";

    const summaryContent = context 
      ? `${context}\n\nRecommended actions:\n${suggestionText}`
      : suggestionText;

    return `RELEVANT LEGAL PROVISIONS:
${errorMessage}

LEGAL SUMMARY:
${summaryContent}

CITATIONS & SOURCES:
No sources available

${this.legalDisclaimer}`;
  }

  /**
   * Format partial response when some services fail but others succeed
   * @param {string} provisions - Available provisions
   * @param {string} errorContext - Error context
   * @param {string} citations - Available citations
   * @returns {string} Formatted partial response
   */
  formatPartialResponse(provisions, errorContext, citations) {
    const summary = `${errorContext} Available information from your documents is provided above.`;
    
    return this.buildFormattedResponse(provisions, summary, citations);
  }

  /**
   * Format response for service degradation scenarios
   * @param {string} serviceStatus - Status of affected service
   * @param {string} availableData - What data is still available
   * @param {Array} contextBlocks - Available document chunks
   * @returns {string} Formatted degraded service response
   */
  formatDegradedServiceResponse(serviceStatus, availableData, contextBlocks = []) {
    const provisions = contextBlocks.length > 0 
      ? this.extractProvisions('', contextBlocks)
      : `Service temporarily degraded: ${serviceStatus}`;

    const summary = `${availableData} Some features may be temporarily unavailable, but document information is provided where possible.`;
    
    const citations = contextBlocks.length > 0 
      ? this.formatCitations(contextBlocks)
      : "Limited sources available due to service degradation";

    return this.buildFormattedResponse(provisions, summary, citations);
  }

  /**
   * Enhanced validation for response structure and formatting
   * @param {string} response - Response to validate
   * @param {Object} options - Validation options
   * @returns {Object} Detailed validation result
   */
  validateResponseStructure(response, options = {}) {
    const { strict = false } = options;
    
    if (!strict) {
      // Backward compatible validation for existing tests
      return this.validateBasicStructure(response);
    }
    
    // Enhanced validation for production use
    const validation = {
      isValid: true,
      score: 0,
      maxScore: 100,
      issues: [],
      sections: {},
      formatting: {},
      citations: {},
      overall: {}
    };

    // Check required sections
    const sections = this.validateSections(response);
    validation.sections = sections;
    validation.score += sections.score;

    // Check formatting requirements
    const formatting = this.validateFormatting(response);
    validation.formatting = formatting;
    validation.score += formatting.score;

    // Check citation requirements
    const citations = this.validateCitations(response);
    validation.citations = citations;
    validation.score += citations.score;

    // Overall structure validation
    const overall = this.validateOverallStructure(response);
    validation.overall = overall;
    validation.score += overall.score;

    // Collect all issues
    validation.issues = [
      ...sections.issues,
      ...formatting.issues,
      ...citations.issues,
      ...overall.issues
    ];

    validation.isValid = validation.issues.length === 0;
    validation.grade = this.getValidationGrade(validation.score);

    return validation;
  }

  /**
   * Basic validation for backward compatibility
   * @param {string} response - Response to validate
   * @returns {Object} Basic validation result
   */
  validateBasicStructure(response) {
    const hasProvisions = response.includes('RELEVANT LEGAL PROVISIONS:');
    const hasSummary = response.includes('LEGAL SUMMARY:');
    const hasCitations = response.includes('CITATIONS & SOURCES:');
    const hasDisclaimer = response.includes(this.legalDisclaimer);

    return {
      isValid: hasProvisions && hasSummary && hasCitations && hasDisclaimer,
      hasProvisions,
      hasSummary,
      hasCitations,
      hasDisclaimer,
      missingElements: [
        !hasProvisions && 'RELEVANT LEGAL PROVISIONS',
        !hasSummary && 'LEGAL SUMMARY',
        !hasCitations && 'CITATIONS & SOURCES',
        !hasDisclaimer && 'Legal Disclaimer'
      ].filter(Boolean)
    };
  }

  /**
   * Validate required sections presence and content
   * @param {string} response - Response to validate
   * @returns {Object} Section validation result
   */
  validateSections(response) {
    const result = {
      score: 0,
      maxScore: 40,
      issues: [],
      hasProvisions: false,
      hasSummary: false,
      hasCitations: false,
      hasDisclaimer: false
    };

    // Check for RELEVANT LEGAL PROVISIONS
    if (response.includes('RELEVANT LEGAL PROVISIONS:')) {
      result.hasProvisions = true;
      result.score += 10;
      
      // Check if provisions section has content
      const provisionsMatch = response.match(/RELEVANT LEGAL PROVISIONS:(.*?)(?=LEGAL SUMMARY:|CITATIONS & SOURCES:|$)/s);
      if (provisionsMatch && provisionsMatch[1].trim().length < 10) {
        result.issues.push('RELEVANT LEGAL PROVISIONS section appears to be empty or too short');
      }
    } else {
      result.issues.push('Missing required section: RELEVANT LEGAL PROVISIONS');
    }

    // Check for LEGAL SUMMARY
    if (response.includes('LEGAL SUMMARY:')) {
      result.hasSummary = true;
      result.score += 10;
      
      // Check if summary section has adequate content
      const summaryMatch = response.match(/LEGAL SUMMARY:(.*?)(?=CITATIONS & SOURCES:|⚖️|$)/s);
      if (summaryMatch && summaryMatch[1].trim().length < 20) {
        result.issues.push('LEGAL SUMMARY section appears to be too short');
      }
    } else {
      result.issues.push('Missing required section: LEGAL SUMMARY');
    }

    // Check for CITATIONS & SOURCES
    if (response.includes('CITATIONS & SOURCES:')) {
      result.hasCitations = true;
      result.score += 10;
    } else {
      result.issues.push('Missing required section: CITATIONS & SOURCES');
    }

    // Check for Legal Disclaimer
    if (response.includes(this.legalDisclaimer)) {
      result.hasDisclaimer = true;
      result.score += 10;
    } else {
      result.issues.push('Missing required legal disclaimer');
    }

    return result;
  }

  /**
   * Validate formatting requirements
   * @param {string} response - Response to validate
   * @returns {Object} Formatting validation result
   */
  validateFormatting(response) {
    const result = {
      score: 0,
      maxScore: 25,
      issues: [],
      hasUppercaseHeaders: false,
      hasQuotedText: false,
      hasProperLineBreaks: false
    };

    // Check for uppercase section headers
    const uppercaseHeaders = [
      'RELEVANT LEGAL PROVISIONS:',
      'LEGAL SUMMARY:',
      'CITATIONS & SOURCES:'
    ];
    
    const foundHeaders = uppercaseHeaders.filter(header => response.includes(header));
    if (foundHeaders.length === uppercaseHeaders.length) {
      result.hasUppercaseHeaders = true;
      result.score += 10;
    } else {
      result.issues.push('Section headers should be in uppercase format');
    }

    // Check for quoted text in provisions
    if (response.includes('Excerpt: "') && response.includes('"')) {
      result.hasQuotedText = true;
      result.score += 8;
    } else if (response.includes('RELEVANT LEGAL PROVISIONS:') && !response.includes('No relevant documents')) {
      result.issues.push('Document excerpts should be enclosed in quotation marks');
    }

    // Check for proper line breaks between sections
    const sectionBreaks = response.split('\n\n').length;
    if (sectionBreaks >= 3) {
      result.hasProperLineBreaks = true;
      result.score += 7;
    } else {
      result.issues.push('Sections should be separated by proper line breaks');
    }

    return result;
  }

  /**
   * Validate citation requirements
   * @param {string} response - Response to validate
   * @returns {Object} Citation validation result
   */
  validateCitations(response) {
    const result = {
      score: 0,
      maxScore: 25,
      issues: [],
      hasResourceFormat: false,
      hasChunkInfo: false,
      hasDateInfo: false
    };

    const citationsSection = response.match(/CITATIONS & SOURCES:(.*?)(?=⚖️|$)/s);
    if (citationsSection) {
      const citationsText = citationsSection[1];

      // Check for "Resource:" format
      if (citationsText.includes('Resource:')) {
        result.hasResourceFormat = true;
        result.score += 10;
      } else if (!citationsText.includes('No sources available')) {
        result.issues.push('Citations should use "Resource: filename" format');
      }

      // Check for chunk information
      if (citationsText.includes('Chunk')) {
        result.hasChunkInfo = true;
        result.score += 8;
      } else if (!citationsText.includes('No sources available')) {
        result.issues.push('Citations should include chunk information');
      }

      // Check for date information
      if (citationsText.includes('Date not available') || /\d{4}-\d{2}-\d{2}/.test(citationsText)) {
        result.hasDateInfo = true;
        result.score += 7;
      } else if (!citationsText.includes('No sources available')) {
        result.issues.push('Citations should include date information or "Date not available"');
      }
    }

    return result;
  }

  /**
   * Validate overall structure and flow
   * @param {string} response - Response to validate
   * @returns {Object} Overall validation result
   */
  validateOverallStructure(response) {
    const result = {
      score: 0,
      maxScore: 10,
      issues: [],
      hasLogicalFlow: false,
      hasConsistentStyle: false
    };

    // Check section order
    const provisionsIndex = response.indexOf('RELEVANT LEGAL PROVISIONS:');
    const summaryIndex = response.indexOf('LEGAL SUMMARY:');
    const citationsIndex = response.indexOf('CITATIONS & SOURCES:');
    const disclaimerIndex = response.indexOf('⚖️');

    if (provisionsIndex < summaryIndex && summaryIndex < citationsIndex && citationsIndex < disclaimerIndex) {
      result.hasLogicalFlow = true;
      result.score += 5;
    } else {
      result.issues.push('Sections should appear in the correct order: Provisions → Summary → Citations → Disclaimer');
    }

    // Check for consistent professional style
    const professionalIndicators = [
      response.includes('based on'),
      response.includes('according to'),
      response.includes('as stated in'),
      response.includes('the documents indicate')
    ];

    if (professionalIndicators.some(indicator => indicator)) {
      result.hasConsistentStyle = true;
      result.score += 5;
    } else {
      result.issues.push('Response should use professional legal research language');
    }

    return result;
  }

  /**
   * Get validation grade based on score
   * @param {number} score - Validation score
   * @returns {string} Grade letter
   */
  getValidationGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Fix common validation issues automatically
   * @param {string} response - Response to fix
   * @param {Object} validation - Validation result
   * @returns {string} Fixed response
   */
  autoFixValidationIssues(response, validation) {
    let fixedResponse = response;

    // Fix missing sections by rebuilding response
    if (!validation.sections.hasProvisions || !validation.sections.hasSummary || !validation.sections.hasCitations) {
      console.log('🔧 Auto-fixing missing sections in response');
      // This would require context blocks, so we'll return the original response
      // The calling code should handle rebuilding if sections are missing
      return response;
    }

    // Fix missing disclaimer
    if (!validation.sections.hasDisclaimer) {
      fixedResponse += `\n\n${this.legalDisclaimer}`;
    }

    // Fix section header formatting
    if (!validation.formatting.hasUppercaseHeaders) {
      fixedResponse = fixedResponse
        .replace(/relevant legal provisions:/gi, 'RELEVANT LEGAL PROVISIONS:')
        .replace(/legal summary:/gi, 'LEGAL SUMMARY:')
        .replace(/citations & sources:/gi, 'CITATIONS & SOURCES:');
    }

    return fixedResponse;
  }

  /**
   * Extract source information for API response
   * @param {Array} contextBlocks - Document chunks
   * @returns {Array} Source information array
   */
  extractSourceInformation(contextBlocks) {
    return contextBlocks.map(block => ({
      fileName: block.source,
      fileType: block.fileType,
      chunkIndex: block.chunkIndex,
      relevanceScore: Math.round(block.score * 100),
      preview: block.text.substring(0, 150) + '...',
      resourceLabel: `Resource: ${block.source}`
    }));
  }
}

module.exports = new ResponseFormatter();