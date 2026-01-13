import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import AnimatedBackground from '../components/ui/AnimatedBackground';
import MetricsGrid from '../components/dashboard/MetricsGrid';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import QuickActionsGrid from '../components/dashboard/QuickActionsGrid';
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

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const DashboardContainer = styled.div`
  min-height: 100vh;
  padding: 20px;
  position: relative;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`;

const DashboardContent = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
  z-index: 10;
`;

const Header = styled.div`
  margin-bottom: 32px;
  animation: ${fadeInUp} 1s ease-out;
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 16px;
`;

const WelcomeSection = styled.div`
  flex: 1;
  min-width: 300px;
`;

const WelcomeTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  animation: ${float} 3s ease-in-out infinite;
`;

const WelcomeSubtitle = styled.p`
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.1rem;
  font-weight: 500;
  margin: 0;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
`;

const ProfileSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  padding: 16px 20px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  min-width: 280px;
`;

const ProfilePicture = styled.img`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
`;

const DefaultAvatar = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  
  svg {
    width: 30px;
    height: 30px;
    fill: white;
  }
`;

const ProfileInfo = styled.div`
  flex: 1;
`;

const UserName = styled.h3`
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const UserEmail = styled.p`
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.875rem;
  margin: 0;
  font-weight: 500;
`;

const EditProfileButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }
`;

const MainGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 32px;
  margin-bottom: 32px;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
    gap: 24px;
  }
`;

const LeftColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
`;

const RightColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  position: relative;
`;

const LoadingSpinner = styled.div`
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #4facfe;
  border-radius: 50%;
  animation: ${rotate} 1s linear infinite;
`;

const LoadingText = styled.p`
  color: white;
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 20px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
`;

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [processingMetrics, setProcessingMetrics] = useState<EnhancedProcessingMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadProcessingMetrics();
    }
  }, [user]);

  const loadProcessingMetrics = async () => {
    try {
      setLoading(true);
      const metrics = await documentService.getProcessingMetrics(30);
      setProcessingMetrics(metrics);
    } catch (error) {
      console.error('Failed to load processing metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <LoadingContainer>
        <AnimatedBackground />
        <div style={{ textAlign: 'center', zIndex: 10, position: 'relative' }}>
          <LoadingSpinner />
          <LoadingText>Loading your dashboard...</LoadingText>
        </div>
      </LoadingContainer>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/');
    }
  };

  const handleEditProfile = () => {
    navigate('/profile');
  };

  return (
    <DashboardContainer>
      <AnimatedBackground />
      <DashboardContent>
        <Header>
          <HeaderTop>
            <WelcomeSection>
              <WelcomeTitle>Welcome back, {user.firstName}! 👋</WelcomeTitle>
              <WelcomeSubtitle>
                Here's what's happening with your AI document processing
              </WelcomeSubtitle>
            </WelcomeSection>
            
            <ProfileSection>
              {user.profilePictureUrl ? (
                <ProfilePicture 
                  src={user.profilePictureUrl} 
                  alt="Profile" 
                  onError={() => {
                    console.error('Profile picture failed to load:', user.profilePictureUrl);
                  }}
                />
              ) : (
                <DefaultAvatar>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H5V21H19V9ZM12 12C14.67 12 20 13.34 20 16V18H4V16C4 13.34 9.33 12 12 12Z"/>
                  </svg>
                </DefaultAvatar>
              )}
              <ProfileInfo>
                <UserName>{user.firstName} {user.lastName}</UserName>
                <UserEmail>{user.email}</UserEmail>
              </ProfileInfo>
              <EditProfileButton onClick={handleEditProfile}>
                ✏️ Edit
              </EditProfileButton>
            </ProfileSection>
          </HeaderTop>
        </Header>

        {/* Metrics Overview */}
        <MetricsGrid metrics={processingMetrics} loading={loading} />

        {/* Main Content Grid */}
        <MainGrid>
          <LeftColumn>
            <ActivityFeed />
          </LeftColumn>
          
          <RightColumn>
            <QuickActionsGrid onLogout={handleLogout} />
          </RightColumn>
        </MainGrid>
      </DashboardContent>
    </DashboardContainer>
  );
};

export default DashboardPage;