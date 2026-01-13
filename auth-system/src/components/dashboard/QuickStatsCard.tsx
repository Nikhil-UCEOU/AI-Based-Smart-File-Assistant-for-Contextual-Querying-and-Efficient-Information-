import React from 'react';
import styled, { keyframes } from 'styled-components';

const countUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
`;

const CardContainer = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  animation: ${countUp} 0.6s ease-out;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: ${props => props.color || 'linear-gradient(90deg, #4facfe, #00f2fe)'};
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const CardTitle = styled.h3`
  color: #374151;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
`;

const CardIcon = styled.div`
  font-size: 1.5rem;
  opacity: 0.8;
`;

const ValueContainer = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
`;

const CardValue = styled.div`
  color: #111827;
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 1;
  animation: ${pulse} 2s ease-in-out infinite;
`;

const TrendContainer = styled.div<{ trend: 'up' | 'down' | 'neutral' }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${props => {
    switch (props.trend) {
      case 'up': return 'rgba(34, 197, 94, 0.1)';
      case 'down': return 'rgba(239, 68, 68, 0.1)';
      default: return 'rgba(107, 114, 128, 0.1)';
    }
  }};
  color: ${props => {
    switch (props.trend) {
      case 'up': return '#059669';
      case 'down': return '#dc2626';
      default: return '#6b7280';
    }
  }};
`;

const TrendIcon = styled.span`
  font-size: 0.875rem;
`;

const Description = styled.p`
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
  line-height: 1.4;
`;

interface QuickStatsCardProps {
  title: string;
  value: number | string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: string;
  color?: string;
  description?: string;
  delay?: number;
}

export const QuickStatsCard: React.FC<QuickStatsCardProps> = ({
  title,
  value,
  trend = 'neutral',
  trendValue,
  icon,
  color,
  description,
  delay = 0
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  const formatValue = (val: number | string) => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      } else if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <CardContainer 
      color={color}
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardIcon>{icon}</CardIcon>
      </CardHeader>
      
      <ValueContainer>
        <CardValue>{formatValue(value)}</CardValue>
        {trendValue && (
          <TrendContainer trend={trend}>
            <TrendIcon>{getTrendIcon()}</TrendIcon>
            {trendValue}
          </TrendContainer>
        )}
      </ValueContainer>
      
      {description && <Description>{description}</Description>}
    </CardContainer>
  );
};

export default QuickStatsCard;