import styled, { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  :root {
    --color-primary: #3B82F6;
    --color-primary-hover: #2563EB;
    --color-secondary: #6B7280;
    --color-success: #10B981;
    --color-error: #EF4444;
    --color-background: #FFFFFF;
    --color-background-subtle: #F9FAFB;
    --color-text: #111827;
    --color-text-secondary: #6B7280;
    --color-border: #E5E7EB;
    --color-border-focus: #3B82F6;
    
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 12px;
    --spacing-lg: 16px;
    --spacing-xl: 24px;
    --spacing-2xl: 32px;
    --spacing-3xl: 48px;
    
    --font-size-sm: 14px;
    --font-size-base: 16px;
    --font-size-lg: 18px;
    --font-size-xl: 24px;
    
    --border-radius: 8px;
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  }
`;

export const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background-color: var(--color-background-subtle);
  box-sizing: border-box;
  width: 100%;
  
  @media (max-height: 900px) {
    align-items: flex-start;
    padding-top: var(--spacing-lg);
    padding-bottom: var(--spacing-lg);
  }
  
  @media (max-width: 768px) {
    padding: var(--spacing-md);
    min-height: 100vh;
  }
  
  @media (max-width: 480px) {
    padding: var(--spacing-sm);
  }
`;

export const Card = styled.div`
  background: var(--color-background);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-2xl);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-sizing: border-box;
  
  @media (max-width: 768px) {
    padding: var(--spacing-xl);
    max-width: 100%;
    max-height: 95vh;
    margin: 0;
  }
  
  @media (max-width: 480px) {
    padding: var(--spacing-lg);
    max-height: 98vh;
    border-radius: var(--spacing-sm);
  }
  
  /* Ensure content doesn't overflow */
  * {
    box-sizing: border-box;
    max-width: 100%;
  }
`;