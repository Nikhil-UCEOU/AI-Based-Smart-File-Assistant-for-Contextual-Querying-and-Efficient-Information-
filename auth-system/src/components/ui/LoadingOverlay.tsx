import React from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: ${fadeIn} 0.2s ease-in-out;
`;

const LoadingContainer = styled.div`
  background: var(--color-background);
  border-radius: var(--border-radius);
  padding: var(--spacing-3xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
  box-shadow: var(--shadow-md);
  min-width: 200px;
`;

const Spinner = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;

const LoadingText = styled.p`
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-size-base);
  font-weight: 500;
  text-align: center;
`;

const LoadingSubtext = styled.p`
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  text-align: center;
`;

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  subtext?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Loading...',
  subtext
}) => {
  if (!isVisible) return null;

  return (
    <Overlay>
      <LoadingContainer>
        <Spinner />
        <LoadingText>{message}</LoadingText>
        {subtext && <LoadingSubtext>{subtext}</LoadingSubtext>}
      </LoadingContainer>
    </Overlay>
  );
};