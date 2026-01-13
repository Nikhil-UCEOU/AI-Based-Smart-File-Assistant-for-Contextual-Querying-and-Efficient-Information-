const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Comprehensive File Validation Service
 * Provides robust validation for uploaded files with detailed error reporting
 */
class FileValidationService {
  constructor() {
    // Configuration
    this.config = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxBatchSize: 20, // Maximum files in batch
      maxTotalBatchSize: 200 * 1024 * 1024, // 200MB total for batch
      
      // Supported file types with detailed configuration
      supportedTypes: {
        'application/pdf': {
          extensions: ['.pdf'],
          maxSize: 50 * 1024 * 1024, // 50MB
          magicNumbers: ['%PDF'],
          description: 'PDF Document'
        },
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
          extensions: ['.docx'],
          maxSize: 25 * 1024 * 1024, // 25MB
          magicNumbers: ['PK'], // DOCX files are ZIP archives
          description: 'Microsoft Word Document'
        },
        'text/html': {
          extensions: ['.html', '.htm'],
          maxSize: 10 * 1024 * 1024, // 10MB
          magicNumbers: ['<!DOCTYPE', '<html', '<HTML'],
          description: 'HTML Document'
        },
        'text/plain': {
          extensions: ['.txt'],
          maxSize: 10 * 1024 * 1024, // 10MB
          magicNumbers: [], // Text files don't have specific magic numbers
          description: 'Text Document'
        }
      },
      
      // Dangerous file extensions to always reject
      dangerousExtensions: [
        '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
        '.app', '.deb', '.pkg', '.dmg', '.rpm', '.msi', '.dll', '.so', '.dylib'
      ],
      
      // Suspicious patterns in filenames
      suspiciousPatterns: [
        /\.(exe|bat|cmd|com|scr|pif|vbs|js|jar)$/i,
        /\.(php|asp|jsp|cgi)$/i,
        /\.(sh|bash|zsh|fish)$/i,
        /\.(py|rb|pl|lua)$/i
      ]
    };
    
    // Cache for duplicate detection
    this.duplicateCache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Validate a single file
   * @param {Object} file - File object from multer or File API
   * @param {string} userId - User ID for duplicate checking
   * @returns {Promise<ValidationResult>}
   */
  async validateFile(file, userId = null) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      fileInfo: {
        originalName: file.originalname || file.name,
        size: file.size,
        mimeType: file.mimetype || file.type,
        extension: this.getFileExtension(file.originalname || file.name),
        hash: null
      },
      validationType: 'single'
    };

    try {
      // Step 1: Basic file existence and structure validation
      await this.validateBasicStructure(file, result);
      
      if (!result.isValid) return result;

      // Step 2: Security validation
      await this.validateSecurity(file, result);
      
      if (!result.isValid) return result;

      // Step 3: File type and MIME validation
      await this.validateFileType(file, result);
      
      if (!result.isValid) return result;

      // Step 4: Size validation
      await this.validateSize(file, result);
      
      if (!result.isValid) return result;

      // Step 5: Content validation (if file path available)
      if (file.path) {
        await this.validateContent(file, result);
      }
      
      if (!result.isValid) return result;

      // Step 6: Duplicate detection (if userId provided)
      if (userId) {
        await this.checkDuplicates(file, userId, result);
      }

      // Step 7: Generate file hash for tracking
      if (file.path) {
        result.fileInfo.hash = await this.generateFileHash(file.path);
      }

      console.log(`✅ File validation passed: ${result.fileInfo.originalName}`);
      
    } catch (error) {
      console.error('❌ File validation error:', error.message);
      result.isValid = false;
      result.errors.push(`Validation failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Validate a batch of files
   * @param {Array} files - Array of file objects
   * @param {string} userId - User ID for duplicate checking
   * @returns {Promise<BatchValidationResult>}
   */
  async validateBatch(files, userId = null) {
    const result = {
      isValid: true,
      totalFiles: files.length,
      validFiles: [],
      invalidFiles: [],
      errors: [],
      warnings: [],
      batchInfo: {
        totalSize: 0,
        duplicateCount: 0,
        typeDistribution: {}
      },
      validationType: 'batch'
    };

    try {
      // Step 1: Validate batch constraints
      if (files.length === 0) {
        result.isValid = false;
        result.errors.push('No files provided for validation');
        return result;
      }

      if (files.length > this.config.maxBatchSize) {
        result.isValid = false;
        result.errors.push(`Too many files. Maximum ${this.config.maxBatchSize} files allowed per batch`);
        return result;
      }

      // Calculate total batch size
      const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
      result.batchInfo.totalSize = totalSize;

      if (totalSize > this.config.maxTotalBatchSize) {
        result.isValid = false;
        result.errors.push(`Batch too large. Maximum total size is ${this.formatFileSize(this.config.maxTotalBatchSize)}`);
        return result;
      }

      // Step 2: Validate each file individually
      const validationPromises = files.map(async (file, index) => {
        try {
          const fileResult = await this.validateFile(file, userId);
          fileResult.batchIndex = index;
          
          if (fileResult.isValid) {
            result.validFiles.push(fileResult);
            
            // Update type distribution
            const mimeType = fileResult.fileInfo.mimeType;
            result.batchInfo.typeDistribution[mimeType] = 
              (result.batchInfo.typeDistribution[mimeType] || 0) + 1;
          } else {
            result.invalidFiles.push(fileResult);
          }
          
          return fileResult;
        } catch (error) {
          console.error(`❌ Error validating file ${index}:`, error.message);
          return {
            isValid: false,
            errors: [`Validation error: ${error.message}`],
            fileInfo: { originalName: file.originalname || file.name || `file-${index}` },
            batchIndex: index
          };
        }
      });

      await Promise.all(validationPromises);

      // Step 3: Check if any files are valid
      if (result.validFiles.length === 0) {
        result.isValid = false;
        result.errors.push('No valid files found in batch');
      } else if (result.invalidFiles.length > 0) {
        result.warnings.push(`${result.invalidFiles.length} files failed validation and will be skipped`);
      }

      // Step 4: Detect cross-file duplicates within batch
      await this.detectBatchDuplicates(result.validFiles, result);

      console.log(`✅ Batch validation completed: ${result.validFiles.length}/${result.totalFiles} files valid`);

    } catch (error) {
      console.error('❌ Batch validation error:', error.message);
      result.isValid = false;
      result.errors.push(`Batch validation failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Validate basic file structure
   */
  async validateBasicStructure(file, result) {
    // Check if file object has required properties
    if (!file) {
      result.isValid = false;
      result.errors.push('No file provided');
      return;
    }

    if (!file.originalname && !file.name) {
      result.isValid = false;
      result.errors.push('File has no name');
      return;
    }

    if (file.size === undefined || file.size === null) {
      result.isValid = false;
      result.errors.push('File size information missing');
      return;
    }

    if (file.size === 0) {
      result.isValid = false;
      result.errors.push('File is empty (0 bytes)');
      return;
    }

    // Check filename length
    const filename = file.originalname || file.name;
    if (filename.length > 255) {
      result.isValid = false;
      result.errors.push('Filename is too long (maximum 255 characters)');
      return;
    }

    // Check for null bytes in filename (security issue)
    if (filename.includes('\0')) {
      result.isValid = false;
      result.errors.push('Filename contains invalid characters');
      return;
    }
  }

  /**
   * Validate file security
   */
  async validateSecurity(file, result) {
    const filename = file.originalname || file.name;
    const extension = this.getFileExtension(filename).toLowerCase();

    // Check for dangerous extensions
    if (this.config.dangerousExtensions.includes(extension)) {
      result.isValid = false;
      result.errors.push(`File type '${extension}' is not allowed for security reasons`);
      return;
    }

    // Check for suspicious patterns
    for (const pattern of this.config.suspiciousPatterns) {
      if (pattern.test(filename)) {
        result.isValid = false;
        result.errors.push(`Filename contains suspicious pattern and is not allowed`);
        return;
      }
    }

    // Check for double extensions (e.g., file.pdf.exe)
    const parts = filename.split('.');
    if (parts.length > 2) {
      const secondLastExt = '.' + parts[parts.length - 2].toLowerCase();
      if (this.config.dangerousExtensions.includes(secondLastExt)) {
        result.isValid = false;
        result.errors.push('File has suspicious double extension');
        return;
      }
    }

    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      result.isValid = false;
      result.errors.push('Filename contains invalid path characters');
      return;
    }
  }

  /**
   * Validate file type and MIME type
   */
  async validateFileType(file, result) {
    const mimeType = file.mimetype || file.type;
    const filename = file.originalname || file.name;
    const extension = this.getFileExtension(filename).toLowerCase();

    // Check if MIME type is supported
    if (!this.config.supportedTypes[mimeType]) {
      result.isValid = false;
      result.errors.push(`File type '${mimeType}' is not supported. Supported types: ${this.getSupportedTypesDescription()}`);
      return;
    }

    const typeConfig = this.config.supportedTypes[mimeType];

    // Check if extension matches MIME type
    if (!typeConfig.extensions.includes(extension)) {
      result.warnings.push(`File extension '${extension}' doesn't match MIME type '${mimeType}'`);
    }

    result.fileInfo.typeConfig = typeConfig;
  }

  /**
   * Validate file size
   */
  async validateSize(file, result) {
    const mimeType = file.mimetype || file.type;
    const typeConfig = this.config.supportedTypes[mimeType];
    
    if (!typeConfig) return; // Already handled in validateFileType

    // Check against type-specific size limit
    if (file.size > typeConfig.maxSize) {
      result.isValid = false;
      result.errors.push(`File is too large for ${typeConfig.description}. Maximum size: ${this.formatFileSize(typeConfig.maxSize)}, actual size: ${this.formatFileSize(file.size)}`);
      return;
    }

    // Check against global size limit
    if (file.size > this.config.maxFileSize) {
      result.isValid = false;
      result.errors.push(`File exceeds maximum size limit. Maximum: ${this.formatFileSize(this.config.maxFileSize)}, actual: ${this.formatFileSize(file.size)}`);
      return;
    }
  }

  /**
   * Validate file content (magic number validation)
   */
  async validateContent(file, result) {
    if (!file.path || !fs.existsSync(file.path)) {
      result.warnings.push('File content validation skipped - file not accessible');
      return;
    }

    try {
      const mimeType = file.mimetype || file.type;
      const typeConfig = this.config.supportedTypes[mimeType];
      
      if (!typeConfig || typeConfig.magicNumbers.length === 0) {
        return; // No magic number validation for this type
      }

      // Read first 20 bytes for magic number validation
      const buffer = Buffer.alloc(20);
      const fd = fs.openSync(file.path, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, 20, 0);
      fs.closeSync(fd);

      if (bytesRead === 0) {
        result.isValid = false;
        result.errors.push('File appears to be empty or unreadable');
        return;
      }

      const fileHeader = buffer.slice(0, bytesRead).toString();
      
      // Check if file header matches expected magic numbers
      const hasValidMagicNumber = typeConfig.magicNumbers.some(magic => 
        fileHeader.startsWith(magic)
      );

      if (!hasValidMagicNumber) {
        result.isValid = false;
        result.errors.push(`File content doesn't match expected format for ${typeConfig.description}`);
        return;
      }

    } catch (error) {
      console.error('Content validation error:', error.message);
      result.warnings.push('File content validation failed - file may be corrupted');
    }
  }

  /**
   * Check for duplicate files
   */
  async checkDuplicates(file, userId, result) {
    try {
      if (!file.path || !fs.existsSync(file.path)) {
        return; // Can't check duplicates without file content
      }

      const fileHash = await this.generateFileHash(file.path);
      const duplicateKey = `${userId}:${fileHash}`;

      // Check cache for duplicates
      if (this.duplicateCache.has(duplicateKey)) {
        const cachedInfo = this.duplicateCache.get(duplicateKey);
        if (Date.now() - cachedInfo.timestamp < this.cacheTimeout) {
          result.warnings.push(`File appears to be a duplicate of '${cachedInfo.filename}' uploaded previously`);
          result.fileInfo.isDuplicate = true;
          result.fileInfo.duplicateOf = cachedInfo.filename;
          return;
        } else {
          // Remove expired cache entry
          this.duplicateCache.delete(duplicateKey);
        }
      }

      // Add to cache
      this.duplicateCache.set(duplicateKey, {
        filename: file.originalname || file.name,
        timestamp: Date.now()
      });

      result.fileInfo.hash = fileHash;

    } catch (error) {
      console.error('Duplicate check error:', error.message);
      result.warnings.push('Duplicate detection failed');
    }
  }

  /**
   * Detect duplicates within a batch
   */
  async detectBatchDuplicates(validFiles, result) {
    const hashMap = new Map();
    
    for (const fileResult of validFiles) {
      if (fileResult.fileInfo.hash) {
        if (hashMap.has(fileResult.fileInfo.hash)) {
          const duplicate = hashMap.get(fileResult.fileInfo.hash);
          fileResult.warnings.push(`Duplicate of '${duplicate.originalName}' in the same batch`);
          result.batchInfo.duplicateCount++;
        } else {
          hashMap.set(fileResult.fileInfo.hash, fileResult.fileInfo);
        }
      }
    }
  }

  /**
   * Generate file hash for duplicate detection
   */
  async generateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get description of supported file types
   */
  getSupportedTypesDescription() {
    return Object.values(this.config.supportedTypes)
      .map(type => type.description)
      .join(', ');
  }

  /**
   * Get validation service status and configuration
   */
  getStatus() {
    return {
      maxFileSize: this.formatFileSize(this.config.maxFileSize),
      maxBatchSize: this.config.maxBatchSize,
      maxTotalBatchSize: this.formatFileSize(this.config.maxTotalBatchSize),
      supportedTypes: Object.keys(this.config.supportedTypes),
      cacheSize: this.duplicateCache.size,
      dangerousExtensions: this.config.dangerousExtensions.length
    };
  }

  /**
   * Clear duplicate cache (for maintenance)
   */
  clearCache() {
    this.duplicateCache.clear();
    console.log('✅ File validation cache cleared');
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.duplicateCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.duplicateCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`✅ Cleaned ${cleaned} expired cache entries`);
    }
  }
}

module.exports = new FileValidationService();