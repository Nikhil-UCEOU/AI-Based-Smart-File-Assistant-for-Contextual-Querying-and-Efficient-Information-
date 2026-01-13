const database = require('../config/database');

class Document {
  constructor(documentData) {
    this.id = documentData.id;
    this.userId = documentData.user_id;
    this.pineconeId = documentData.pinecone_id;
    this.fileName = documentData.file_name;
    this.originalName = documentData.original_name;
    this.fileType = documentData.file_type;
    this.fileSize = documentData.file_size;
    this.filePath = documentData.file_path;
    this.extractedText = documentData.extracted_text;
    this.vectorId = documentData.vector_id;
    this.uploadStatus = documentData.upload_status;
    this.createdAt = documentData.created_at;
    this.updatedAt = documentData.updated_at;
    // Enhanced tracking fields
    this.chunkCount = documentData.chunk_count || 0;
    this.processingTime = documentData.processing_time || 0;
    this.embeddingModel = documentData.embedding_model || 'all-MiniLM-L6-v2';
    this.chunkSize = documentData.chunk_size || 2000;
    this.chunkOverlap = documentData.chunk_overlap || 200;
  }

  static async create(documentData) {
    const db = database.getDb();
    const {
      userId,
      pineconeId,
      fileName,
      originalName,
      fileType,
      fileSize,
      filePath,
      extractedText,
      vectorId,
      uploadStatus = 'processing',
      chunkCount = 0,
      processingTime = 0,
      embeddingModel = 'all-MiniLM-L6-v2',
      chunkSize = 2000,
      chunkOverlap = 200
    } = documentData;

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO documents (
          user_id, pinecone_id, file_name, original_name, file_type, 
          file_size, file_path, extracted_text, vector_id, upload_status,
          chunk_count, processing_time, embedding_model, chunk_size, chunk_overlap
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        userId,
        pineconeId,
        fileName,
        originalName,
        fileType,
        fileSize,
        filePath,
        extractedText,
        vectorId,
        uploadStatus,
        chunkCount,
        processingTime,
        embeddingModel,
        chunkSize,
        chunkOverlap
      ];

      db.run(query, values, function(err) {
        if (err) {
          console.error('Document creation error:', err);
          reject(err);
        } else {
          // Fetch the created document
          Document.findById(this.lastID)
            .then(document => resolve(document))
            .catch(reject);
        }
      });
    });
  }

  static async findById(id) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM documents WHERE id = ?';
      
      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new Document(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  static async findByUserId(userId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC';
      
      db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const documents = rows.map(row => new Document(row));
          resolve(documents);
        }
      });
    });
  }

  static async findByPineconeId(pineconeId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM documents WHERE pinecone_id = ? ORDER BY created_at DESC';
      
      db.all(query, [pineconeId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const documents = rows.map(row => new Document(row));
          resolve(documents);
        }
      });
    });
  }

  async updateStatus(status) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'UPDATE documents SET upload_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      
      db.run(query, [status, this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async delete() {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM documents WHERE id = ?';
      
      db.run(query, [this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Enhanced user data cleanup methods
  static async deleteAllUserDocuments(userId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM documents WHERE user_id = ?';
      
      db.run(query, [userId], function(err) {
        if (err) {
          console.error(`❌ Failed to delete documents for user ${userId}:`, err);
          reject(err);
        } else {
          console.log(`✅ Deleted ${this.changes} documents for user ${userId}`);
          resolve({
            deletedCount: this.changes,
            success: true
          });
        }
      });
    });
  }

  static async deleteAllUserDocumentsByPineconeId(pineconeId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM documents WHERE pinecone_id = ?';
      
      db.run(query, [pineconeId], function(err) {
        if (err) {
          console.error(`❌ Failed to delete documents for Pinecone ID ${pineconeId}:`, err);
          reject(err);
        } else {
          console.log(`✅ Deleted ${this.changes} documents for Pinecone ID ${pineconeId}`);
          resolve({
            deletedCount: this.changes,
            success: true
          });
        }
      });
    });
  }

  static async getUserDocumentCount(userId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT COUNT(*) as count FROM documents WHERE user_id = ?';
      
      db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count || 0);
        }
      });
    });
  }

  static async getUserDocumentCountByPineconeId(pineconeId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT COUNT(*) as count FROM documents WHERE pinecone_id = ?';
      
      db.get(query, [pineconeId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count || 0);
        }
      });
    });
  }

  // Method to verify user-document mapping consistency
  static async verifyUserDocumentMapping(userId, pineconeId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_documents,
          COUNT(CASE WHEN pinecone_id = ? THEN 1 END) as matching_pinecone_documents,
          COUNT(CASE WHEN pinecone_id != ? OR pinecone_id IS NULL THEN 1 END) as mismatched_documents
        FROM documents 
        WHERE user_id = ?
      `;
      
      db.get(query, [pineconeId, pineconeId, userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          const result = {
            userId: userId,
            pineconeId: pineconeId,
            totalDocuments: row.total_documents || 0,
            matchingDocuments: row.matching_pinecone_documents || 0,
            mismatchedDocuments: row.mismatched_documents || 0,
            isConsistent: (row.mismatched_documents || 0) === 0
          };
          
          resolve(result);
        }
      });
    });
  }

  // Enhanced tracking methods for processing pipeline
  async updateChunkCount(chunkCount) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'UPDATE documents SET chunk_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      
      db.run(query, [chunkCount, this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async updateProcessingTime(processingTime) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'UPDATE documents SET processing_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      
      db.run(query, [processingTime, this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async updateProcessingStatus(status, chunkCount = null, processingTime = null) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      let query = 'UPDATE documents SET upload_status = ?, updated_at = CURRENT_TIMESTAMP';
      let values = [status];
      
      if (chunkCount !== null) {
        query += ', chunk_count = ?';
        values.push(chunkCount);
      }
      
      if (processingTime !== null) {
        query += ', processing_time = ?';
        values.push(processingTime);
      }
      
      query += ' WHERE id = ?';
      values.push(this.id);
      
      db.run(query, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async updateEmbeddingModel(embeddingModel) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'UPDATE documents SET embedding_model = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      
      db.run(query, [embeddingModel, this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async updateChunkingConfig(chunkSize, chunkOverlap) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'UPDATE documents SET chunk_size = ?, chunk_overlap = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      
      db.run(query, [chunkSize, chunkOverlap, this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Get processing metrics for this document
  getProcessingMetrics() {
    return {
      chunkCount: this.chunkCount,
      processingTime: this.processingTime,
      embeddingModel: this.embeddingModel,
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      processingRate: this.processingTime > 0 ? (this.chunkCount / (this.processingTime / 1000)).toFixed(2) : 0 // chunks per second
    };
  }

  // Static method to get processing statistics for a user
  static async getUserProcessingStatistics(userId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_documents,
          SUM(chunk_count) as total_chunks,
          AVG(chunk_count) as avg_chunks_per_document,
          SUM(processing_time) as total_processing_time,
          AVG(processing_time) as avg_processing_time,
          COUNT(DISTINCT embedding_model) as unique_embedding_models,
          AVG(chunk_size) as avg_chunk_size,
          AVG(chunk_overlap) as avg_chunk_overlap
        FROM documents 
        WHERE user_id = ? AND upload_status = 'completed'
      `;
      
      db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            userId: userId,
            totalDocuments: row.total_documents || 0,
            totalChunks: row.total_chunks || 0,
            avgChunksPerDocument: parseFloat((row.avg_chunks_per_document || 0).toFixed(2)),
            totalProcessingTime: row.total_processing_time || 0,
            avgProcessingTime: parseFloat((row.avg_processing_time || 0).toFixed(2)),
            uniqueEmbeddingModels: row.unique_embedding_models || 0,
            avgChunkSize: parseFloat((row.avg_chunk_size || 0).toFixed(0)),
            avgChunkOverlap: parseFloat((row.avg_chunk_overlap || 0).toFixed(0)),
            lastUpdated: new Date().toISOString()
          });
        }
      });
    });
  }

  // Method to fix user-document mapping inconsistencies
  static async fixUserDocumentMapping(userId, correctPineconeId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE documents 
        SET pinecone_id = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ? AND (pinecone_id != ? OR pinecone_id IS NULL)
      `;
      
      db.run(query, [correctPineconeId, userId, correctPineconeId], function(err) {
        if (err) {
          console.error(`❌ Failed to fix document mapping for user ${userId}:`, err);
          reject(err);
        } else {
          console.log(`✅ Fixed ${this.changes} document mappings for user ${userId}`);
          resolve({
            fixedCount: this.changes,
            success: true
          });
        }
      });
    });
  }

  // Method to get cleanup statistics for a user
  static async getUserCleanupStatistics(userId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_documents,
          COUNT(DISTINCT pinecone_id) as unique_pinecone_ids,
          MIN(created_at) as oldest_document,
          MAX(created_at) as newest_document,
          SUM(file_size) as total_file_size
        FROM documents 
        WHERE user_id = ?
      `;
      
      db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            userId: userId,
            totalDocuments: row.total_documents || 0,
            uniquePineconeIds: row.unique_pinecone_ids || 0,
            oldestDocument: row.oldest_document,
            newestDocument: row.newest_document,
            totalFileSize: row.total_file_size || 0,
            lastUpdated: new Date().toISOString()
          });
        }
      });
    });
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      pineconeId: this.pineconeId,
      fileName: this.fileName,
      originalName: this.originalName,
      fileType: this.fileType,
      fileSize: this.fileSize,
      filePath: this.filePath,
      extractedText: this.extractedText ? this.extractedText.substring(0, 500) + '...' : null, // Truncate for JSON
      vectorId: this.vectorId,
      uploadStatus: this.uploadStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // Enhanced tracking fields
      chunkCount: this.chunkCount,
      processingTime: this.processingTime,
      embeddingModel: this.embeddingModel,
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      processingMetrics: this.getProcessingMetrics()
    };
  }
}

module.exports = Document;