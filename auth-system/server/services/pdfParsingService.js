const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Enhanced PDF Parsing Service with robust error handling and fallback methods
 */
class PDFParsingService {
  constructor() {
    this.maxFileSize = 50 * 1024 * 1024; // 50MB limit
    this.parseTimeout = 30000; // 30 second timeout
    this.retryAttempts = 2;
  }

  /**
   * Main PDF parsing method with comprehensive error handling
   * @param {Buffer|string} input - PDF buffer or file path
   * @returns {Promise<string>} Extracted text content
   */
  async extractText(input) {
    let buffer;
    let filePath = null;

    try {
      // Handle different input types
      if (typeof input === 'string') {
        filePath = input;
        buffer = await this.readFileWithValidation(filePath);
      } else if (Buffer.isBuffer(input)) {
        buffer = input;
      } else {
        throw new Error('Invalid input: expected file path or Buffer');
      }

      // Validate PDF buffer
      this.validatePDFBuffer(buffer);

      // Attempt parsing with retries
      return await this.parseWithRetries(buffer);

    } catch (error) {
      console.error('❌ PDF parsing failed:', error.message);
      throw this.createUserFriendlyError(error);
    }
  }

  /**
   * Read file with validation and error handling
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<Buffer>} File buffer
   */
  async readFileWithValidation(filePath) {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('PDF file not found');
      }

      // Check file stats
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error('PDF file is empty');
      }

      if (stats.size > this.maxFileSize) {
        throw new Error(`PDF file is too large (${this.formatFileSize(stats.size)}). Maximum size is ${this.formatFileSize(this.maxFileSize)}`);
      }

      // Read file
      return fs.readFileSync(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('PDF file not found');
      } else if (error.code === 'EACCES') {
        throw new Error('Permission denied reading PDF file');
      } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
        throw new Error('Too many files open - please try again');
      } else {
        throw error;
      }
    }
  }

  /**
   * Validate PDF buffer structure
   * @param {Buffer} buffer - PDF buffer to validate
   */
  validatePDFBuffer(buffer) {
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty or invalid PDF buffer');
    }

    if (buffer.length < 4) {
      throw new Error('File is too small to be a valid PDF');
    }

    // Check PDF header signature
    const header = buffer.slice(0, 4).toString();
    if (header !== '%PDF') {
      throw new Error('File does not appear to be a valid PDF (missing PDF header)');
    }

    // Check for PDF version
    const versionMatch = buffer.slice(0, 20).toString().match(/%PDF-(\d+\.\d+)/);
    if (!versionMatch) {
      throw new Error('Invalid PDF version information');
    }

    const version = parseFloat(versionMatch[1]);
    if (version < 1.0 || version > 2.0) {
      console.warn(`⚠️ Unusual PDF version detected: ${version}`);
    }

    // Check file size
    if (buffer.length > this.maxFileSize) {
      throw new Error(`PDF file is too large (${this.formatFileSize(buffer.length)}). Maximum size is ${this.formatFileSize(this.maxFileSize)}`);
    }
  }

  /**
   * Parse PDF with retry logic
   * @param {Buffer} buffer - PDF buffer
   * @returns {Promise<string>} Extracted text
   */
  async parseWithRetries(buffer) {
    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`📄 Attempting PDF parsing (attempt ${attempt}/${this.retryAttempts})...`);
        
        const result = await this.parsePDFBuffer(buffer);
        
        console.log(`✅ PDF parsing successful on attempt ${attempt}`);
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ PDF parsing attempt ${attempt} failed: ${error.message}`);
        
        // Don't retry for certain types of errors
        if (this.isNonRetryableError(error)) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < this.retryAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Core PDF parsing logic with timeout
   * @param {Buffer} buffer - PDF buffer
   * @returns {Promise<string>} Extracted text
   */
  async parsePDFBuffer(buffer) {
    // Create parsing promise
    const parsePromise = pdfParse(buffer, {
      max: 0, // Parse all pages
      version: 'v1.10.100', // Specify PDF.js version for compatibility
      normalizeWhitespace: true, // Clean up whitespace
      disableCombineTextItems: false // Allow text combination for better readability
    });

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`PDF parsing timed out after ${this.parseTimeout / 1000} seconds`));
      }, this.parseTimeout);
    });

    // Race between parsing and timeout
    const data = await Promise.race([parsePromise, timeoutPromise]);
    
    if (!data) {
      throw new Error('PDF parsing returned no data');
    }

    if (!data.text || typeof data.text !== 'string') {
      throw new Error('No text content extracted from PDF');
    }

    // Clean and validate extracted text
    const cleanText = data.text.trim();
    if (cleanText.length === 0) {
      throw new Error('PDF contains no readable text content');
    }

    // Log extraction details
    const pageCount = data.numpages || 'unknown';
    const wordCount = cleanText.split(/\s+/).length;
    console.log(`✅ PDF text extracted: ${cleanText.length} characters, ${wordCount} words, ${pageCount} pages`);
    
    return cleanText;
  }

  /**
   * Check if error should not be retried
   * @param {Error} error - Error to check
   * @returns {boolean} True if error should not be retried
   */
  isNonRetryableError(error) {
    const nonRetryableMessages = [
      'invalid pdf',
      'corrupted',
      'password',
      'encrypted',
      'missing pdf header',
      'too large',
      'empty',
      'permission denied'
    ];

    const message = error.message.toLowerCase();
    return nonRetryableMessages.some(msg => message.includes(msg));
  }

  /**
   * Create user-friendly error messages
   * @param {Error} error - Original error
   * @returns {Error} User-friendly error
   */
  createUserFriendlyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('invalid pdf') || message.includes('missing pdf header')) {
      return new Error('The file is not a valid PDF or is corrupted. Please check the file and try again.');
    } else if (message.includes('password') || message.includes('encrypted')) {
      return new Error('This PDF is password protected or encrypted. Please provide an unprotected PDF file.');
    } else if (message.includes('timeout')) {
      return new Error('The PDF file is too complex or large to process within the time limit. Please try a smaller or simpler PDF.');
    } else if (message.includes('too large')) {
      return new Error('The PDF file is too large. Please try a file smaller than 50MB.');
    } else if (message.includes('empty') || message.includes('no text')) {
      return new Error('The PDF appears to be empty or contains no readable text. Please check if the PDF has text content.');
    } else if (message.includes('memory') || message.includes('heap')) {
      return new Error('The PDF file requires too much memory to process. Please try a smaller file.');
    } else if (message.includes('permission')) {
      return new Error('Permission denied accessing the PDF file. Please check file permissions.');
    } else {
      return new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get service status and configuration
   * @returns {object} Service status
   */
  getStatus() {
    return {
      maxFileSize: this.maxFileSize,
      maxFileSizeFormatted: this.formatFileSize(this.maxFileSize),
      parseTimeout: this.parseTimeout,
      retryAttempts: this.retryAttempts,
      pdfParseVersion: require('pdf-parse/package.json').version
    };
  }
}

module.exports = new PDFParsingService();