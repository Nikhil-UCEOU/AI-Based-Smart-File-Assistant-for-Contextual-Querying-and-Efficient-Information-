import React, { useState, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { profileService } from '../../services/profileService';

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const UploadContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
`;

const PicturePreview = styled.div`
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid rgba(79, 172, 254, 0.3);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  animation: ${fadeIn} 0.5s ease-out;
`;

const ProfileImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const DefaultAvatar = styled.div`
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 2.5rem;
`;

const UploadOverlay = styled.div<{ isDragOver: boolean; isUploading: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${props => props.isDragOver || props.isUploading ? 1 : 0};
  transition: opacity 0.3s ease;
  cursor: ${props => props.isUploading ? 'not-allowed' : 'pointer'};
  
  &:hover {
    opacity: 1;
  }
`;

const UploadIcon = styled.div<{ isUploading: boolean }>`
  color: white;
  font-size: 1.5rem;
  animation: ${props => props.isUploading ? spin : 'none'} 1s linear infinite;
`;

const UploadButtons = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
`;

const UploadButton = styled.button`
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  border: none;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(79, 172, 254, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const RemoveButton = styled.button`
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: none;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(239, 68, 68, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const FileInput = styled.input`
  display: none;
`;

const UploadInfo = styled.div`
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
  max-width: 300px;
`;

const ErrorMessage = styled.div`
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  text-align: center;
  max-width: 300px;
`;

const SuccessMessage = styled.div`
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  text-align: center;
  max-width: 300px;
`;

const ProgressBar = styled.div<{ progress: number }>`
  width: 200px;
  height: 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  overflow: hidden;
  
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.progress}%;
    background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
    transition: width 0.3s ease;
  }
`;

interface ProfilePictureUploadProps {
  currentPicture?: string;
  onUpload: (file: File) => Promise<string>;
  onRemove: () => Promise<void>;
  maxSize?: number;
  acceptedFormats?: string[];
}

export const ProfilePictureUpload: React.FC<ProfilePictureUploadProps> = ({
  currentPicture,
  onUpload,
  onRemove,
  maxSize = 5 * 1024 * 1024, // 5MB
  acceptedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
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
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    clearMessages();
    
    // Validate file
    const validation = profileService.validateImageFile(file);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      // Resize image if needed
      const resizedFile = await profileService.resizeImage(file, 400, 400, 0.8);
      
      // Upload file
      const result = await onUpload(resizedFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setSuccess('Profile picture updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
        setUploadProgress(0);
      }, 3000);
      
    } catch (error: any) {
      setError(error.message || 'Failed to upload image');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentPicture) return;
    
    clearMessages();
    setIsUploading(true);
    
    try {
      await onRemove();
      setSuccess('Profile picture removed successfully!');
      
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
    } catch (error: any) {
      setError(error.message || 'Failed to remove profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <UploadContainer>
      <PicturePreview
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {currentPicture ? (
          <ProfileImage src={currentPicture} alt="Profile" />
        ) : (
          <DefaultAvatar>👤</DefaultAvatar>
        )}
        
        <UploadOverlay 
          isDragOver={isDragOver} 
          isUploading={isUploading}
          onClick={!isUploading ? handleUploadClick : undefined}
        >
          <UploadIcon isUploading={isUploading}>
            {isUploading ? '⏳' : '📷'}
          </UploadIcon>
        </UploadOverlay>
      </PicturePreview>

      {uploadProgress > 0 && uploadProgress < 100 && (
        <ProgressBar progress={uploadProgress} />
      )}

      <UploadButtons>
        <UploadButton 
          onClick={handleUploadClick}
          disabled={isUploading}
        >
          📤 Upload Photo
        </UploadButton>
        
        {currentPicture && (
          <RemoveButton 
            onClick={handleRemove}
            disabled={isUploading}
          >
            🗑️ Remove
          </RemoveButton>
        )}
      </UploadButtons>

      <FileInput
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileSelect}
      />

      <UploadInfo>
        Drag and drop an image here, or click to browse.
        <br />
        Supported formats: JPEG, PNG, GIF, WebP
        <br />
        Maximum size: {profileService.formatFileSize(maxSize)}
      </UploadInfo>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}
    </UploadContainer>
  );
};

export default ProfilePictureUpload;