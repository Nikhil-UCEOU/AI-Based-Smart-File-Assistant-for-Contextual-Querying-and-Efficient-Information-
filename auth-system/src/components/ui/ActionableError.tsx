import React from 'react';
import styled, { keyframes } from 'styled-components';
import { ErrorMessage, ErrorAction } from '../../utils/ErrorDictionary';

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-2px); }
`;

const ErrorContainer = styled.div<{ type: ErrorMessage['type'] }>`
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid;
  backdrop-filter: blur(10px);
  animation: ${float} 2s ease-in-out infinite;
  
  ${({ type }) => {
    switch (type) {
      case 'error':
        return `
          background: rgba(255, 107, 107, 0.1);
          border-color: rgba(255, 107, 107, 0.3);
          color: #dc2626;
        `;
      case 'warning':
        return `
          background: rgba(251, 191, 36, 0.1);
          border-color: rgba(251, 191, 36, 0.3);
          color: #92400e;
        `;
      case 'success':
        return `
          background: rgba(17, 153, 142, 0.1);
          border-color: rgba(17, 153, 142, 0.3);
          color: #059669;
        `;
      case 'info':
        return `
          background: rgba(79, 172, 254, 0.1);
          border-color: rgba(79, 172, 254, 0.3);
          color: #1e40af;
        `;
      default:
        return `
          background: rgba(107, 114, 128, 0.1);
          border-color: rgba(107, 114, 128, 0.3);
          color: #374151;
        `;
    }
  }}
`;

const ErrorHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
`;

const ErrorTitle = styled.h4`
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: inherit;
`;

const DismissButton = styled.button`
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  font-size: 18px;
  line-height: 1;
  opacity: 0.7;
  transition: all 0.3s ease;
  
  &:hover {
    opacity: 1;
    transform: scale(1.1);
  }
`;

const ErrorText = styled.p`
  font-size: 14px;
  margin: 0 0 12px 0;
  line-height: 1.5;
  color: inherit;
`;

const ActionContainer = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const ActionButton = styled.button<{ variant: 'primary' | 'secondary' }>`
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  
  ${({ variant }) => variant === 'primary' ? `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-color: #667eea;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    
    &:hover {
      background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }
    
    &:active {
      transform: translateY(0);
    }
  ` : `
    background: rgba(255, 255, 255, 0.9);
    color: #667eea;
    border-color: #667eea;
    backdrop-filter: blur(10px);
    
    &:hover {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }
    
    &:active {
      transform: translateY(0);
    }
  `}
`;

interface ActionableErrorProps {
  error: ErrorMessage;
  onAction?: (action: string) => void;
  className?: string;
}

export const ActionableError: React.FC<ActionableErrorProps> = ({
  error,
  onAction,
  className
}) => {
  const handleActionClick = (action: ErrorAction) => {
    onAction?.(action.action);
  };

  const handleDismiss = () => {
    onAction?.('dismiss');
  };

  return (
    <ErrorContainer type={error.type} className={className}>
      <ErrorHeader>
        <ErrorTitle>{error.title}</ErrorTitle>
        {error.dismissible && (
          <DismissButton onClick={handleDismiss} aria-label="Dismiss error">
            ×
          </DismissButton>
        )}
      </ErrorHeader>
      
      <ErrorText>{error.message}</ErrorText>
      
      {error.actions && error.actions.length > 0 && (
        <ActionContainer>
          {error.actions.map((action, index) => (
            <ActionButton
              key={index}
              variant={action.variant}
              onClick={() => handleActionClick(action)}
            >
              {action.label}
            </ActionButton>
          ))}
        </ActionContainer>
      )}
    </ErrorContainer>
  );
};