import React from 'react';
import styled from 'styled-components';
import QuickStatsCard from './QuickStatsCard';
import { EnhancedProcessingMetrics } from '../../services/documentService';

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
`;

const LoadingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
`;

const LoadingCard = styled.div`
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  
  .loading-header {
    height: 16px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
    border-radius: 4px;
    margin-bottom: 16px;
  }
  
  .loading-value {
    height: 36px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
    border-radius: 4px;
    margin-bottom: 12px;
  }
  
  .loading-description {
    height: 12px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
    border-radius: 4px;
    width: 70%;
  }
  
  @keyframes loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

interface MetricsGridProps {
  metrics: EnhancedProcessingMetrics | null;
  loading: boolean;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics, loading }) => {
  if (loading) {
    return (
      <LoadingGrid>
        {[...Array(4)].map((_, index) => (
          <LoadingCard key={index}>
            <div className="loading-header" />
            <div className="loading-value" />
            <div className="loading-description" />
          </LoadingCard>
        ))}
      </LoadingGrid>
    );
  }

  if (!metrics) {
    return (
      <GridContainer>
        <QuickStatsCard
          title="Documents"
          value={0}
          icon="📄"
          color="linear-gradient(90deg, #667eea, #764ba2)"
          description="Total documents processed"
        />
        <QuickStatsCard
          title="Chunks"
          value={0}
          icon="🧩"
          color="linear-gradient(90deg, #11998e, #38ef7d)"
          description="Text chunks generated"
        />
        <QuickStatsCard
          title="Processing"
          value="0ms"
          icon="⚡"
          color="linear-gradient(90deg, #ff6b6b, #feca57)"
          description="Average processing time"
        />
        <QuickStatsCard
          title="Recent"
          value={0}
          icon="🕒"
          color="linear-gradient(90deg, #4facfe, #00f2fe)"
          description="Documents this week"
        />
      </GridContainer>
    );
  }

  const formatProcessingTime = (timeMs: number) => {
    if (timeMs < 1000) return `${timeMs}ms`;
    return `${(timeMs / 1000).toFixed(1)}s`;
  };

  const calculateTrend = (current: number, previous: number): { trend: 'up' | 'down' | 'neutral'; value: string } => {
    if (!previous || previous === 0) return { trend: 'neutral', value: 'New' };
    
    const change = ((current - previous) / previous) * 100;
    if (Math.abs(change) < 5) return { trend: 'neutral', value: `${change.toFixed(1)}%` };
    
    return {
      trend: change > 0 ? 'up' : 'down',
      value: `${Math.abs(change).toFixed(1)}%`
    };
  };

  // Calculate trends if performance data is available
  const documentsTrend = metrics.performanceTrends 
    ? calculateTrend(metrics.totalDocuments, metrics.performanceTrends.previousPeriod.documents)
    : { trend: 'neutral' as const, value: undefined };

  const chunksTrend = metrics.performanceTrends
    ? calculateTrend(metrics.totalChunks, metrics.performanceTrends.previousPeriod.totalChunks)
    : { trend: 'neutral' as const, value: undefined };

  const processingTrend = metrics.performanceTrends
    ? calculateTrend(metrics.avgProcessingTime, metrics.performanceTrends.previousPeriod.avgProcessingTime)
    : { trend: 'neutral' as const, value: undefined };

  return (
    <GridContainer>
      <QuickStatsCard
        title="Total Documents"
        value={metrics.totalDocuments}
        trend={documentsTrend.trend}
        trendValue={documentsTrend.value}
        icon="📄"
        color="linear-gradient(90deg, #667eea, #764ba2)"
        description="Documents processed in last 30 days"
        delay={0}
      />
      
      <QuickStatsCard
        title="Text Chunks"
        value={metrics.totalChunks}
        trend={chunksTrend.trend}
        trendValue={chunksTrend.value}
        icon="🧩"
        color="linear-gradient(90deg, #11998e, #38ef7d)"
        description="Generated for AI processing"
        delay={100}
      />
      
      <QuickStatsCard
        title="Avg Processing"
        value={formatProcessingTime(metrics.avgProcessingTime)}
        trend={processingTrend.trend === 'up' ? 'down' : processingTrend.trend === 'down' ? 'up' : 'neutral'}
        trendValue={processingTrend.value}
        icon="⚡"
        color="linear-gradient(90deg, #ff6b6b, #feca57)"
        description="Time per document"
        delay={200}
      />
      
      <QuickStatsCard
        title="Recent Activity"
        value={metrics.recentDocuments}
        icon="🕒"
        color="linear-gradient(90deg, #4facfe, #00f2fe)"
        description="Documents uploaded this week"
        delay={300}
      />
    </GridContainer>
  );
};

export default MetricsGrid;