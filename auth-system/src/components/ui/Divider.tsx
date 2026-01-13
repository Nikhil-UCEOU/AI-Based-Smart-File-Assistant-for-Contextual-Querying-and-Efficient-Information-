import React from 'react';
import styled from 'styled-components';

const DividerContainer = styled.div`
  display: flex;
  align-items: center;
  margin: var(--spacing-xl) 0;
`;

const DividerLine = styled.div`
  flex: 1;
  height: 1px;
  background: var(--color-border);
`;

const DividerText = styled.span`
  padding: 0 var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: var(--color-background);
`;

interface DividerProps {
  children?: React.ReactNode;
}

export const Divider: React.FC<DividerProps> = ({ children }) => {
  return (
    <DividerContainer>
      <DividerLine />
      {children && <DividerText>{children}</DividerText>}
      <DividerLine />
    </DividerContainer>
  );
};