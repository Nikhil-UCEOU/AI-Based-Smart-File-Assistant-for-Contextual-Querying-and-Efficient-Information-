import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';

const slideIn = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

const ToastContainer = styled.div<{ variant: 'success' | 'error' | 'info'; isVisible: boolean }>`
  position: fixed;
  top: var(--spacing-xl);
  right: var(--spacing-xl);
  z-index: 10000;
  min-width: 300px;
  max-width: 500px;
  padding: var(--spacing-lg);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  animation: ${props => props.isVisible ? slideIn : slideOut} 0.3s ease-in-out;
  
  ${props => {
    switch (props.variant) {
      case 'success':
        return `
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          color: var(--color-success);
        `;
      case 'error':
        return `
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: var(--color-error);
        `;
      default:
        return `
          background: var(--color-background);
          border: 1px solid var(--color-border);
          color: var(--color-text);
        `;
    }
  }}
`;

const IconContainer = styled.div`
  flex-shrink: 0;
  width: 20px;
  height: 20px;
`;

const MessageContainer = styled.div`
  flex: 1;
`;

const Title = styled.p`
  margin: 0 0 var(--spacing-xs) 0;
  font-weight: 600;
  font-size: var(--font-size-sm);
`;

const Message = styled.p`
  margin: 0;
  font-size: var(--font-size-sm);
  opacity: 0.8;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: currentColor;
  cursor: pointer;
  padding: var(--spacing-xs);
  border-radius: var(--border-radius);
  opacity: 0.6;
  
  &:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.1);
  }
`;

const SuccessIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const ErrorIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

interface ToastProps {
  variant: 'success' | 'error' | 'info';
  title?: string;
  message: string;
  isVisible: boolean;
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  variant,
  title,
  message,
  isVisible,
  onClose,
  autoClose = true,
  duration = 5000
}) => {
  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      
      if (autoClose) {
        const timer = setTimeout(() => {
          onClose();
        }, duration);
        
        return () => clearTimeout(timer);
      }
    } else {
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Wait for animation to complete
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, autoClose, duration, onClose]);

  if (!shouldRender) return null;

  const getIcon = () => {
    switch (variant) {
      case 'success':
        return <SuccessIcon />;
      case 'error':
        return <ErrorIcon />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <ToastContainer variant={variant} isVisible={isVisible}>
      <IconContainer>
        {getIcon()}
      </IconContainer>
      <MessageContainer>
        {title && <Title>{title}</Title>}
        <Message>{message}</Message>
      </MessageContainer>
      <CloseButton onClick={onClose}>
        <CloseIcon />
      </CloseButton>
    </ToastContainer>
  );
};