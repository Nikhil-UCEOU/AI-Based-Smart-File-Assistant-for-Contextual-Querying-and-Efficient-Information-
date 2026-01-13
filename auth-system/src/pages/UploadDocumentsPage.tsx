import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import AnimatedBackground from '../components/ui/AnimatedBackground';
import ColorfulCard from '../components/ui/ColorfulCard';
import { PrimaryButton, SecondaryButton } from '../components/ui/Button';
import { documentService, Document, ProcessingMetrics } from '../services/documentService';

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const PageContainer = styled.div`
  min-height: 100vh;
  padding: 40px 20px;
  position: relative;
`;

const PageContent = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  position: relative;
  z-index: 10;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 40px;
  animation: ${fadeInUp} 1s ease-out;
`;

const PageTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 4px rgba(255, 107, 107, 0.3);
`;

const PageSubtitle = styled.p`
  color: #ffffff;
  font-size: 1.1rem;
  font-weight: 600;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  background: rgba(255, 255, 255, 0.1);
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const ChunkCountBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 8px;
`;

const ToggleButton = styled.button<{ active: boolean }>`
  padding: 12px 24px;
  background: ${props => props.active ? 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)' : 'rgba(255, 255, 255, 0.15)'};
  border: 2px solid ${props => props.active ? '#ff6b6b' : 'rgba(255, 255, 255, 0.3)'};
  border-radius: 8px;
  color: ${props => props.active ? '#ffffff' : '#ffffff'};
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: ${props => props.active ? '0 4px 15px rgba(255, 107, 107, 0.5)' : '0 2px 8px rgba(0, 0, 0, 0.2)'};
  text-shadow: ${props => props.active ? '0 1px 2px rgba(0, 0, 0, 0.3)' : '0 1px 2px rgba(0, 0, 0, 0.5)'};
  
  &:hover {
    background: ${props => props.active ? 'linear-gradient(135deg, #ff5252 0%, #ffc107 100%)' : 'rgba(255, 255, 255, 0.25)'};
    transform: translateY(-2px);
    box-shadow: ${props => props.active ? '0 6px 20px rgba(255, 107, 107, 0.6)' : '0 4px 12px rgba(0, 0, 0, 0.3)'};
    border-color: ${props => props.active ? '#ff5252' : 'rgba(255, 255, 255, 0.5)'};
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const RecentUploads = styled(ColorfulCard)`
  animation: ${fadeInUp} 1s ease-out 0.4s both;
`;

const UploadSection = styled(ColorfulCard)`
  animation: ${fadeInUp} 1s ease-out 0.2s both;
  margin-bottom: 30px;
`;

const DropZone = styled.div<{ isDragOver: boolean; isUploading: boolean }>`
  border: 3px dashed ${props => props.isDragOver ? '#4facfe' : 'rgba(255, 255, 255, 0.3)'};
  border-radius: 12px;
  padding: 60px 20px;
  text-align: center;
  background: ${props => props.isDragOver ? 'rgba(79, 172, 254, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
  transition: all 0.3s ease;
  cursor: ${props => props.isUploading ? 'not-allowed' : 'pointer'};
  position: relative;
  
  &:hover {
    border-color: ${props => props.isUploading ? 'rgba(255, 255, 255, 0.3)' : '#4facfe'};
    background: ${props => props.isUploading ? 'rgba(255, 255, 255, 0.05)' : 'rgba(79, 172, 254, 0.1)'};
  }
`;

const UploadIcon = styled.div<{ isUploading: boolean }>`
  font-size: 4rem;
  margin-bottom: 20px;
  color: #4facfe;
  animation: ${props => props.isUploading ? spin : 'none'} 1s linear infinite;
`;

const UploadText = styled.div`
  color: rgba(255, 255, 255, 0.95);
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 10px;
`;

const UploadSubtext = styled.div`
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  margin-bottom: 20px;
`;

const FileInput = styled.input`
  display: none;
`;

const ProgressBar = styled.div<{ progress: number }>`
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  margin: 20px 0;
  
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.progress}%;
    background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
    transition: width 0.3s ease;
  }
`;

const StatusMessage = styled.div<{ type: 'success' | 'error' | 'info' }>`
  padding: 15px 20px;
  border-radius: 8px;
  margin: 20px 0;
  font-weight: 500;
  background: ${props => {
    switch (props.type) {
      case 'success': return 'rgba(40, 167, 69, 0.2)';
      case 'error': return 'rgba(220, 53, 69, 0.2)';
      default: return 'rgba(79, 172, 254, 0.2)';
    }
  }};
  color: ${props => {
    switch (props.type) {
      case 'success': return '#28a745';
      case 'error': return '#dc3545';
      default: return '#4facfe';
    }
  }};
  border: 1px solid ${props => {
    switch (props.type) {
      case 'success': return 'rgba(40, 167, 69, 0.3)';
      case 'error': return 'rgba(220, 53, 69, 0.3)';
      default: return 'rgba(79, 172, 254, 0.3)';
    }
  }};
`;



const ProcessingStatusIndicator = styled.div<{ status: 'processing' | 'completed' | 'failed' | 'idle' }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  background: ${props => {
    switch (props.status) {
      case 'processing': return 'rgba(79, 172, 254, 0.2)';
      case 'completed': return 'rgba(40, 167, 69, 0.2)';
      case 'failed': return 'rgba(220, 53, 69, 0.2)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'processing': return '#2563eb';
      case 'completed': return '#16a34a';
      case 'failed': return '#dc2626';
      default: return '#5a6c7d';
    }
  }};
  border: 1px solid ${props => {
    switch (props.status) {
      case 'processing': return 'rgba(79, 172, 254, 0.3)';
      case 'completed': return 'rgba(40, 167, 69, 0.3)';
      case 'failed': return 'rgba(220, 53, 69, 0.3)';
      default: return 'rgba(255, 255, 255, 0.2)';
    }
  }};
`;



const BackButton = styled(SecondaryButton)`
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 20;
`;

const BatchUploadSection = styled(ColorfulCard)`
  animation: ${fadeInUp} 1s ease-out 0.3s both;
  margin-bottom: 30px;
`;

const FileQueue = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const QueuedFile = styled.div<{ status: 'pending' | 'processing' | 'completed' | 'error' }>`
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  background: ${props => {
    switch (props.status) {
      case 'processing': return 'rgba(79, 172, 254, 0.2)';
      case 'completed': return 'rgba(40, 167, 69, 0.2)';
      case 'error': return 'rgba(220, 53, 69, 0.2)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  }};
  border-radius: 6px;
  border: 1px solid ${props => {
    switch (props.status) {
      case 'processing': return 'rgba(79, 172, 254, 0.3)';
      case 'completed': return 'rgba(40, 167, 69, 0.3)';
      case 'error': return 'rgba(220, 53, 69, 0.3)';
      default: return 'rgba(255, 255, 255, 0.2)';
    }
  }};
  transition: all 0.3s ease;
`;

const FileRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const FileProgressBar = styled.div<{ progress: number; status: 'pending' | 'processing' | 'completed' | 'error' }>`
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;
  
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.progress}%;
    background: ${props => {
      switch (props.status) {
        case 'processing': return 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)';
        case 'completed': return 'linear-gradient(90deg, #28a745 0%, #20c997 100%)';
        case 'error': return 'linear-gradient(90deg, #dc3545 0%, #fd7e14 100%)';
        default: return 'rgba(255, 255, 255, 0.3)';
      }
    }};
    transition: width 0.3s ease;
    animation: ${props => props.status === 'processing' ? 'pulse 1.5s ease-in-out infinite alternate' : 'none'};
  }
  
  @keyframes pulse {
    0% { opacity: 0.6; }
    100% { opacity: 1; }
  }
`;

const FileInfo = styled.div`
  flex: 1;
`;

const FileName = styled.div`
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
  margin-bottom: 4px;
`;

const FileDetails = styled.div`
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
`;

const FileStatus = styled.div<{ status: 'pending' | 'processing' | 'completed' | 'error' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${props => {
    switch (props.status) {
      case 'processing': return '#2563eb';
      case 'completed': return '#16a34a';
      case 'error': return '#dc2626';
      default: return '#5a6c7d';
    }
  }};
  font-weight: 500;
`;

const StatusIcon = styled.div<{ status: 'pending' | 'processing' | 'completed' | 'error' }>`
  font-size: 1.2rem;
  animation: ${props => props.status === 'processing' ? spin : 'none'} 1s linear infinite;
`;

const BatchControls = styled.div`
  display: flex;
  gap: 15px;
  margin-top: 20px;
  flex-wrap: wrap;
`;

const DocumentPreview = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 15px;
  margin-top: 15px;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const PreviewTitle = styled.div`
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PreviewContent = styled.div`
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
  line-height: 1.5;
  max-height: 150px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.1);
  padding: 10px;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 20px;
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 15px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 800;
  color: #4facfe;
  margin-bottom: 5px;
`;

const StatLabel = styled.div`
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
`;



interface QueuedFileItem {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  result?: Document;
  processingMetrics?: ProcessingMetrics;
}

interface DocumentStats {
  totalDocuments: number;
  totalSize: number;
  byType: Record<string, number>;
  recentUploads: number;
}

const UploadDocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [fileQueue, setFileQueue] = useState<QueuedFileItem[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [documentStats, setDocumentStats] = useState<DocumentStats>({
    totalDocuments: 0,
    totalSize: 0,
    byType: {},
    recentUploads: 0
  });
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');

  // Load user documents and stats on component mount
  useEffect(() => {
    loadUserDocuments();
  }, []);

  const loadUserDocuments = async () => {
    try {
      const response = await documentService.getUserDocuments();
      setDocumentStats(response.stats);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setStatusMessage({ 
        type: 'error', 
        text: 'Failed to load your documents. Please refresh the page.' 
      });
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      if (isBatchMode) {
        addFilesToQueue(files);
      } else {
        handleFileUpload(files[0]);
      }
    }
  }, [isBatchMode]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      if (isBatchMode) {
        addFilesToQueue(fileArray);
      } else {
        handleFileUpload(fileArray[0]);
      }
    }
  }, [isBatchMode]);

  const addFilesToQueue = (files: File[]) => {
    const newQueueItems: QueuedFileItem[] = files.map(file => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      status: 'pending',
      progress: 0
    }));

    // Validate files
    const validFiles = newQueueItems.filter(item => {
      const validation = documentService.validateFile(item.file);
      if (!validation.isValid) {
        setStatusMessage({ 
          type: 'error', 
          text: `${item.file.name}: ${validation.error}` 
        });
        return false;
      }
      return true;
    });

    setFileQueue(prev => [...prev, ...validFiles]);
    setStatusMessage({ 
      type: 'info', 
      text: `Added ${validFiles.length} file(s) to upload queue` 
    });
  };

  const removeFromQueue = (id: string) => {
    setFileQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearQueue = () => {
    setFileQueue([]);
  };

  const processBatchUpload = async () => {
    if (fileQueue.length === 0) return;

    const pendingFiles = fileQueue.filter(item => item.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setProcessingStatus('processing');

    try {
      // Mark all pending files as processing
      setFileQueue(prev => prev.map(item => 
        item.status === 'pending' 
          ? { ...item, status: 'processing', progress: 0 }
          : item
      ));

      // Extract files from pending queue items
      const filesToUpload = pendingFiles.map(item => item.file);
      
      // Use streaming batch upload with real-time progress
      await documentService.batchUploadDocumentsWithProgress(filesToUpload, (event) => {
        switch (event.type) {
          case 'batch-started':
            setStatusMessage({ 
              type: 'info', 
              text: `Starting batch upload of ${event.data.totalFiles} files...` 
            });
            break;

          case 'file-started':
            setFileQueue(prev => prev.map(item => 
              item.file.name === event.data.fileName 
                ? { ...item, status: 'processing', progress: 10 }
                : item
            ));
            setStatusMessage({ 
              type: 'info', 
              text: `Processing ${event.data.fileName}...` 
            });
            break;

          case 'file-extracted':
            setFileQueue(prev => prev.map(item => 
              item.file.name === event.data.fileName 
                ? { ...item, progress: 50 }
                : item
            ));
            break;

          case 'file-completed':
            setFileQueue(prev => prev.map(item => 
              item.file.name === event.data.fileName 
                ? { 
                    ...item, 
                    status: 'completed', 
                    progress: 100,
                    result: event.data.document,
                    processingMetrics: event.data.processingMetrics
                  }
                : item
            ));
            setStatusMessage({ 
              type: 'success', 
              text: `✅ ${event.data.fileName} completed! Generated ${event.data.processingMetrics?.chunkCount || 0} chunks in ${event.data.processingMetrics?.totalProcessingTime ? (event.data.processingMetrics.totalProcessingTime / 1000).toFixed(2) : 0}s` 
            });
            break;

          case 'file-failed':
            setFileQueue(prev => prev.map(item => 
              item.file.name === event.data.fileName 
                ? { 
                    ...item, 
                    status: 'error', 
                    progress: 0,
                    error: event.data.error
                  }
                : item
            ));
            setStatusMessage({ 
              type: 'error', 
              text: `❌ ${event.data.fileName} failed: ${event.data.error}` 
            });
            break;

          case 'batch-completed':
            setProcessingStatus(event.data.data.summary.successful > 0 ? 'completed' : 'failed');
            setStatusMessage({ 
              type: event.data.data.summary.successful > 0 ? 'success' : 'error', 
              text: `🎉 Batch upload completed! ${event.data.data.summary.successful} successful, ${event.data.data.summary.failed} failed` 
            });
            break;
        }
      });

      // Reload documents and metrics after completion
      await loadUserDocuments();
      
    } catch (error: any) {
      // Mark all processing files as error
      setFileQueue(prev => prev.map(item => 
        item.status === 'processing' 
          ? { ...item, status: 'error', progress: 0, error: error.message }
          : item
      ));
      
      setProcessingStatus('failed');
      setStatusMessage({ 
        type: 'error', 
        text: error.message || 'Batch upload failed' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (isUploading) return;

    // Validate file
    const validation = documentService.validateFile(file);
    if (!validation.isValid) {
      setStatusMessage({ type: 'error', text: validation.error! });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setProcessingStatus('processing');
    setStatusMessage({ type: 'info', text: 'Processing your document...' });

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await documentService.uploadDocument(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setProcessingStatus('completed');
      
      const chunkInfo = result.processingMetrics?.chunkCount ? 
        ` Generated ${result.processingMetrics.chunkCount} chunks.` : '';
      const processingTime = result.processingMetrics?.totalProcessingTime ? 
        ` Processing time: ${(result.processingMetrics.totalProcessingTime / 1000).toFixed(2)}s.` : '';
      
      setStatusMessage({ 
        type: 'success', 
        text: `Document "${file.name}" uploaded successfully! Extracted ${result.wordCount} words.${chunkInfo}${processingTime}` 
      });

      // Add to recent documents and reload stats
      await loadUserDocuments();
      
      // Reset after 3 seconds
      setTimeout(() => {
        setUploadProgress(0);
        setStatusMessage(null);
        setProcessingStatus('idle');
      }, 3000);

    } catch (error: any) {
      setUploadProgress(0);
      setProcessingStatus('failed');
      setStatusMessage({ 
        type: 'error', 
        text: error.message || 'Failed to upload document. Please try again.' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status: 'pending' | 'processing' | 'completed' | 'error') => {
    switch (status) {
      case 'pending': return '⏳';
      case 'processing': return '🔄';
      case 'completed': return '✅';
      case 'error': return '❌';
    }
  };

  const getProcessingStatusIcon = (status: 'idle' | 'processing' | 'completed' | 'failed') => {
    switch (status) {
      case 'processing': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '⚡';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatProcessingTime = (timeMs: number) => {
    if (timeMs < 1000) return `${timeMs}ms`;
    return `${(timeMs / 1000).toFixed(2)}s`;
  };

  const formatProcessingRate = (rate: string | number) => {
    const numRate = typeof rate === 'string' ? parseFloat(rate) : rate;
    return `${numRate.toFixed(1)} chunks/sec`;
  };

  return (
    <PageContainer>
      <AnimatedBackground />
      <BackButton onClick={() => navigate('/dashboard')}>
        ← Back to Dashboard
      </BackButton>
      
      <PageContent>
        <Header>
          <PageTitle>📄 Upload Documents</PageTitle>
          <PageSubtitle>
            Upload your documents (PDF, DOCX, HTML, TXT) to build your searchable knowledge database
          </PageSubtitle>
          
          {/* Document Statistics */}
          <StatsGrid>
            <StatCard>
              <StatValue>{documentStats.totalDocuments}</StatValue>
              <StatLabel>Total Documents</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>{formatFileSize(documentStats.totalSize)}</StatValue>
              <StatLabel>Total Storage</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>{documentStats.recentUploads}</StatValue>
              <StatLabel>Recent Uploads (24h)</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>{Object.keys(documentStats.byType).length}</StatValue>
              <StatLabel>File Types</StatLabel>
            </StatCard>
          </StatsGrid>

          {/* Processing Status Indicator */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <ProcessingStatusIndicator status={processingStatus}>
              {getProcessingStatusIcon(processingStatus)}
              {processingStatus === 'processing' ? 'Processing Documents...' : 
               processingStatus === 'completed' ? 'Processing Complete' :
               processingStatus === 'failed' ? 'Processing Failed' : 'Ready to Process'}
            </ProcessingStatusIndicator>
          </div>
        </Header>

        {/* Upload Mode Toggle */}
        <UploadSection
          title="📋 Upload Mode Selection"
          variant="secondary"
          titleColor="linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)"
        >
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.1rem', marginBottom: '20px', fontWeight: '600' }}>
              Choose your upload method:
            </p>
          </div>
          <BatchControls style={{ justifyContent: 'center', gap: '20px' }}>
            <ToggleButton 
              active={!isBatchMode} 
              onClick={() => setIsBatchMode(false)}
            >
              📄 Single Upload
            </ToggleButton>
            <ToggleButton 
              active={isBatchMode} 
              onClick={() => setIsBatchMode(true)}
            >
              📚 Batch Upload
            </ToggleButton>
          </BatchControls>
          <div style={{ textAlign: 'center', marginTop: '15px' }}>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem', fontWeight: '500' }}>
              {isBatchMode 
                ? '🚀 Batch mode: Upload multiple files at once for faster processing'
                : '⚡ Single mode: Upload one file at a time with immediate processing'
              }
            </p>
          </div>
        </UploadSection>

        {/* Batch Upload Queue */}
        {isBatchMode && (
          <BatchUploadSection
            title="Upload Queue"
            variant="warning"
            titleColor="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
          >
            {fileQueue.length > 0 ? (
              <>
                <FileQueue>
                  {fileQueue.map((queueItem) => (
                    <QueuedFile key={queueItem.id} status={queueItem.status}>
                      <FileRow>
                        <FileInfo>
                          <FileName>{queueItem.file.name}</FileName>
                          <FileDetails>
                            {formatFileSize(queueItem.file.size)} • {queueItem.file.type}
                            {queueItem.result && queueItem.result.chunkCount > 0 && (
                              <ChunkCountBadge>
                                📄 {queueItem.result.chunkCount} chunks
                              </ChunkCountBadge>
                            )}
                            {queueItem.error && ` • Error: ${queueItem.error}`}
                          </FileDetails>
                          {queueItem.processingMetrics && queueItem.status === 'completed' && (
                            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                              ⏱️ {formatProcessingTime(queueItem.processingMetrics.totalProcessingTime)} • 
                              ⚡ {queueItem.processingMetrics.processingRate && formatProcessingRate(queueItem.processingMetrics.processingRate)} • 
                              📝 {queueItem.processingMetrics.wordCount?.toLocaleString()} words
                            </div>
                          )}
                        </FileInfo>
                        <FileStatus status={queueItem.status}>
                          <StatusIcon status={queueItem.status}>
                            {getStatusIcon(queueItem.status)}
                          </StatusIcon>
                          {queueItem.status === 'pending' && (
                            <SecondaryButton onClick={() => removeFromQueue(queueItem.id)}>
                              Remove
                            </SecondaryButton>
                          )}
                          {queueItem.status === 'completed' && queueItem.processingMetrics && (
                            <div style={{ fontSize: '0.75rem', color: '#28a745', fontWeight: 600 }}>
                              {formatProcessingTime(queueItem.processingMetrics.totalProcessingTime)}
                            </div>
                          )}
                          {queueItem.status === 'processing' && (
                            <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>
                              {queueItem.progress}%
                            </div>
                          )}
                        </FileStatus>
                      </FileRow>
                      
                      {/* Individual file progress bar */}
                      {(queueItem.status === 'processing' || queueItem.status === 'completed') && (
                        <FileProgressBar 
                          progress={queueItem.progress} 
                          status={queueItem.status}
                        />
                      )}
                    </QueuedFile>
                  ))}
                </FileQueue>
                
                <BatchControls>
                  <PrimaryButton 
                    onClick={processBatchUpload}
                    disabled={isUploading || fileQueue.every(f => f.status !== 'pending')}
                  >
                    {isUploading ? '🔄 Processing...' : '🚀 Upload All'}
                  </PrimaryButton>
                  <SecondaryButton onClick={clearQueue}>
                    🗑️ Clear Queue
                  </SecondaryButton>
                </BatchControls>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)', padding: '20px' }}>
                No files in queue. Drop files or click to add them.
              </div>
            )}
          </BatchUploadSection>
        )}

        <UploadSection
          title={isBatchMode ? "📚 Add Files to Batch Queue" : "📄 Upload Single Document"}
          variant="primary"
          titleColor="linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)"
        >
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '15px',
            padding: '12px',
            background: isBatchMode ? 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)' : 'linear-gradient(135deg, #48cae4 0%, #0077b6 100%)',
            borderRadius: '8px',
            border: `2px solid ${isBatchMode ? '#ff6b6b' : '#48cae4'}`,
            boxShadow: `0 4px 15px ${isBatchMode ? 'rgba(255, 107, 107, 0.3)' : 'rgba(72, 202, 228, 0.3)'}`
          }}>
            <p style={{ 
              color: '#ffffff', 
              fontWeight: '700',
              margin: 0,
              fontSize: '1.1rem',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {isBatchMode 
                ? '🔄 BATCH MODE ACTIVE - Add multiple files to queue'
                : '⚡ SINGLE MODE ACTIVE - Upload one file at a time'
              }
            </p>
          </div>
          <DropZone
            isDragOver={isDragOver}
            isUploading={isUploading}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && document.getElementById('file-input')?.click()}
          >
            <UploadIcon isUploading={isUploading}>
              {isUploading ? '⏳' : isBatchMode ? '📚' : '📁'}
            </UploadIcon>
            
            <UploadText>
              {isUploading 
                ? 'Processing document...' 
                : isBatchMode 
                  ? '📚 Drop multiple files here or click to browse'
                  : '📄 Drop your document here or click to browse'
              }
            </UploadText>
            
            <UploadSubtext>
              Supports PDF, DOCX, HTML, and TXT files (max 10MB each)
              {isBatchMode && ' • Multiple files supported'}
              <br />
              <strong style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)' }}>
                {isBatchMode ? 'BATCH MODE: Queue files for processing' : 'SINGLE MODE: Immediate processing'}
              </strong>
            </UploadSubtext>

            {!isUploading && (
              <PrimaryButton variant="secondary">
                {isBatchMode ? 'Choose Files' : 'Choose File'}
              </PrimaryButton>
            )}

            <FileInput
              id="file-input"
              type="file"
              accept=".pdf,.docx,.html,.txt"
              onChange={handleFileSelect}
              disabled={isUploading}
              multiple={isBatchMode}
            />
          </DropZone>

          {uploadProgress > 0 && !isBatchMode && (
            <ProgressBar progress={uploadProgress} />
          )}

          {statusMessage && (
            <StatusMessage type={statusMessage.type}>
              {statusMessage.text}
            </StatusMessage>
          )}
        </UploadSection>

        {/* Document Preview */}
        {selectedDocument && (
          <RecentUploads
            title="Document Preview"
            variant="secondary"
            titleColor="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          >
            <DocumentPreview>
              <PreviewTitle>
                📄 {selectedDocument.originalName}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {selectedDocument.chunkCount > 0 && (
                    <ChunkCountBadge>
                      📄 {selectedDocument.chunkCount} chunks
                    </ChunkCountBadge>
                  )}
                  <SecondaryButton onClick={() => setSelectedDocument(null)}>
                    ✕ Close
                  </SecondaryButton>
                </div>
              </PreviewTitle>
              
              {/* Document Processing Info */}
              {(selectedDocument.processingTime > 0 || selectedDocument.embeddingModel) && (
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  padding: '10px', 
                  borderRadius: '6px', 
                  marginBottom: '15px',
                  fontSize: '0.85rem',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  {selectedDocument.processingTime > 0 && (
                    <span>⏱️ Processing Time: {formatProcessingTime(selectedDocument.processingTime)} • </span>
                  )}
                  {selectedDocument.embeddingModel && (
                    <span>🤖 Model: {selectedDocument.embeddingModel} • </span>
                  )}
                  <span>📏 Chunk Size: {selectedDocument.chunkSize} • Overlap: {selectedDocument.chunkOverlap}</span>
                </div>
              )}
              
              <PreviewContent>
                {selectedDocument.extractedText?.substring(0, 1000) || 'Loading content...'}
                {selectedDocument.extractedText && selectedDocument.extractedText.length > 1000 && '...'}
              </PreviewContent>
            </DocumentPreview>
          </RecentUploads>
        )}
      </PageContent>
    </PageContainer>
  );
};

export default UploadDocumentsPage;