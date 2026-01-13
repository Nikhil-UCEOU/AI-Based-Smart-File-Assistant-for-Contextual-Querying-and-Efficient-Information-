import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { activityService, Activity as ActivityType } from '../../services/activityService';

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const FeedContainer = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  height: fit-content;
`;

const FeedHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const FeedTitle = styled.h3`
  color: #111827;
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ViewAllButton = styled.button`
  background: none;
  border: none;
  color: #4f46e5;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(79, 70, 229, 0.1);
  }
`;

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 400px;
  overflow-y: auto;
`;

const ActivityItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
  animation: ${slideIn} 0.4s ease-out;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
    transform: translateX(4px);
  }
`;

const ActivityIcon = styled.div<{ type: string; color?: string }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
  background: ${props => props.color || 'linear-gradient(135deg, #6b7280, #4b5563)'};
  color: white;
`;

const ActivityContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActivityDescription = styled.p`
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  margin: 0 0 4px 0;
  line-height: 1.4;
`;

const ActivityTime = styled.span`
  color: #6b7280;
  font-size: 0.75rem;
  font-weight: 500;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
`;

const EmptyIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 12px;
  opacity: 0.5;
`;

const EmptyText = styled.p`
  font-size: 0.875rem;
  margin: 0;
`;

interface ActivityFeedProps {
  activities?: ActivityType[];
  maxItems?: number;
  onViewAll?: () => void;
  refreshInterval?: number; // Auto-refresh interval in milliseconds
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities: propActivities,
  maxItems = 5,
  onViewAll,
  refreshInterval = 30000 // 30 seconds default
}) => {
  const [displayActivities, setDisplayActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = async () => {
    try {
      setError(null);
      const response = await activityService.getUserActivities(maxItems, 0, 7);
      setDisplayActivities(response.activities);
    } catch (error: any) {
      console.error('Failed to load activities:', error);
      setError(error.message || 'Failed to load activities');
      
      // Fallback to sample data if API fails
      const sampleActivities: ActivityType[] = [
        {
          id: '1',
          userId: 'sample',
          type: 'upload',
          description: 'Uploaded document "Project Requirements.pdf"',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        },
        {
          id: '2',
          userId: 'sample',
          type: 'search',
          description: 'Searched for "budget analysis"',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        },
        {
          id: '3',
          userId: 'sample',
          type: 'chat',
          description: 'Started AI chat session',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        },
      ];
      setDisplayActivities(sampleActivities);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Use prop activities if provided, otherwise load from API
    if (propActivities && propActivities.length > 0) {
      setDisplayActivities(propActivities.slice(0, maxItems));
      setLoading(false);
    } else {
      loadActivities();
    }
  }, [propActivities, maxItems]);

  // Auto-refresh activities
  useEffect(() => {
    if (!propActivities && refreshInterval > 0) {
      const interval = setInterval(loadActivities, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [propActivities, refreshInterval]);

  const getActivityIcon = (type: string) => {
    return activityService.getActivityIcon(type);
  };

  const getActivityColor = (type: string) => {
    return activityService.getActivityColor(type);
  };

  const formatTimeAgo = (timestamp: string) => {
    return activityService.formatTimeAgo(timestamp);
  };

  return (
    <FeedContainer>
      <FeedHeader>
        <FeedTitle>
          📊 Recent Activity
        </FeedTitle>
        {onViewAll && (
          <ViewAllButton onClick={onViewAll}>
            View All
          </ViewAllButton>
        )}
      </FeedHeader>

      {loading ? (
        <EmptyState>
          <EmptyIcon>⏳</EmptyIcon>
          <EmptyText>Loading activities...</EmptyText>
        </EmptyState>
      ) : error ? (
        <EmptyState>
          <EmptyIcon>⚠️</EmptyIcon>
          <EmptyText>Failed to load activities</EmptyText>
        </EmptyState>
      ) : displayActivities.length > 0 ? (
        <ActivityList>
          {displayActivities.map((activity, index) => (
            <ActivityItem 
              key={activity.id}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <ActivityIcon 
                type={activity.type}
                color={getActivityColor(activity.type)}
              >
                {getActivityIcon(activity.type)}
              </ActivityIcon>
              <ActivityContent>
                <ActivityDescription>{activity.description}</ActivityDescription>
                <ActivityTime>{formatTimeAgo(activity.timestamp)}</ActivityTime>
              </ActivityContent>
            </ActivityItem>
          ))}
        </ActivityList>
      ) : (
        <EmptyState>
          <EmptyIcon>📋</EmptyIcon>
          <EmptyText>No recent activity</EmptyText>
        </EmptyState>
      )}
    </FeedContainer>
  );
};

export default ActivityFeed;