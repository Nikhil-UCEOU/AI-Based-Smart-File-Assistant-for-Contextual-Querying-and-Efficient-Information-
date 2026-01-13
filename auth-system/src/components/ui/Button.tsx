import React from 'react';
import styled, { css, keyframes } from 'styled-components';

const ripple = keyframes`
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'gradient';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  animated?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

const ButtonBase = styled.button<ButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: 12px;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  box-sizing: border-box;
  min-width: 0;
  position: relative;
  overflow: hidden;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    transform: none !important;
  }
  
  &:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }

  &:not(:disabled):active {
    transform: translateY(0);
  }

  ${props => props.animated && css`
    animation: ${pulse} 2s ease-in-out infinite;
  `}
  
  ${props => props.fullWidth && css`
    width: 100%;
  `}
  
  ${props => {
    switch (props.size) {
      case 'small':
        return css`
          padding: 8px 16px;
          font-size: 14px;
          border-radius: 8px;
        `;
      case 'large':
        return css`
          padding: 16px 32px;
          font-size: 18px;
          border-radius: 16px;
        `;
      default:
        return css`
          padding: 12px 24px;
          font-size: 16px;
        `;
    }
  }}
  
  ${props => {
    switch (props.variant) {
      case 'secondary':
        return css`
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          
          &:hover:not(:disabled) {
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
          }
        `;
      case 'success':
        return css`
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(17, 153, 142, 0.4);
          
          &:hover:not(:disabled) {
            box-shadow: 0 8px 25px rgba(17, 153, 142, 0.6);
          }
        `;
      case 'warning':
        return css`
          background: linear-gradient(135deg, #ff6b6b 0%, #ffa726 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
          
          &:hover:not(:disabled) {
            box-shadow: 0 8px 25px rgba(255, 107, 107, 0.6);
          }
        `;
      case 'danger':
        return css`
          background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(255, 65, 108, 0.4);
          
          &:hover:not(:disabled) {
            box-shadow: 0 8px 25px rgba(255, 65, 108, 0.6);
          }
        `;
      case 'gradient':
        return css`
          background: linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%);
          background-size: 200% 200%;
          color: white;
          box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
          animation: ${shimmer} 3s ease infinite;
          
          &:hover:not(:disabled) {
            box-shadow: 0 8px 25px rgba(79, 172, 254, 0.6);
          }
        `;
      default:
        return css`
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
          
          &:hover:not(:disabled) {
            box-shadow: 0 8px 25px rgba(79, 172, 254, 0.6);
          }
        `;
    }
  }}

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: translate(-50%, -50%);
    transition: width 0.6s, height 0.6s;
  }

  &:not(:disabled):active::before {
    width: 300px;
    height: 300px;
    animation: ${ripple} 0.6s ease-out;
  }
`;

const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const ButtonIcon = styled.span`
  display: flex;
  align-items: center;
  font-size: 1.2em;
`;

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  loading, 
  variant, 
  disabled,
  animated,
  ...props 
}) => {
  return (
    <ButtonBase 
      variant={variant} 
      disabled={disabled || loading}
      animated={animated}
      {...props}
    >
      {loading && <LoadingSpinner />}
      {children}
    </ButtonBase>
  );
};

// Specific button variants for common use cases
export const PrimaryButton = styled(Button).attrs({ variant: 'primary' })``;
export const SecondaryButton = styled(Button).attrs({ variant: 'secondary' })``;
export const SuccessButton = styled(Button).attrs({ variant: 'success' })``;
export const WarningButton = styled(Button).attrs({ variant: 'warning' })``;
export const DangerButton = styled(Button).attrs({ variant: 'danger' })``;
export const GradientButton = styled(Button).attrs({ variant: 'gradient' })``;