import { User } from '../types/auth';

const API_BASE = 'http://localhost:3001/api';

export interface Document {
  id: string;
  userId: string;
  pineconeId: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  extractedText?: string;
  vectorId?: string;
  uploadStatus: 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  // Enhanced tracking fields
  chunkCount: number;
  processingTime: number;
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  processingMetrics?: ProcessingMetrics;
}

export interface ProcessingMetrics {
  extractionTime?: number;
  embeddingTime?: number;
  storageTime?: number;
  totalProcessingTime: number;
  chunkCount: number;
  processingRate: string;
  textLength?: number;
  wordCount?: number;
  error?: string;
}

export interface UploadResponse {
  document: Document;
  textPreview: string;
  wordCount: number;
  processingMetrics?: ProcessingMetrics;
}

export interface SearchResult {
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  maxScore: number;
  avgScore: number;
  totalChunks: number;
  topChunks: Array<{
    score: number;
    chunkIndex: number;
    textPreview: string;
    fullText: string;
    wordCount: number;
  }>;
  document?: Document;
}

export interface BatchUploadProgressEvent {
  type: 'batch-started' | 'file-started' | 'file-extracted' | 'file-completed' | 'file-failed' | 'batch-completed' | 'end';
  data: any;
}

export interface BatchUploadResult {
  fileName: string;
  success: boolean;
  error?: string;
  document?: Document;
  wordCount?: number;
  processingTime?: number;
  processingMetrics?: ProcessingMetrics;
}

export interface BatchUploadResponse {
  results: BatchUploadResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
  batchMetrics?: {
    totalFiles: number;
    processedFiles: number;
    successfulFiles: number;
    failedFiles: number;
    totalProcessingTime: number;
    totalChunks: number;
    totalTextLength: number;
    avgProcessingTimePerFile: number;
  };
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  count: number;
  totalChunks: number;
}

export interface DocumentStats {
  totalDocuments: number;
  totalSize: number;
  byType: Record<string, number>;
  recentUploads: number;
}

export interface EnhancedProcessingMetrics {
  period: string;
  totalDocuments: number;
  totalChunks: number;
  avgChunksPerDocument: number;
  totalProcessingTime: number;
  avgProcessingTime: number;
  avgProcessingRate: string;
  avgChunkSize: number;
  avgChunkOverlap: number;
  uniqueEmbeddingModels: number;
  recentDocuments: number;
  recentProcessingTime: number;
  recentChunks: number;
  fileTypeDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  performanceTrends: {
    recentPeriod: {
      documents: number;
      avgProcessingTime: number;
      totalChunks: number;
    };
    previousPeriod: {
      documents: number;
      avgProcessingTime: number;
      totalChunks: number;
    };
    trend: {
      documentsChange: number;
      processingTimeChange: number;
      processingTimeChangePercent: number;
    };
  };
  lastUpdated: string;
}

export interface DocumentListResponse {
  documents: Document[];
  count: number;
  total: number;
  stats: DocumentStats;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

class DocumentService {
  private getAuthToken(): string | null {
    const session = localStorage.getItem('authSession');
    if (session) {
      const parsedSession = JSON.parse(session);
      return parsedSession.accessToken;
    }
    return null;
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getAuthToken();
    return {
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  async uploadDocument(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('document', file);

    const response = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Document upload failed');
    }

    return data.data;
  }

  async batchUploadDocuments(files: File[]): Promise<BatchUploadResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('documents', file);
    });

    const response = await fetch(`${API_BASE}/documents/batch-upload`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Batch upload failed');
    }

    return data.data;
  }

  async batchUploadDocumentsWithProgress(
    files: File[], 
    onProgress: (event: BatchUploadProgressEvent) => void
  ): Promise<void> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('documents', file);
    });

    const response = await fetch(`${API_BASE}/documents/batch-upload-stream`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Batch upload failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Failed to get response stream');
    }

    let currentEventType = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEventType = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            try {
              const eventData = JSON.parse(line.substring(5).trim());
              onProgress({
                type: currentEventType as any,
                data: eventData
              });
            } catch (e) {
              // Skip invalid JSON
              console.warn('Failed to parse SSE data:', line);
            }
          } else if (line.trim() === '' && currentEventType) {
            // Empty line indicates end of event
            currentEventType = '';
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getUserDocuments(params?: {
    page?: number;
    limit?: number;
    search?: string;
    fileType?: string;
  }): Promise<DocumentListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.fileType) queryParams.append('fileType', params.fileType);

    const response = await fetch(`${API_BASE}/documents?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch documents');
    }

    return data.data;
  }

  async searchDocuments(query: string, limit: number = 5): Promise<SearchResponse> {
    const response = await fetch(`${API_BASE}/documents/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({ query, limit }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Document search failed');
    }

    return data.data;
  }

  async getDocumentContent(documentId: string): Promise<{ document: Document; content: string; wordCount: number }> {
    const response = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch document content');
    }

    return data.data;
  }

  async deleteDocument(documentId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete document');
    }
  }

  async getProcessingMetrics(days: number = 30): Promise<EnhancedProcessingMetrics> {
    const response = await fetch(`${API_BASE}/documents/processing-metrics?days=${days}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch processing metrics');
    }

    return data.data;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getSupportedFileTypes(): string[] {
    return ['.pdf', '.docx', '.html', '.txt'];
  }

  isValidFileType(file: File): boolean {
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/html',
      'text/plain'
    ];
    return supportedTypes.includes(file.type);
  }

  getMaxFileSize(): number {
    return 10 * 1024 * 1024; // 10MB
  }

  validateFile(file: File): { isValid: boolean; error?: string } {
    if (!this.isValidFileType(file)) {
      return {
        isValid: false,
        error: 'Invalid file type. Please upload PDF, DOCX, HTML, or TXT files.'
      };
    }

    if (file.size > this.getMaxFileSize()) {
      return {
        isValid: false,
        error: 'File too large. Maximum size is 10MB.'
      };
    }

    return { isValid: true };
  }

  // Queue Management Methods
  async createUploadQueue(queueName: string = 'default'): Promise<{ queueId: string; queueName: string }> {
    const response = await fetch(`${API_BASE}/documents/queue/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({ queueName }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create upload queue');
    }

    return data.data;
  }

  async getUploadQueues(): Promise<{ queues: any[]; count: number }> {
    const response = await fetch(`${API_BASE}/documents/queues`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get upload queues');
    }

    return data.data;
  }

  async getQueueStatus(queueName: string): Promise<any> {
    const response = await fetch(`${API_BASE}/documents/queue/${queueName}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get queue status');
    }

    return data.data;
  }

  async reorderQueue(queueName: string, itemId: string, newPosition: number): Promise<any> {
    const response = await fetch(`${API_BASE}/documents/queue/${queueName}/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({ itemId, newPosition }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to reorder queue');
    }

    return data.data;
  }

  async pauseQueue(queueName: string): Promise<any> {
    const response = await fetch(`${API_BASE}/documents/queue/${queueName}/pause`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to pause queue');
    }

    return data.data;
  }

  async resumeQueue(queueName: string): Promise<any> {
    const response = await fetch(`${API_BASE}/documents/queue/${queueName}/resume`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to resume queue');
    }

    return data.data;
  }

  async cleanupQueue(queueName: string): Promise<any> {
    const response = await fetch(`${API_BASE}/documents/queue/${queueName}/cleanup`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to cleanup queue');
    }

    return data.data;
  }

  // Progress Tracking Methods
  async getProgressTrackers(): Promise<{ trackers: any[]; count: number }> {
    const response = await fetch(`${API_BASE}/documents/progress/trackers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get progress trackers');
    }

    return data.data;
  }

  async getProgressTracker(trackerId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/documents/progress/${trackerId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get progress tracker');
    }

    return data.data;
  }

  async getProgressHistory(trackerId: string, limit: number = 100): Promise<{ trackerId: string; history: any[]; count: number }> {
    const response = await fetch(`${API_BASE}/documents/progress/${trackerId}/history?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get progress history');
    }

    return data.data;
  }

  // Processing Status Methods
  async getProcessingStatus(jobId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/documents/processing-status/${jobId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get processing status');
    }

    return data.data;
  }

  // Embedding Optimization Methods
  async getEmbeddingOptimizationStatus(): Promise<any> {
    const response = await fetch(`${API_BASE}/documents/embedding/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get embedding optimization status');
    }

    return data.data;
  }

  async clearEmbeddingCache(): Promise<{ clearedEntries: number }> {
    const response = await fetch(`${API_BASE}/documents/embedding/cache`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to clear embedding cache');
    }

    return data.data;
  }

  async testEmbeddingOptimization(texts: string[]): Promise<any> {
    const response = await fetch(`${API_BASE}/documents/embedding/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({ texts }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to test embedding optimization');
    }

    return data.data;
  }
}

export const documentService = new DocumentService();