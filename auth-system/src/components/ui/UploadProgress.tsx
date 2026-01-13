import React from 'react';
import styled, { keyframes } from 'styled-components';

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const ProgressContainer = styled.div`
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 16px;
  margin: 12px 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  animation: ${slideIn} 0.3s ease-out;
  border-left: 4px solid #667eea;
`;

const ProgressHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const ProgressIcon = styled.div<{ $isComplete: boolean; $hasError: boolean }>`
  font-size: 1.2rem;
  animation: ${props => !props.$isComplete && !props.$hasError ? pulse : 'none'} 1.5s infinite;
`;

const ProgressTitle = styled.div`
  font-weight: 600;
  color: #333;
  flex: 1;
`;

const ProgressStatus = styled.div<{ $status: 'uploading' | 'processing' | 'complete' | 'error' }>`
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: 500;
  
  ${props => {
    switch (props.$status) {
      case 'uploading':
        return `
          background: rgba(255, 193, 7, 0.2);
          color: #856404;
        `;
      case 'processing':
        return `
          background: rgba(0, 123, 255, 0.2);
          color: #004085;
        `;
      case 'complete':
        return `
          background: rgba(40, 167, 69, 0.2);
          color: #155724;
        `;
      case 'error':
        return `
          background: rgba(220, 53, 69, 0.2);
          color: #721c24;
        `;
      default:
        return '';
    }
  }}
`;

const FileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FileItem = styled.div<{ $status: 'uploading' | 'processing' | 'complete' | 'error' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  font-size: 0.9rem;
  
  ${props => props.$status === 'error' && `
    background: rgba(220, 53, 69, 0.1);
    border: 1px solid rgba(220, 53, 69, 0.3);
  `}
`;

const FileIcon = styled.span`
  font-size: 1rem;
`;

const FileName = styled.span`
  flex: 1;
  color: #333;
  font-weight: 500;
`;

const FileStatus = styled.span<{ $status: 'uploading' | 'processing' | 'complete' | 'error' }>`
  font-size: 0.8rem;
  font-weight: 500;
  
  ${props => {
    switch (props.$status) {
      case 'uploading':
        return 'color: #856404;';
      case 'processing':
        return 'color: #004085;';
      case 'complete':
        return 'color: #155724;';
      case 'error':
        return 'color: #721c24;';
      default:
        return '';
    }
  }}
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;
`;

const ProgressFill = styled.div<{ $progress: number }>`
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 2px;
  transition: width 0.3s ease;
  width: ${props => props.$progress}%;
`;

const ErrorMessage = styled.div`
  color: #721c24;
  font-size: 0.8rem;
  margin-top: 4px;
  font-style: italic;
`;

export interface UploadFile {
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

interface UploadProgressProps {
  files: UploadFile[];
  overallProgress: number;
  onClose?: () => void;
}

const UploadProgress: React.FC<UploadProgressProps> = ({
  files,
  overallProgress,
  onClose
}) => {
  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('docx')) return '📝';
    if (type.includes('html')) return '🌐';
    if (type.includes('text')) return '📃';
    return '📄';
  };

  const getOverallStatus = () => {
    if (files.some(f => f.status === 'error')) return 'error';
    if (files.every(f => f.status === 'complete')) return 'complete';
    if (files.some(f => f.status === 'processing')) return 'processing';
    return 'uploading';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploading': return 'Uploading...';
      case 'processing': return 'Processing...';
      case 'complete': return 'Complete';
      case 'error': return 'Error';
      default: return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading': return '⏳';
      case 'processing': return '🔄';
      case 'complete': return '✅';
      case 'error': return '❌';
      default: return '📄';
    }
  };

  const overallStatus = getOverallStatus();
  const completedFiles = files.filter(f => f.status === 'complete').length;
  const totalFiles = files.length;

  return (
    <ProgressContainer>
      <ProgressHeader>
        <ProgressIcon 
          $isComplete={overallStatus === 'complete'} 
          $hasError={overallStatus === 'error'}
        >
          {getStatusIcon(overallStatus)}
        </ProgressIcon>
        <ProgressTitle>
          {overallStatus === 'complete' 
            ? `Successfully uploaded ${totalFiles} file${totalFiles > 1 ? 's' : ''}`
            : `Uploading ${totalFiles} file${totalFiles > 1 ? 's' : ''}...`
          }
        </ProgressTitle>
        <ProgressStatus $status={overallStatus}>
          {overallStatus === 'complete' 
            ? 'Complete' 
            : `${completedFiles}/${totalFiles}`
          }
        </ProgressStatus>
      </ProgressHeader>

      <FileList>
        {files.map((file, index) => (
          <FileItem key={index} $status={file.status}>
            <FileIcon>{getFileIcon(file.type)}</FileIcon>
            <FileName>{file.name}</FileName>
            <FileStatus $status={file.status}>
              {getStatusText(file.status)}
            </FileStatus>
          </FileItem>
        ))}
      </FileList>

      {overallStatus !== 'complete' && (
        <ProgressBar>
          <ProgressFill $progress={overallProgress} />
        </ProgressBar>
      )}

      {files.some(f => f.error) && (
        <div style={{ marginTop: '8px' }}>
          {files.filter(f => f.error).map((file, index) => (
            <ErrorMessage key={index}>
              {file.name}: {file.error}
            </ErrorMessage>
          ))}
        </div>
      )}
    </ProgressContainer>
  );
};

export default UploadProgress;