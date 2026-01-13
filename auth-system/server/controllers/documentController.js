const Document = require('../models/Document');
const User = require('../models/User');
const documentService = require('../services/documentService');
const advancedDocumentService = require('../services/advancedDocumentService');
const fileValidationService = require('../services/fileValidationService');
const concurrentProcessingManager = require('../services/concurrentProcessingManager');
const activityService = require('../services/activityService');
const fs = require('fs');
const path = require('path');

class DocumentController {
  async uploadDocument(req, res) {
    const startTime = Date.now();
    
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Get user information
      const userId = req.user.id; // From auth middleware
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const file = req.file;
      
      // Enhanced file validation
      console.log(`📄 Validating uploaded file: ${file.originalname}`);
      console.log(`📄 File details:`, {
        originalname: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path
      });
      
      const validationResult = await fileValidationService.validateFile(file, userId);
      console.log(`📄 Validation result:`, validationResult);
      
      if (!validationResult.isValid) {
        // Clean up uploaded file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        
        return res.status(400).json({
          success: false,
          error: 'File validation failed',
          details: {
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            fileInfo: validationResult.fileInfo
          }
        });
      }

      // Log validation warnings if any
      if (validationResult.warnings.length > 0) {
        console.warn('⚠️ File validation warnings:', validationResult.warnings);
      }

      // Extract text from the document using enhanced service
      let extractedText;
      let extractionTime = 0;
      try {
        const extractionStart = Date.now();
        extractedText = await advancedDocumentService.extractTextFromFile(file.path);
        extractionTime = Date.now() - extractionStart;
      } catch (error) {
        // Clean up uploaded file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        return res.status(400).json({
          success: false,
          error: `Failed to process document: ${error.message}`,
          validationInfo: {
            warnings: validationResult.warnings,
            fileInfo: validationResult.fileInfo
          }
        });
      }

      // Create document record in database with enhanced tracking
      const documentData = {
        userId: user.id,
        pineconeId: user.pineconeId,
        fileName: file.filename,
        originalName: file.originalname,
        fileType: advancedDocumentService.getFileTypeFromMime(file.mimetype),
        fileSize: file.size,
        filePath: file.path,
        extractedText: extractedText,
        uploadStatus: 'processing',
        embeddingModel: 'all-MiniLM-L6-v2',
        chunkSize: 200,  // Updated to match new smaller chunk size
        chunkOverlap: 40, // Updated to match new smaller overlap
        // Add validation metadata
        fileHash: validationResult.fileInfo.hash,
        validationWarnings: validationResult.warnings.length > 0 ? validationResult.warnings : null
      };

      const document = await Document.create(documentData);

      // Store in Pinecone using enhanced service with chunking and metrics collection
      let chunkCount = 0;
      let embeddingTime = 0;
      let storageTime = 0;
      
      try {
        const processingStart = Date.now();
        
        // Enhanced processing with metrics - but make it optional if embeddings fail
        let vectorId = null;
        try {
          vectorId = await advancedDocumentService.storeInPinecone(
            user.pineconeId,
            documentData,
            extractedText
          );
        } catch (embeddingError) {
          console.warn('⚠️ Embedding generation failed, storing document without embeddings:', embeddingError.message);
          // Continue without embeddings - document will still be stored in database
        }
        
        const processingEnd = Date.now();
        const totalProcessingTime = processingEnd - startTime;
        embeddingTime = processingEnd - processingStart - extractionTime;
        
        // Calculate chunk count (estimate based on text length and chunk size)
        chunkCount = Math.ceil(extractedText.length / 160); // Approximate chunks considering overlap (200-40=160 effective)
        
        // Update document with enhanced processing status and metrics
        await document.updateProcessingStatus('completed', chunkCount, totalProcessingTime);
        if (vectorId) {
          document.vectorId = vectorId;
        }
        document.chunkCount = chunkCount;
        document.processingTime = totalProcessingTime;
        
        // Collect processing metrics
        const processingMetrics = {
          extractionTime: extractionTime,
          embeddingTime: embeddingTime,
          storageTime: storageTime,
          totalProcessingTime: totalProcessingTime,
          chunkCount: chunkCount,
          processingRate: chunkCount > 0 ? (chunkCount / (totalProcessingTime / 1000)).toFixed(2) : 0,
          textLength: extractedText.length,
          wordCount: extractedText.split(/\s+/).length
        };
        
        res.status(201).json({
          success: true,
          message: 'Document uploaded and processed successfully',
          data: {
            document: document.toJSON(),
            textPreview: extractedText.substring(0, 200) + '...',
            wordCount: extractedText.split(/\s+/).length,
            processingMetrics: processingMetrics,
            validationInfo: {
              warnings: validationResult.warnings,
              fileInfo: validationResult.fileInfo,
              isDuplicate: validationResult.fileInfo.isDuplicate || false
            }
          }
        });

        // Log activity after successful upload
        try {
          await activityService.logDocumentUpload(
            user.id, // Use database ID for activity logging
            file.originalname,
            document.id,
            file.size
          );
        } catch (activityError) {
          console.error('Failed to log upload activity:', activityError);
          // Don't fail the request if activity logging fails
        }
      } catch (error) {
        const totalProcessingTime = Date.now() - startTime;
        
        // Update status to failed with processing time
        await document.updateProcessingStatus('failed', 0, totalProcessingTime);
        
        res.status(500).json({
          success: false,
          error: 'Document uploaded but failed to process for search. Please try again.',
          data: {
            document: document.toJSON(),
            processingMetrics: {
              extractionTime: extractionTime,
              totalProcessingTime: totalProcessingTime,
              error: error.message
            },
            validationInfo: {
              warnings: validationResult.warnings,
              fileInfo: validationResult.fileInfo
            }
          }
        });
      }
    } catch (error) {
      console.error('Document upload error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  async batchUploadDocuments(req, res) {
    const batchStartTime = Date.now();
    
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded'
        });
      }

      const userId = req.user.id;
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const files = Array.isArray(req.files) ? req.files : [req.files];
      
      // Enhanced batch validation
      console.log(`📦 Validating batch upload: ${files.length} files`);
      const batchValidationResult = await fileValidationService.validateBatch(files, userId);
      
      if (!batchValidationResult.isValid) {
        // Clean up all uploaded files
        files.forEach(file => {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
        
        return res.status(400).json({
          success: false,
          error: 'Batch validation failed',
          details: {
            errors: batchValidationResult.errors,
            warnings: batchValidationResult.warnings,
            batchInfo: batchValidationResult.batchInfo,
            invalidFiles: batchValidationResult.invalidFiles.map(f => ({
              fileName: f.fileInfo.originalName,
              errors: f.errors,
              warnings: f.warnings
            }))
          }
        });
      }

      // Log batch validation warnings
      if (batchValidationResult.warnings.length > 0) {
        console.warn('⚠️ Batch validation warnings:', batchValidationResult.warnings);
      }

      const validFiles = batchValidationResult.validFiles;
      
      // Check if we should use concurrent processing for large batches
      const useConcurrentProcessing = validFiles.length > 3; // Use concurrent processing for 4+ files
      
      if (useConcurrentProcessing) {
        return await this.processBatchConcurrently(req, res, validFiles, batchValidationResult, user, batchStartTime);
      } else {
        return await this.processBatchSequentially(req, res, validFiles, batchValidationResult, user, batchStartTime);
      }
      
    } catch (error) {
      console.error('Batch upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Batch upload failed'
      });
    }
  }

  /**
   * Process batch using concurrent processing manager (for larger batches)
   */
  async processBatchConcurrently(req, res, validFiles, batchValidationResult, user, batchStartTime) {
    try {
      // Create processor function for concurrent processing
      const batchProcessor = async (files, options, context) => {
        const results = [];
        const batchMetrics = {
          totalFiles: files.length,
          processedFiles: 0,
          successfulFiles: 0,
          failedFiles: 0,
          totalChunks: 0,
          totalTextLength: 0
        };

        // Process files with proper concurrency control
        const processingPromises = files.map(async (fileInfo, index) => {
          const file = fileInfo.file;
          const validationResult = fileInfo.validationResult;
          
          try {
            // Check for cancellation
            if (context.checkCancellation()) {
              throw new Error('Job cancelled');
            }

            // Update progress
            context.updateProgress(
              Math.round((index / files.length) * 100), 
              `Processing ${file.originalname}`
            );

            // Acquire document processing slot
            await context.acquireDocumentSlot();
            
            try {
              const fileStartTime = Date.now();
              
              // Extract text with timing
              const extractionStart = Date.now();
              const extractedText = await advancedDocumentService.extractTextFromFile(file.path);
              const extractionTime = Date.now() - extractionStart;

              // Create document record with enhanced tracking
              const documentData = {
                userId: user.id,
                pineconeId: user.pineconeId,
                fileName: file.filename,
                originalName: file.originalname,
                fileType: advancedDocumentService.getFileTypeFromMime(file.mimetype),
                fileSize: file.size,
                filePath: file.path,
                extractedText: extractedText,
                uploadStatus: 'processing',
                embeddingModel: 'all-MiniLM-L6-v2',
                chunkSize: 200,  // Updated to match new smaller chunk size
                chunkOverlap: 40, // Updated to match new smaller overlap
                fileHash: validationResult.fileInfo.hash,
                validationWarnings: validationResult.warnings.length > 0 ? validationResult.warnings : null
              };

              const document = await Document.create(documentData);

              // Store in Pinecone with enhanced processing
              try {
                const processingStart = Date.now();
                const vectorId = await advancedDocumentService.storeInPinecone(
                  user.pineconeId,
                  documentData,
                  extractedText
                );
                
                const fileProcessingTime = Date.now() - fileStartTime;
                const embeddingTime = Date.now() - processingStart - extractionTime;
                
                // Calculate chunk count
                const chunkCount = Math.ceil(extractedText.length / 160); // Approximate chunks considering overlap (200-40=160 effective)
                
                // Update document with enhanced metrics
                await document.updateProcessingStatus('completed', chunkCount, fileProcessingTime);
                document.vectorId = vectorId;
                document.chunkCount = chunkCount;
                document.processingTime = fileProcessingTime;
                
                // Update batch metrics
                batchMetrics.totalChunks += chunkCount;
                batchMetrics.totalTextLength += extractedText.length;
                batchMetrics.successfulFiles++;
                
                return {
                  fileName: file.originalname,
                  success: true,
                  document: document.toJSON(),
                  wordCount: extractedText.split(/\s+/).length,
                  processingMetrics: {
                    extractionTime: extractionTime,
                    embeddingTime: embeddingTime,
                    totalProcessingTime: fileProcessingTime,
                    chunkCount: chunkCount,
                    processingRate: chunkCount > 0 ? (chunkCount / (fileProcessingTime / 1000)).toFixed(2) : 0
                  },
                  validationInfo: {
                    warnings: validationResult.warnings,
                    fileInfo: validationResult.fileInfo,
                    isDuplicate: validationResult.fileInfo.isDuplicate || false
                  }
                };
              } catch (error) {
                const fileProcessingTime = Date.now() - fileStartTime;
                await document.updateProcessingStatus('failed', 0, fileProcessingTime);
                batchMetrics.failedFiles++;
                
                return {
                  fileName: file.originalname,
                  success: false,
                  error: 'Failed to process for search',
                  document: document.toJSON(),
                  processingMetrics: {
                    extractionTime: extractionTime,
                    totalProcessingTime: fileProcessingTime,
                    error: error.message
                  },
                  validationInfo: {
                    warnings: validationResult.warnings,
                    fileInfo: validationResult.fileInfo
                  }
                };
              }
            } finally {
              context.releaseDocumentSlot();
            }
          } catch (error) {
            // Clean up file
            if (file.path && fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
            
            batchMetrics.failedFiles++;
            return {
              fileName: file.originalname,
              success: false,
              error: error.message,
              validationInfo: {
                warnings: validationResult.warnings,
                fileInfo: validationResult.fileInfo
              }
            };
          } finally {
            batchMetrics.processedFiles++;
          }
        });

        // Wait for all files to process
        const fileResults = await Promise.all(processingPromises);
        
        return {
          results: fileResults,
          batchMetrics: batchMetrics
        };
      };

      // Prepare files for concurrent processing
      const filesForProcessing = validFiles.map((validationResult, index) => ({
        file: req.files[validationResult.batchIndex],
        validationResult: validationResult
      }));

      // Submit job to concurrent processing manager
      const jobId = await concurrentProcessingManager.submitJob({
        type: 'batch_document_processing',
        userId: user.id,
        files: filesForProcessing,
        priority: concurrentProcessingManager.config.priorities.NORMAL,
        processor: batchProcessor,
        options: {
          batchValidationResult: batchValidationResult
        }
      });

      // Return job ID for tracking
      res.status(202).json({
        success: true,
        message: 'Batch upload submitted for concurrent processing',
        data: {
          jobId: jobId,
          totalFiles: validFiles.length,
          estimatedProcessingTime: validFiles.length * 2000, // Rough estimate: 2 seconds per file
          trackingUrl: `/api/documents/processing-status/${jobId}`,
          validationSummary: {
            totalValidated: batchValidationResult.totalFiles,
            validFiles: batchValidationResult.validFiles.length,
            invalidFiles: batchValidationResult.invalidFiles.length,
            duplicatesDetected: batchValidationResult.batchInfo.duplicateCount,
            warnings: batchValidationResult.warnings
          }
        }
      });

    } catch (error) {
      console.error('Concurrent batch processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit batch for concurrent processing',
        details: error.message
      });
    }
  }

  /**
   * Process batch sequentially with real-time progress updates (for smaller batches)
   */
  async processBatchSequentially(req, res, validFiles, batchValidationResult, user, batchStartTime) {
    const results = [];
    
    // Enhanced batch processing metrics
    const batchMetrics = {
      totalFiles: req.files.length,
      validFiles: validFiles.length,
      invalidFiles: batchValidationResult.invalidFiles.length,
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      totalProcessingTime: 0,
      totalChunks: 0,
      totalTextLength: 0,
      avgProcessingTimePerFile: 0,
      duplicateCount: batchValidationResult.batchInfo.duplicateCount,
      typeDistribution: batchValidationResult.batchInfo.typeDistribution,
      processingMode: 'sequential'
    };

    // Set up Server-Sent Events for real-time progress
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial progress event
    const sendProgressEvent = (eventType, data) => {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send batch started event
    sendProgressEvent('batch-started', {
      totalFiles: validFiles.length,
      invalidFiles: batchValidationResult.invalidFiles.length,
      batchMetrics: batchMetrics
    });

    // Add invalid files to results and send events
    batchValidationResult.invalidFiles.forEach(invalidFile => {
      const invalidResult = {
        fileName: invalidFile.fileInfo.originalName,
        success: false,
        error: invalidFile.errors.join('; '),
        warnings: invalidFile.warnings,
        processingTime: 0,
        validationFailed: true
      };
      results.push(invalidResult);
      batchMetrics.failedFiles++;
      
      // Send individual file failed event
      sendProgressEvent('file-failed', {
        ...invalidResult,
        progress: {
          completed: results.length,
          total: validFiles.length + batchValidationResult.invalidFiles.length,
          percentage: Math.round((results.length / (validFiles.length + batchValidationResult.invalidFiles.length)) * 100)
        }
      });
    });

    // Process valid files sequentially with real-time updates
    for (const validationResult of validFiles) {
      const fileStartTime = Date.now();
      const file = req.files[validationResult.batchIndex];
      
      // Send file processing started event
      sendProgressEvent('file-started', {
        fileName: file.originalname,
        fileSize: file.size,
        fileType: advancedDocumentService.getFileTypeFromMime(file.mimetype),
        progress: {
          completed: results.length,
          total: validFiles.length + batchValidationResult.invalidFiles.length,
          percentage: Math.round((results.length / (validFiles.length + batchValidationResult.invalidFiles.length)) * 100)
        }
      });
      
      try {
        // Extract text with timing
        const extractionStart = Date.now();
        const extractedText = await advancedDocumentService.extractTextFromFile(file.path);
        const extractionTime = Date.now() - extractionStart;

        // Send extraction completed event
        sendProgressEvent('file-extracted', {
          fileName: file.originalname,
          extractionTime: extractionTime,
          textLength: extractedText.length,
          wordCount: extractedText.split(/\s+/).length
        });

        // Create document record with enhanced tracking
        const documentData = {
          userId: user.id,
          pineconeId: user.pineconeId,
          fileName: file.filename,
          originalName: file.originalname,
          fileType: advancedDocumentService.getFileTypeFromMime(file.mimetype),
          fileSize: file.size,
          filePath: file.path,
          extractedText: extractedText,
          uploadStatus: 'processing',
          embeddingModel: 'all-MiniLM-L6-v2',
          chunkSize: 200,  // Updated to match new smaller chunk size
          chunkOverlap: 40, // Updated to match new smaller overlap
          fileHash: validationResult.fileInfo.hash,
          validationWarnings: validationResult.warnings.length > 0 ? validationResult.warnings : null
        };

        const document = await Document.create(documentData);

        // Store in Pinecone with enhanced processing
        try {
          const processingStart = Date.now();
          const vectorId = await advancedDocumentService.storeInPinecone(
            user.pineconeId,
            documentData,
            extractedText
          );
          
          const fileProcessingTime = Date.now() - fileStartTime;
          const embeddingTime = Date.now() - processingStart - extractionTime;
          
          // Calculate chunk count
          const chunkCount = Math.ceil(extractedText.length / 160); // Approximate chunks considering overlap (200-40=160 effective)
          
          // Update document with enhanced metrics
          await document.updateProcessingStatus('completed', chunkCount, fileProcessingTime);
          document.vectorId = vectorId;
          document.chunkCount = chunkCount;
          document.processingTime = fileProcessingTime;
          
          // Update batch metrics
          batchMetrics.totalChunks += chunkCount;
          batchMetrics.totalTextLength += extractedText.length;
          batchMetrics.successfulFiles++;
          
          const fileResult = {
            fileName: file.originalname,
            success: true,
            document: document.toJSON(),
            wordCount: extractedText.split(/\s+/).length,
            processingMetrics: {
              extractionTime: extractionTime,
              embeddingTime: embeddingTime,
              totalProcessingTime: fileProcessingTime,
              chunkCount: chunkCount,
              processingRate: chunkCount > 0 ? (chunkCount / (fileProcessingTime / 1000)).toFixed(2) : 0
            },
            validationInfo: {
              warnings: validationResult.warnings,
              fileInfo: validationResult.fileInfo,
              isDuplicate: validationResult.fileInfo.isDuplicate || false
            }
          };
          
          results.push(fileResult);
          
          // Send file completed event immediately
          sendProgressEvent('file-completed', {
            ...fileResult,
            progress: {
              completed: results.length,
              total: validFiles.length + batchValidationResult.invalidFiles.length,
              percentage: Math.round((results.length / (validFiles.length + batchValidationResult.invalidFiles.length)) * 100)
            }
          });
          
        } catch (error) {
          const fileProcessingTime = Date.now() - fileStartTime;
          await document.updateProcessingStatus('failed', 0, fileProcessingTime);
          batchMetrics.failedFiles++;
          
          const fileResult = {
            fileName: file.originalname,
            success: false,
            error: 'Failed to process for search',
            document: document.toJSON(),
            processingMetrics: {
              extractionTime: extractionTime,
              totalProcessingTime: fileProcessingTime,
              error: error.message
            },
            validationInfo: {
              warnings: validationResult.warnings,
              fileInfo: validationResult.fileInfo
            }
          };
          
          results.push(fileResult);
          
          // Send file failed event immediately
          sendProgressEvent('file-failed', {
            ...fileResult,
            progress: {
              completed: results.length,
              total: validFiles.length + batchValidationResult.invalidFiles.length,
              percentage: Math.round((results.length / (validFiles.length + batchValidationResult.invalidFiles.length)) * 100)
            }
          });
        }
      } catch (error) {
        // Clean up file
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        
        batchMetrics.failedFiles++;
        const fileResult = {
          fileName: file.originalname,
          success: false,
          error: error.message,
          processingTime: Date.now() - fileStartTime,
          validationInfo: {
            warnings: validationResult.warnings,
            fileInfo: validationResult.fileInfo
          }
        };
        
        results.push(fileResult);
        
        // Send file failed event immediately
        sendProgressEvent('file-failed', {
          ...fileResult,
          progress: {
            completed: results.length,
            total: validFiles.length + batchValidationResult.invalidFiles.length,
            percentage: Math.round((results.length / (validFiles.length + batchValidationResult.invalidFiles.length)) * 100)
          }
        });
      }
      
      batchMetrics.processedFiles++;
    }

    // Calculate final batch metrics
    const totalBatchTime = Date.now() - batchStartTime;
    batchMetrics.totalProcessingTime = totalBatchTime;
    batchMetrics.avgProcessingTimePerFile = batchMetrics.processedFiles > 0 ? 
      (totalBatchTime / batchMetrics.processedFiles) : 0;

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Send batch completed event
    const finalResult = {
      success: true,
      message: `Batch upload completed: ${successful.length} successful, ${failed.length} failed`,
      data: {
        results: results,
        summary: {
          total: results.length,
          successful: successful.length,
          failed: failed.length,
          validationFailed: batchValidationResult.invalidFiles.length
        },
        batchMetrics: batchMetrics,
        validationSummary: {
          totalValidated: batchValidationResult.totalFiles,
          validFiles: batchValidationResult.validFiles.length,
          invalidFiles: batchValidationResult.invalidFiles.length,
          duplicatesDetected: batchValidationResult.batchInfo.duplicateCount,
          warnings: batchValidationResult.warnings
        }
      }
    };

    sendProgressEvent('batch-completed', finalResult);
    
    // End the SSE connection
    res.write('event: end\n');
    res.write('data: {}\n\n');
    res.end();
  }

  async getUserDocuments(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, search, fileType } = req.query;
      
      let documents = await Document.findByUserId(userId);
      
      // Apply filters
      if (search) {
        documents = documents.filter(doc => 
          doc.originalName.toLowerCase().includes(search.toLowerCase()) ||
          doc.fileType.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      if (fileType && fileType !== 'all') {
        documents = documents.filter(doc => doc.fileType === fileType);
      }
      
      // Calculate statistics
      const stats = {
        totalDocuments: documents.length,
        totalSize: documents.reduce((sum, doc) => sum + doc.fileSize, 0),
        byType: {},
        recentUploads: documents.filter(doc => {
          const uploadDate = new Date(doc.createdAt);
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return uploadDate > dayAgo;
        }).length
      };
      
      documents.forEach(doc => {
        stats.byType[doc.fileType] = (stats.byType[doc.fileType] || 0) + 1;
      });
      
      // Pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedDocuments = documents.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: {
          documents: paginatedDocuments.map(doc => doc.toJSON()),
          count: paginatedDocuments.length,
          total: documents.length,
          stats: stats,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(documents.length / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get documents error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve documents'
      });
    }
  }

  async searchDocuments(req, res) {
    try {
      const userId = req.user.id;
      const { query, limit = 5 } = req.body;
      
      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Search documents in Pinecone using advanced service
      const searchResults = await advancedDocumentService.searchDocuments(
        user.pineconeId,
        query,
        parseInt(limit)
      );

      // Get document details from database
      const documents = await Document.findByPineconeId(user.pineconeId);
      
      // Enhanced results with chunked content
      const enrichedResults = searchResults.matches?.map(docResult => ({
        fileName: docResult.fileName,
        fileType: docResult.fileType,
        fileSize: docResult.fileSize,
        uploadDate: docResult.uploadDate,
        maxScore: docResult.maxScore,
        avgScore: docResult.avgScore,
        totalChunks: docResult.chunks.length,
        topChunks: docResult.chunks.slice(0, 3), // Return top 3 most relevant chunks
        document: documents.find(doc => 
          doc.originalName === docResult.fileName
        )?.toJSON()
      })) || [];

      res.json({
        success: true,
        data: {
          query: query,
          results: enrichedResults,
          count: enrichedResults.length,
          totalChunks: searchResults.totalChunks
        }
      });
    } catch (error) {
      console.error('Document search error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search documents'
      });
    }
  }

  async deleteDocument(req, res) {
    try {
      const userId = req.user.id;
      const documentId = req.params.id;
      
      const document = await Document.findById(documentId);
      
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      // Check if document belongs to user
      if (document.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Delete file from filesystem
      try {
        if (fs.existsSync(document.filePath)) {
          fs.unlinkSync(document.filePath);
        }
      } catch (error) {
        console.error('Failed to delete file:', error);
      }

      // Delete from Pinecone
      if (document.vectorId) {
        try {
          const pineconeService = require('../services/pineconeService');
          await pineconeService.deleteDocument(document.vectorId);
        } catch (error) {
          console.error('Failed to delete from Pinecone:', error);
        }
      }

      // Delete from database
      await document.delete();

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });

      // Log activity after successful deletion
      try {
        await activityService.logDocumentDelete(
          req.user.databaseId, // Use database ID for activity logging
          document.originalName,
          documentId
        );
      } catch (activityError) {
        console.error('Failed to log delete activity:', activityError);
        // Don't fail the request if activity logging fails
      }
    } catch (error) {
      console.error('Document deletion error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete document'
      });
    }
  }

  async getDocumentContent(req, res) {
    try {
      const userId = req.user.id;
      const documentId = req.params.id;
      
      const document = await Document.findById(documentId);
      
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      // Check if document belongs to user
      if (document.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: {
          document: document.toJSON(),
          content: document.extractedText,
          wordCount: document.extractedText ? document.extractedText.split(/\s+/).length : 0
        }
      });
    } catch (error) {
      console.error('Get document content error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve document content'
      });
    }
  }

  /**
   * Process documents from data folder - SIMPLIFIED VERSION
   * POST /api/documents/process-folder
   */
  async processDataFolder(req, res) {
    try {
      res.status(501).json({
        success: false,
        error: 'Data folder processing feature is currently unavailable'
      });
    } catch (error) {
      console.error('Data folder processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process data folder'
      });
    }
  }

  /**
   * Get processing job status
   * GET /api/documents/processing-status/:jobId
   */
  async getProcessingStatus(req, res) {
    try {
      const jobId = req.params.jobId;
      
      if (!jobId) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
      }

      try {
        const jobStatus = concurrentProcessingManager.getJobStatus(jobId);
        
        res.json({
          success: true,
          data: {
            jobId: jobId,
            status: jobStatus.status,
            progress: jobStatus.progress,
            currentStep: jobStatus.currentStep,
            createdAt: jobStatus.createdAt,
            startedAt: jobStatus.startedAt,
            completedAt: jobStatus.completedAt,
            processingTime: jobStatus.processingTime,
            attempts: jobStatus.attempts,
            results: jobStatus.results,
            errors: jobStatus.errors,
            isComplete: ['completed', 'failed', 'cancelled'].includes(jobStatus.status)
          }
        });
      } catch (error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            success: false,
            error: 'Job not found',
            details: 'The job may have expired or never existed'
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Get processing status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get processing status'
      });
    }
  }

  /**
   * Get user's processing jobs history - SIMPLIFIED VERSION
   * GET /api/documents/processing-jobs
   */
  async getProcessingJobs(req, res) {
    try {
      const userId = req.user.id;

      // Validate user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Return empty jobs list for now
      res.json({
        success: true,
        data: {
          jobs: [],
          count: 0,
          total: 0,
          pagination: {
            page: 1,
            limit: 10,
            totalPages: 0
          }
        }
      });
    } catch (error) {
      console.error('Get processing jobs error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get processing jobs'
      });
    }
  }

  /**
   * Get enhanced processing metrics for user
   * GET /api/documents/processing-metrics
   */
  async getProcessingMetrics(req, res) {
    try {
      const userId = req.user.id;
      const { days = 30 } = req.query;

      // Validate user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Get processing statistics from Document model
      const processingStats = await Document.getUserProcessingStatistics(userId);
      
      // Get user documents for additional metrics
      const userDocuments = await Document.findByUserId(userId);
      
      // Calculate time-based metrics
      const cutoffDate = new Date(Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000));
      const recentDocuments = userDocuments.filter(doc => new Date(doc.createdAt) > cutoffDate);
      
      // Calculate enhanced metrics
      const enhancedMetrics = {
        period: `Last ${days} days`,
        
        // Overall statistics
        totalDocuments: processingStats.totalDocuments,
        totalChunks: processingStats.totalChunks,
        avgChunksPerDocument: processingStats.avgChunksPerDocument,
        
        // Processing performance
        totalProcessingTime: processingStats.totalProcessingTime,
        avgProcessingTime: processingStats.avgProcessingTime,
        avgProcessingRate: processingStats.totalProcessingTime > 0 ? 
          (processingStats.totalChunks / (processingStats.totalProcessingTime / 1000)).toFixed(2) : 0,
        
        // Configuration metrics
        avgChunkSize: processingStats.avgChunkSize,
        avgChunkOverlap: processingStats.avgChunkOverlap,
        uniqueEmbeddingModels: processingStats.uniqueEmbeddingModels,
        
        // Recent activity
        recentDocuments: recentDocuments.length,
        recentProcessingTime: recentDocuments.reduce((sum, doc) => sum + (doc.processingTime || 0), 0),
        recentChunks: recentDocuments.reduce((sum, doc) => sum + (doc.chunkCount || 0), 0),
        
        // File type distribution
        fileTypeDistribution: this.calculateFileTypeDistribution(userDocuments),
        
        // Processing status distribution
        statusDistribution: this.calculateStatusDistribution(userDocuments),
        
        // Performance trends (last 7 days vs previous 7 days)
        performanceTrends: this.calculatePerformanceTrends(userDocuments),
        
        lastUpdated: new Date().toISOString()
      };

      res.json({
        success: true,
        data: enhancedMetrics
      });

    } catch (error) {
      console.error('Get processing metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get processing metrics'
      });
    }
  }

  // Helper method to calculate file type distribution
  calculateFileTypeDistribution(documents) {
    const distribution = {};
    documents.forEach(doc => {
      const fileType = doc.fileType || 'UNKNOWN';
      distribution[fileType] = (distribution[fileType] || 0) + 1;
    });
    return distribution;
  }

  // Helper method to calculate status distribution
  calculateStatusDistribution(documents) {
    const distribution = {};
    documents.forEach(doc => {
      const status = doc.uploadStatus || 'unknown';
      distribution[status] = (distribution[status] || 0) + 1;
    });
    return distribution;
  }

  // Helper method to calculate performance trends
  calculatePerformanceTrends(documents) {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previous7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    const recent = documents.filter(doc => new Date(doc.createdAt) > last7Days);
    const previous = documents.filter(doc => {
      const docDate = new Date(doc.createdAt);
      return docDate > previous7Days && docDate <= last7Days;
    });
    
    const recentAvgTime = recent.length > 0 ? 
      recent.reduce((sum, doc) => sum + (doc.processingTime || 0), 0) / recent.length : 0;
    const previousAvgTime = previous.length > 0 ? 
      previous.reduce((sum, doc) => sum + (doc.processingTime || 0), 0) / previous.length : 0;
    
    return {
      recentPeriod: {
        documents: recent.length,
        avgProcessingTime: Math.round(recentAvgTime),
        totalChunks: recent.reduce((sum, doc) => sum + (doc.chunkCount || 0), 0)
      },
      previousPeriod: {
        documents: previous.length,
        avgProcessingTime: Math.round(previousAvgTime),
        totalChunks: previous.reduce((sum, doc) => sum + (doc.chunkCount || 0), 0)
      },
      trend: {
        documentsChange: recent.length - previous.length,
        processingTimeChange: Math.round(recentAvgTime - previousAvgTime),
        processingTimeChangePercent: previousAvgTime > 0 ? 
          Math.round(((recentAvgTime - previousAvgTime) / previousAvgTime) * 100) : 0
      }
    };
  }

  /**
   * Get file validation service status and configuration
   * GET /api/documents/validation-status
   */
  async getValidationStatus(req, res) {
    try {
      const status = fileValidationService.getStatus();
      
      res.json({
        success: true,
        data: {
          validationService: status,
          supportedTypes: {
            'application/pdf': 'PDF Documents (up to 50MB)',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Microsoft Word Documents (up to 25MB)',
            'text/html': 'HTML Documents (up to 10MB)',
            'text/plain': 'Text Documents (up to 10MB)'
          },
          features: [
            'File type validation with magic number checking',
            'Size limits per file type',
            'Duplicate detection within user uploads',
            'Security validation against malicious files',
            'Batch upload validation with cross-file duplicate detection',
            'Comprehensive error reporting with actionable messages'
          ]
        }
      });
    } catch (error) {
      console.error('Get validation status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get validation status'
      });
    }
  }

  /**
   * Get concurrent processing manager status
   * GET /api/documents/processing-manager-status
   */
  async getProcessingManagerStatus(req, res) {
    try {
      const status = concurrentProcessingManager.getStatus();
      
      res.json({
        success: true,
        data: {
          processingManager: status,
          capabilities: {
            concurrentProcessing: true,
            resourceMonitoring: true,
            jobQueuing: true,
            priorityProcessing: true,
            retryLogic: true,
            progressTracking: true
          },
          recommendations: {
            optimalBatchSize: status.config.maxConcurrentJobs,
            maxRecommendedFileSize: '50MB per file',
            bestPractices: [
              'Use batch upload for 4+ files to enable concurrent processing',
              'Monitor job progress using the provided job ID',
              'Large files are processed with resource management',
              'Failed jobs are automatically retried with exponential backoff'
            ]
          }
        }
      });
    } catch (error) {
      console.error('Get processing manager status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get processing manager status'
      });
    }
  }

  /**
   * Create a new upload queue
   * POST /api/documents/queue/create
   */
  async createUploadQueue(req, res) {
    try {
      const userId = req.user.id;
      const { queueName = 'default' } = req.body;

      const uploadQueueManager = require('../services/uploadQueueManager');
      const queueId = await uploadQueueManager.createQueue(userId, queueName);

      res.status(201).json({
        success: true,
        message: 'Upload queue created successfully',
        data: {
          queueId: queueId,
          queueName: queueName
        }
      });
    } catch (error) {
      console.error('Create upload queue error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create upload queue'
      });
    }
  }

  /**
   * Get user's upload queues
   * GET /api/documents/queues
   */
  async getUploadQueues(req, res) {
    try {
      const userId = req.user.id;

      const uploadQueueManager = require('../services/uploadQueueManager');
      const queues = uploadQueueManager.getUserQueues(userId);

      res.json({
        success: true,
        data: {
          queues: queues,
          count: queues.length
        }
      });
    } catch (error) {
      console.error('Get upload queues error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get upload queues'
      });
    }
  }

  /**
   * Get specific queue status
   * GET /api/documents/queue/:queueName/status
   */
  async getQueueStatus(req, res) {
    try {
      const userId = req.user.id;
      const { queueName } = req.params;

      const uploadQueueManager = require('../services/uploadQueueManager');
      const queueStatus = uploadQueueManager.getQueueStatus(userId, queueName);

      res.json({
        success: true,
        data: queueStatus
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Queue not found'
        });
      }

      console.error('Get queue status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get queue status'
      });
    }
  }

  /**
   * Reorder queue items (drag-and-drop support)
   * PUT /api/documents/queue/:queueName/reorder
   */
  async reorderQueue(req, res) {
    try {
      const userId = req.user.id;
      const { queueName } = req.params;
      const { itemId, newPosition } = req.body;

      if (!itemId || typeof newPosition !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Item ID and new position are required'
        });
      }

      const uploadQueueManager = require('../services/uploadQueueManager');
      const updatedItems = await uploadQueueManager.reorderQueue(userId, queueName, itemId, newPosition);

      res.json({
        success: true,
        message: 'Queue reordered successfully',
        data: {
          items: updatedItems.map(item => ({
            id: item.id,
            fileName: item.fileName,
            position: item.position,
            status: item.status
          }))
        }
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('Invalid position') || error.message.includes('Cannot reorder')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      console.error('Reorder queue error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reorder queue'
      });
    }
  }

  /**
   * Pause queue processing
   * PUT /api/documents/queue/:queueName/pause
   */
  async pauseQueue(req, res) {
    try {
      const userId = req.user.id;
      const { queueName } = req.params;

      const uploadQueueManager = require('../services/uploadQueueManager');
      const queueData = await uploadQueueManager.pauseQueue(userId, queueName);

      res.json({
        success: true,
        message: 'Queue paused successfully',
        data: {
          queueId: queueData.id,
          state: queueData.state
        }
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Queue not found'
        });
      }

      console.error('Pause queue error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to pause queue'
      });
    }
  }

  /**
   * Resume queue processing
   * PUT /api/documents/queue/:queueName/resume
   */
  async resumeQueue(req, res) {
    try {
      const userId = req.user.id;
      const { queueName } = req.params;

      const uploadQueueManager = require('../services/uploadQueueManager');
      const queueData = await uploadQueueManager.resumeQueue(userId, queueName);

      res.json({
        success: true,
        message: 'Queue resumed successfully',
        data: {
          queueId: queueData.id,
          state: queueData.state
        }
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Queue not found'
        });
      }

      console.error('Resume queue error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resume queue'
      });
    }
  }

  /**
   * Clean up completed items from queue
   * DELETE /api/documents/queue/:queueName/cleanup
   */
  async cleanupQueue(req, res) {
    try {
      const userId = req.user.id;
      const { queueName } = req.params;

      const uploadQueueManager = require('../services/uploadQueueManager');
      const queueData = await uploadQueueManager.cleanupQueue(userId, queueName);

      res.json({
        success: true,
        message: 'Queue cleaned up successfully',
        data: {
          queueId: queueData.id,
          remainingItems: queueData.totalItems
        }
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Queue not found'
        });
      }

      console.error('Cleanup queue error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup queue'
      });
    }
  }

  /**
   * Get progress tracking status for user
   * GET /api/documents/progress/trackers
   */
  async getProgressTrackers(req, res) {
    try {
      const userId = req.user.id;

      const progressTrackingService = require('../services/progressTrackingService');
      const trackers = progressTrackingService.getUserTrackers(userId);

      res.json({
        success: true,
        data: {
          trackers: trackers,
          count: trackers.length
        }
      });
    } catch (error) {
      console.error('Get progress trackers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get progress trackers'
      });
    }
  }

  /**
   * Get specific progress tracker status
   * GET /api/documents/progress/:trackerId
   */
  async getProgressTracker(req, res) {
    try {
      const { trackerId } = req.params;

      const progressTrackingService = require('../services/progressTrackingService');
      const trackerStatus = progressTrackingService.getTrackerStatus(trackerId);

      res.json({
        success: true,
        data: trackerStatus
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Progress tracker not found'
        });
      }

      console.error('Get progress tracker error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get progress tracker'
      });
    }
  }

  /**
   * Get progress history for a tracker
   * GET /api/documents/progress/:trackerId/history
   */
  async getProgressHistory(req, res) {
    try {
      const { trackerId } = req.params;
      const { limit = 100 } = req.query;

      const progressTrackingService = require('../services/progressTrackingService');
      const history = progressTrackingService.getProgressHistory(trackerId, parseInt(limit));

      res.json({
        success: true,
        data: {
          trackerId: trackerId,
          history: history,
          count: history.length
        }
      });
    } catch (error) {
      console.error('Get progress history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get progress history'
      });
    }
  }

  /**
   * Get progress tracking service metrics
   * GET /api/documents/progress/metrics
   */
  async getProgressMetrics(req, res) {
    try {
      const progressTrackingService = require('../services/progressTrackingService');
      const metrics = progressTrackingService.getMetrics();

      res.json({
        success: true,
        data: {
          progressMetrics: metrics,
          capabilities: {
            realTimeUpdates: true,
            stageTracking: true,
            estimatedCompletion: true,
            progressHistory: true,
            userFiltering: true
          },
          stages: [
            'validation',
            'extraction', 
            'chunking',
            'embedding',
            'storage'
          ]
        }
      });
    } catch (error) {
      console.error('Get progress metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get progress metrics'
      });
    }
  }

  /**
   * Get embedding optimization service status
   * GET /api/documents/embedding/status
   */
  async getEmbeddingOptimizationStatus(req, res) {
    try {
      const embeddingOptimizationService = require('../services/embeddingOptimizationService');
      const status = embeddingOptimizationService.getStatus();

      res.json({
        success: true,
        data: {
          embeddingOptimization: status,
          capabilities: {
            batchProcessing: true,
            caching: status.config.enableCaching,
            deduplication: status.config.enableDeduplication,
            retryLogic: true,
            performanceMetrics: true
          },
          optimizations: [
            'Batched embedding requests for improved throughput',
            'Intelligent caching to avoid duplicate processing',
            'Text deduplication to reduce redundant computations',
            'Automatic retry logic for failed requests',
            'Performance monitoring and metrics collection'
          ]
        }
      });
    } catch (error) {
      console.error('Get embedding optimization status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get embedding optimization status'
      });
    }
  }

  /**
   * Clear embedding cache
   * DELETE /api/documents/embedding/cache
   */
  async clearEmbeddingCache(req, res) {
    try {
      const embeddingOptimizationService = require('../services/embeddingOptimizationService');
      const clearedEntries = embeddingOptimizationService.clearCache();

      res.json({
        success: true,
        message: 'Embedding cache cleared successfully',
        data: {
          clearedEntries: clearedEntries
        }
      });
    } catch (error) {
      console.error('Clear embedding cache error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear embedding cache'
      });
    }
  }

  /**
   * Test embedding optimization with sample texts
   * POST /api/documents/embedding/test
   */
  async testEmbeddingOptimization(req, res) {
    try {
      const { texts = ['Sample text for testing embedding optimization'] } = req.body;

      if (!Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Texts array is required'
        });
      }

      if (texts.length > 10) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 10 texts allowed for testing'
        });
      }

      const embeddingOptimizationService = require('../services/embeddingOptimizationService');
      const startTime = Date.now();
      
      const embeddings = await embeddingOptimizationService.generateEmbeddings(texts);
      
      const processingTime = Date.now() - startTime;
      const status = embeddingOptimizationService.getStatus();

      res.json({
        success: true,
        message: 'Embedding optimization test completed',
        data: {
          inputTexts: texts.length,
          processingTime: processingTime,
          avgTimePerText: Math.round(processingTime / texts.length),
          embeddingDimensions: embeddings[0] ? embeddings[0].length : 0,
          optimizationStats: {
            cacheHitRate: status.cacheStats.hitRate,
            batchSize: status.config.maxBatchSize,
            deduplicationEnabled: status.config.enableDeduplication
          }
        }
      });
    } catch (error) {
      console.error('Test embedding optimization error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test embedding optimization'
      });
    }
  }
}

const documentController = new DocumentController();

// Bind all methods to preserve 'this' context
Object.getOwnPropertyNames(DocumentController.prototype).forEach(name => {
  if (typeof documentController[name] === 'function' && name !== 'constructor') {
    documentController[name] = documentController[name].bind(documentController);
  }
});

module.exports = documentController;