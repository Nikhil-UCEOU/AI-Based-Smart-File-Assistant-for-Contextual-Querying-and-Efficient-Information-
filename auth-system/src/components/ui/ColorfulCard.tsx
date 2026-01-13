import React from 'react';
import styled, { keyframes } from 'styled-components';

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(79, 172, 254, 0.2), 0 8px 32px rgba(0, 0, 0, 0.3); }
  50% { box-shadow: 0 0 40px rgba(79, 172, 254, 0.4), 0 0 60px rgba(240, 147, 251, 0.2), 0 8px 32px rgba(0, 0, 0, 0.3); }
`;

const CardContainer = styled.div<{ variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'white' }>`
  background: ${props => props.variant === 'white' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.3)'};
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 40px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 0 1px ${props => props.variant === 'white' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'};
  border: 1px solid ${props => props.variant === 'white' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)'};
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  animation: ${glow} 4s ease-in-out infinite;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 
      0 20px 40px rgba(0, 0, 0, 0.4),
      0 0 0 1px ${props => props.variant === 'white' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)'};
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: ${props => {
      switch(props.variant) {
        case 'primary': return 'linear-gradient(90deg, #4facfe, #00f2fe)';
        case 'secondary': return 'linear-gradient(90deg, #667eea, #764ba2)';
        case 'success': return 'linear-gradient(90deg, #11998e, #38ef7d)';
        case 'warning': return 'linear-gradient(90deg, #ff6b6b, #ffa726)';
        case 'white': return 'linear-gradient(90deg, #4facfe, #00f2fe)';
        default: return 'linear-gradient(90deg, #4facfe, #00f2fe)';
      }
    }};
    background-size: 200% 100%;
    animation: ${shimmer} 2s linear infinite;
  }

  &::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, ${props => props.variant === 'white' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)'} 0%, transparent 70%);
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }

  &:hover::after {
    opacity: 1;
  }
`;

const CardHeader = styled.div`
  margin-bottom: 24px;
  text-align: center;
`;

const CardTitle = styled.h2<{ color?: string }>`
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  background: ${props => props.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-align: center;
`;

const CardSubtitle = styled.p<{ $isWhite?: boolean }>`
  color: ${props => props.$isWhite ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.8)'};
  font-size: 16px;
  margin: 0;
  text-align: center;
`;

const CardContent = styled.div`
  position: relative;
  z-index: 1;
`;

interface ColorfulCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'white';
  titleColor?: string;
  className?: string;
}

export const ColorfulCard: React.FC<ColorfulCardProps> = ({
  children,
  title,
  subtitle,
  variant = 'primary',
  titleColor,
  className
}) => {
  return (
    <CardContainer variant={variant} className={className}>
      {(title || subtitle) && (
        <CardHeader>
          {title && <CardTitle color={titleColor}>{title}</CardTitle>}
          {subtitle && <CardSubtitle $isWhite={variant === 'white'}>{subtitle}</CardSubtitle>}
        </CardHeader>
      )}
      <CardContent>
        {children}
      </CardContent>
    </CardContainer>
  );
};

export default ColorfulCard;