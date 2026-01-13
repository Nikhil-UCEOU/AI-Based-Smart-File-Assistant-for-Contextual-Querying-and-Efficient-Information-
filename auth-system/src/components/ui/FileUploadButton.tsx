import React, { useRef } from 'react';
import styled from 'styled-components';
import { PrimaryButton } from './Button';

const HiddenInput = styled.input`
  display: none;
`;

const UploadButton = styled(PrimaryButton)`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
`;

interface FileUploadButtonProps {
  onFileSelect: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  onFileSelect,
  accept = '.pdf,.docx,.html,.txt',
  multiple = true,
  disabled = false,
  children = '📎 Upload Files'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFileSelect(files);
    }
    // Reset input value to allow selecting the same file again
    event.target.value = '';
  };

  return (
    <>
      <HiddenInput
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        disabled={disabled}
      />
      <UploadButton
        onClick={handleClick}
        disabled={disabled}
        variant="secondary"
        type="button"
      >
        {children}
      </UploadButton>
    </>
  );
};

export default FileUploadButton;