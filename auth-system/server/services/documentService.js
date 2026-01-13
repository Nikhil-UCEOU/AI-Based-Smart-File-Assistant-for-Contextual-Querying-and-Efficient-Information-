const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const cheerio = require('cheerio');
const pineconeService = require('./pineconeService');
const pdfParsingService = require('./pdfParsingService');
const simpleDocumentProcessor = require('./simpleDocumentProcessor');

class DocumentService {
  constructor() {
    this.supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'text/html', // .html
      'text/plain' // .txt
    ];
  }

  isSupportedFileType(mimeType) {
    return this.supportedTypes.includes(mimeType);
  }

  async extractTextFromFile(filePath, mimeType) {
    try {
      switch (mimeType) {
        case 'application/pdf':
          return await this.extractFromPDF(filePath);
        
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractFromDocx(filePath);
        
        case 'text/html':
          return await this.extractFromHTML(filePath);
        
        case 'text/plain':
          return await this.extractFromText(filePath);
        
        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      console.error('Text extraction error:', error);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }

  async extractFromPDF(filePath) {
    try {
      return await pdfParsingService.extractText(filePath);
    } catch (error) {
      console.error('PDF extraction error:', error.message);
      throw error; // Re-throw the user-friendly error from pdfParsingService
    }
  }

  async extractFromDocx(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  async extractFromHTML(filePath) {
    try {
      const htmlContent = fs.readFileSync(filePath, 'utf8');
      const $ = cheerio.load(htmlContent);
      
      // Remove script and style elements completely
      $('script, style').remove();
      
      // Extract text content while preserving structure
      let text = $('body').length > 0 ? $('body').text() : $.text();
      
      // Clean up whitespace while preserving paragraph breaks
      text = text
        .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
        .replace(/\n\s*\n/g, '\n\n') // Preserve paragraph breaks
        .trim();
      
      // If no meaningful text was extracted, try getting all text
      if (!text || text.length < 10) {
        text = $.text().replace(/\s+/g, ' ').trim();
      }
      
      return text;
    } catch (error) {
      console.error('HTML extraction error:', error);
      throw new Error(`Failed to extract text from HTML: ${error.message}`);
    }
  }

  async extractFromText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
  }

  async createEmbedding(text) {
    // For now, we'll create a simple embedding based on text characteristics
    // In a real application, you'd use OpenAI's embedding API or similar
    const words = text.toLowerCase().split(/\s+/);
    const wordCount = words.length;
    const uniqueWords = new Set(words).size;
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / wordCount;
    
    // Create a 1536-dimensional vector (matching OpenAI's embedding size)
    const embedding = new Array(1536).fill(0);
    
    // Fill with simple features (this is a placeholder - use real embeddings in production)
    embedding[0] = Math.min(wordCount / 1000, 1); // Normalized word count
    embedding[1] = Math.min(uniqueWords / 500, 1); // Normalized unique words
    embedding[2] = Math.min(avgWordLength / 10, 1); // Normalized avg word length
    embedding[3] = text.includes('important') ? 1 : 0;
    embedding[4] = text.includes('summary') ? 1 : 0;
    embedding[5] = text.includes('conclusion') ? 1 : 0;
    
    // Fill remaining dimensions with random values based on text hash
    const textHash = this.simpleHash(text);
    for (let i = 6; i < 1536; i++) {
      embedding[i] = ((textHash * (i + 1)) % 1000) / 1000 - 0.5;
    }
    
    return embedding;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async storeInPinecone(userPineconeId, documentData, extractedText) {
    try {
      console.log(`📄 Using simple processor for: ${documentData.originalName}`);
      
      // Use the simple document processor
      const result = await simpleDocumentProcessor.processDocument(
        documentData.filePath,
        userPineconeId,
        {
          fileName: documentData.originalName,
          fileType: documentData.fileType,
          fileSize: documentData.fileSize
        }
      );
      
      console.log(`✅ Document processed: ${result.chunksStored} chunks stored`);
      return `doc_${userPineconeId}_${documentData.fileName}_${Date.now()}`;
    } catch (error) {
      console.error('❌ Failed to store document:', error);
      throw error;
    }
  }

  async searchDocuments(userPineconeId, query, topK = 5) {
    try {
      // Create embedding for the search query
      const queryEmbedding = await this.createEmbedding(query);
      
      // Search in user's dedicated Pinecone index
      const results = await pineconeService.searchDocuments(queryEmbedding, userPineconeId, {
        documentType: 'user_document'
      }, topK);
      
      return results;
    } catch (error) {
      console.error('❌ Document search failed:', error);
      throw error;
    }
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

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = new DocumentService();