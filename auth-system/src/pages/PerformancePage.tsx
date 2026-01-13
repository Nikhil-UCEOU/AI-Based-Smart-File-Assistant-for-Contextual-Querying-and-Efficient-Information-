import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import AnimatedBackground from '../components/ui/AnimatedBackground';
import ColorfulCard from '../components/ui/ColorfulCard';
import { SecondaryButton } from '../components/ui/Button';
import { documentService, EnhancedProcessingMetrics } from '../services/documentService';

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const PageContainer = styled.div`
  min-height: 100vh;
  padding: 40px 20px;
  position: relative;
`;

const PageContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
  z-index: 10;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 40px;
  animation: ${fadeInUp} 1s ease-out;
`;

const PageTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const PageSubtitle = styled.p`
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.1rem;
  font-weight: 500;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const MetricCard = styled(ColorfulCard)`
  animation: ${fadeInUp} 1s ease-out 0.2s both;
  text-align: center;
`;

const MetricValue = styled.div`
  font-size: 2.5rem;
  font-weight: 800;
  color: #4facfe;
  margin-bottom: 8px;
`;

const MetricLabel = styled.div`
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
`;

const DetailedMetricsCard = styled(ColorfulCard)`
  animation: ${fadeInUp} 1s ease-out 0.4s both;
  margin-bottom: 30px;
`;

const ProcessingDetails = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const ProcessingDetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  &:last-child {
    border-bottom: none;
  }
`;

const ProcessingDetailLabel = styled.span`
  color: rgba(255, 255, 255, 0.8);
  font-size: 1rem;
  font-weight: 500;
`;

const ProcessingDetailValue = styled.span`
  color: rgba(255, 255, 255, 0.95);
  font-weight: 700;
  font-size: 1rem;
`;

const TrendIndicator = styled.div<{ trend: 'up' | 'down' | 'neutral' }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  background: ${props => {
    switch (props.trend) {
      case 'up': return 'rgba(40, 167, 69, 0.2)';
      case 'down': return 'rgba(220, 53, 69, 0.2)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  }};
  color: ${props => {
    switch (props.trend) {
      case 'up': return '#28a745';
      case 'down': return '#dc3545';
      default: return 'rgba(255, 255, 255, 0.8)';
    }
  }};
  border: 1px solid ${props => {
    switch (props.trend) {
      case 'up': return 'rgba(40, 167, 69, 0.3)';
      case 'down': return 'rgba(220, 53, 69, 0.3)';
      default: return 'rgba(255, 255, 255, 0.2)';
    }
  }};
`;

const BackButton = styled(SecondaryButton)`
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 20;
`;

const LoadingState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.7);
`;

const ErrorState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #dc3545;
  background: rgba(220, 53, 69, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(220, 53, 69, 0.3);
`;

const PerformancePage: React.FC = () => {
  const navigate = useNavigate();
  const [processingMetrics, setProcessingMetrics] = useState<EnhancedProcessingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProcessingMetrics();
  }, []);

  const loadProcessingMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const metrics = await documentService.getProcessingMetrics(30);
      setProcessingMetrics(metrics);
    } catch (error: any) {
      console.error('Failed to load processing metrics:', error);
      setError(error.message || 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  const formatProcessingTime = (timeMs: number) => {
    if (timeMs < 1000) return `${timeMs}ms`;
    return `${(timeMs / 1000).toFixed(2)}s`;
  };

  const formatProcessingRate = (rate: string | number) => {
    const numRate = typeof rate === 'string' ? parseFloat(rate) : rate;
    return `${numRate.toFixed(1)} chunks/sec`;
  };

  const getTrendDirection = (changePercent: number): 'up' | 'down' | 'neutral' => {
    if (Math.abs(changePercent) < 5) return 'neutral';
    return changePercent > 0 ? 'up' : 'down';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <AnimatedBackground />
        <BackButton onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </BackButton>
        <PageContent>
          <LoadingState>
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⏳</div>
            <div style={{ fontSize: '1.2rem' }}>Loading performance data...</div>
          </LoadingState>
        </PageContent>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <AnimatedBackground />
        <BackButton onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </BackButton>
        <PageContent>
          <ErrorState>
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>❌</div>
            <div style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Failed to Load Performance Data</div>
            <div style={{ fontSize: '1rem' }}>{error}</div>
            <div style={{ marginTop: '20px' }}>
              <SecondaryButton 
                onClick={loadProcessingMetrics}
              >
                🔄 Retry
              </SecondaryButton>
            </div>
          </ErrorState>
        </PageContent>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <AnimatedBackground />
      <BackButton onClick={() => navigate('/dashboard')}>
        ← Back to Dashboard
      </BackButton>
      
      <PageContent>
        <Header>
          <PageTitle>📊 Performance Analytics</PageTitle>
          <PageSubtitle>
            Detailed insights into your document processing performance and system metrics
          </PageSubtitle>
        </Header>

        {processingMetrics && (
          <>
            {/* Key Performance Metrics */}
            <MetricsGrid>
              <MetricCard
                title="Documents Processed"
                variant="primary"
                titleColor="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              >
                <MetricValue>{processingMetrics.totalDocuments}</MetricValue>
                <MetricLabel>Last 30 Days</MetricLabel>
              </MetricCard>

              <MetricCard
                title="Total Chunks"
                variant="success"
                titleColor="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
              >
                <MetricValue>{processingMetrics.totalChunks.toLocaleString()}</MetricValue>
                <MetricLabel>Generated</MetricLabel>
              </MetricCard>

              <MetricCard
                title="Avg Processing Time"
                variant="warning"
                titleColor="linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)"
              >
                <MetricValue>{formatProcessingTime(processingMetrics.avgProcessingTime)}</MetricValue>
                <MetricLabel>Per Document</MetricLabel>
              </MetricCard>

              <MetricCard
                title="Processing Rate"
                variant="secondary"
                titleColor="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
              >
                <MetricValue>{formatProcessingRate(processingMetrics.avgProcessingRate)}</MetricValue>
                <MetricLabel>Average Speed</MetricLabel>
              </MetricCard>

              <MetricCard
                title="Chunks per Document"
                variant="primary"
                titleColor="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
              >
                <MetricValue>{processingMetrics.avgChunksPerDocument.toFixed(1)}</MetricValue>
                <MetricLabel>Average</MetricLabel>
              </MetricCard>

              <MetricCard
                title="Recent Activity"
                variant="success"
                titleColor="linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)"
              >
                <MetricValue>{processingMetrics.recentDocuments}</MetricValue>
                <MetricLabel>Last 7 Days</MetricLabel>
              </MetricCard>
            </MetricsGrid>

            {/* Detailed Processing Information */}
            <DetailedMetricsCard
              title="📈 Detailed Processing Analytics"
              variant="primary"
              titleColor="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            >
              <ProcessingDetails>
                <ProcessingDetailRow>
                  <ProcessingDetailLabel>Total Processing Time:</ProcessingDetailLabel>
                  <ProcessingDetailValue>{formatProcessingTime(processingMetrics.totalProcessingTime)}</ProcessingDetailValue>
                </ProcessingDetailRow>

                <ProcessingDetailRow>
                  <ProcessingDetailLabel>Average Chunk Size:</ProcessingDetailLabel>
                  <ProcessingDetailValue>{processingMetrics.avgChunkSize.toLocaleString()} characters</ProcessingDetailValue>
                </ProcessingDetailRow>

                <ProcessingDetailRow>
                  <ProcessingDetailLabel>Average Chunk Overlap:</ProcessingDetailLabel>
                  <ProcessingDetailValue>{processingMetrics.avgChunkOverlap.toLocaleString()} characters</ProcessingDetailValue>
                </ProcessingDetailRow>

                <ProcessingDetailRow>
                  <ProcessingDetailLabel>Embedding Models Used:</ProcessingDetailLabel>
                  <ProcessingDetailValue>{processingMetrics.uniqueEmbeddingModels} different models</ProcessingDetailValue>
                </ProcessingDetailRow>

                <ProcessingDetailRow>
                  <ProcessingDetailLabel>Recent Processing Time:</ProcessingDetailLabel>
                  <ProcessingDetailValue>{formatProcessingTime(processingMetrics.recentProcessingTime)}</ProcessingDetailValue>
                </ProcessingDetailRow>

                <ProcessingDetailRow>
                  <ProcessingDetailLabel>Recent Chunks Generated:</ProcessingDetailLabel>
                  <ProcessingDetailValue>{processingMetrics.recentChunks.toLocaleString()}</ProcessingDetailValue>
                </ProcessingDetailRow>
              </ProcessingDetails>
            </DetailedMetricsCard>

            {/* Performance Trends */}
            {processingMetrics.performanceTrends && (
              <DetailedMetricsCard
                title="📊 Performance Trends"
                variant="warning"
                titleColor="linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)"
              >
                <ProcessingDetails>
                  <ProcessingDetailRow>
                    <ProcessingDetailLabel>Processing Speed Trend:</ProcessingDetailLabel>
                    <ProcessingDetailValue>
                      <TrendIndicator 
                        trend={getTrendDirection(-processingMetrics.performanceTrends.trend.processingTimeChangePercent)}
                      >
                        {getTrendIcon(getTrendDirection(-processingMetrics.performanceTrends.trend.processingTimeChangePercent))}
                        {Math.abs(processingMetrics.performanceTrends.trend.processingTimeChangePercent).toFixed(1)}% 
                        {processingMetrics.performanceTrends.trend.processingTimeChangePercent > 0 ? ' slower' : ' faster'}
                      </TrendIndicator>
                    </ProcessingDetailValue>
                  </ProcessingDetailRow>

                  <ProcessingDetailRow>
                    <ProcessingDetailLabel>Document Volume Change:</ProcessingDetailLabel>
                    <ProcessingDetailValue>
                      <TrendIndicator 
                        trend={getTrendDirection(processingMetrics.performanceTrends.trend.documentsChange)}
                      >
                        {getTrendIcon(getTrendDirection(processingMetrics.performanceTrends.trend.documentsChange))}
                        {processingMetrics.performanceTrends.trend.documentsChange > 0 ? '+' : ''}
                        {processingMetrics.performanceTrends.trend.documentsChange} documents
                      </TrendIndicator>
                    </ProcessingDetailValue>
                  </ProcessingDetailRow>

                  <ProcessingDetailRow>
                    <ProcessingDetailLabel>Chunks Change:</ProcessingDetailLabel>
                    <ProcessingDetailValue>
                      <TrendIndicator 
                        trend={getTrendDirection(processingMetrics.performanceTrends.recentPeriod.totalChunks - processingMetrics.performanceTrends.previousPeriod.totalChunks)}
                      >
                        {getTrendIcon(getTrendDirection(processingMetrics.performanceTrends.recentPeriod.totalChunks - processingMetrics.performanceTrends.previousPeriod.totalChunks))}
                        {processingMetrics.performanceTrends.recentPeriod.totalChunks - processingMetrics.performanceTrends.previousPeriod.totalChunks > 0 ? '+' : ''}
                        {processingMetrics.performanceTrends.recentPeriod.totalChunks - processingMetrics.performanceTrends.previousPeriod.totalChunks} chunks
                      </TrendIndicator>
                    </ProcessingDetailValue>
                  </ProcessingDetailRow>

                  <ProcessingDetailRow>
                    <ProcessingDetailLabel>Analysis Period:</ProcessingDetailLabel>
                    <ProcessingDetailValue>
                      Recent vs Previous Period Comparison
                    </ProcessingDetailValue>
                  </ProcessingDetailRow>
                </ProcessingDetails>
              </DetailedMetricsCard>
            )}

            {/* System Information */}
            <DetailedMetricsCard
              title="🔧 System Information"
              variant="secondary"
              titleColor="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
            >
              <ProcessingDetails>
                <ProcessingDetailRow>
                  <ProcessingDetailLabel>Data Collection Period:</ProcessingDetailLabel>
                  <ProcessingDetailValue>Last 30 days</ProcessingDetailValue>
                </ProcessingDetailRow>

                <ProcessingDetailRow>
                  <ProcessingDetailLabel>Metrics Last Updated:</ProcessingDetailLabel>
                  <ProcessingDetailValue>{new Date().toLocaleString()}</ProcessingDetailValue>
                </ProcessingDetailRow>

                <ProcessingDetailRow>
                  <ProcessingDetailLabel>Processing Efficiency:</ProcessingDetailLabel>
                  <ProcessingDetailValue>
                    {processingMetrics.totalDocuments > 0 
                      ? `${((processingMetrics.totalChunks / processingMetrics.totalDocuments) * 100 / processingMetrics.avgChunksPerDocument).toFixed(1)}%`
                      : 'N/A'
                    }
                  </ProcessingDetailValue>
                </ProcessingDetailRow>

                <ProcessingDetailRow>
                  <ProcessingDetailLabel>Average Document Size:</ProcessingDetailLabel>
                  <ProcessingDetailValue>
                    {processingMetrics.avgChunkSize && processingMetrics.avgChunksPerDocument
                      ? `${((processingMetrics.avgChunkSize * processingMetrics.avgChunksPerDocument) / 1000).toFixed(1)}K chars`
                      : 'N/A'
                    }
                  </ProcessingDetailValue>
                </ProcessingDetailRow>
              </ProcessingDetails>
            </DetailedMetricsCard>
          </>
        )}
      </PageContent>
    </PageContainer>
  );
};

export default PerformancePage;