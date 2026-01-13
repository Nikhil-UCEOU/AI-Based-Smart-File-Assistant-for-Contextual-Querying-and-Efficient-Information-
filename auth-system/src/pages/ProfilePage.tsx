import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styled, { keyframes } from 'styled-components';
import AnimatedBackground from '../components/ui/AnimatedBackground';
import ProfileEditor from '../components/profile/ProfileEditor';
import { SecondaryButton } from '../components/ui/Button';
import { profileService, ProfileUpdateRequest } from '../services/profileService';

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
  padding: 20px;
  position: relative;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`;

const PageContent = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  position: relative;
  z-index: 10;
`;

const Header = styled.div`
  margin-bottom: 32px;
  animation: ${fadeInUp} 1s ease-out;
`;

const Breadcrumb = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
`;

const BreadcrumbLink = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  text-decoration: underline;
  cursor: pointer;
  font-size: inherit;
  padding: 0;
  
  &:hover {
    color: white;
  }
`;

const BreadcrumbSeparator = styled.span`
  color: rgba(255, 255, 255, 0.6);
`;

const PageTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
`;

const BackButton = styled(SecondaryButton)`
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 20;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  backdrop-filter: blur(10px);

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  color: white;
  font-size: 1.2rem;
`;

const ErrorContainer = styled.div`
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  margin: 40px 0;
`;

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (updates: ProfileUpdateRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await profileService.updateProfile(updates);
      
      // Update the user in the auth context
      if (updateUser) {
        updateUser(response.user);
      }
      
    } catch (error: any) {
      setError(error.message || 'Failed to update profile');
      throw error; // Re-throw to let ProfileEditor handle it
    } finally {
      setLoading(false);
    }
  };

  const handlePictureUpload = async (file: File): Promise<string> => {
    try {
      const response = await profileService.uploadProfilePicture(file);
      
      // Update the user in the auth context with new picture URL
      if (updateUser && user) {
        updateUser({
          ...user,
          profilePictureUrl: response.profilePictureUrl
        });
      }
      
      return response.profilePictureUrl;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to upload profile picture');
    }
  };

  const handlePictureRemove = async (): Promise<void> => {
    try {
      await profileService.removeProfilePicture();
      
      // Update the user in the auth context to remove picture URL
      if (updateUser && user) {
        updateUser({
          ...user,
          profilePictureUrl: undefined
        });
      }
      
    } catch (error: any) {
      throw new Error(error.message || 'Failed to remove profile picture');
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  if (!user) {
    return (
      <PageContainer>
        <AnimatedBackground />
        <LoadingContainer>
          Loading profile...
        </LoadingContainer>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <AnimatedBackground />
      <BackButton onClick={handleBackToDashboard}>
        ← Back to Dashboard
      </BackButton>
      
      <PageContent>
        <Header>
          <Breadcrumb>
            <BreadcrumbLink onClick={handleBackToDashboard}>
              Dashboard
            </BreadcrumbLink>
            <BreadcrumbSeparator>›</BreadcrumbSeparator>
            <span>Profile Settings</span>
          </Breadcrumb>
          
          <PageTitle>Profile Settings</PageTitle>
        </Header>

        {error && (
          <ErrorContainer>
            <h3>Error</h3>
            <p>{error}</p>
            <SecondaryButton onClick={() => setError(null)}>
              Dismiss
            </SecondaryButton>
          </ErrorContainer>
        )}

        <ProfileEditor
          user={user}
          onSave={handleSave}
          onCancel={handleCancel}
          onPictureUpload={handlePictureUpload}
          onPictureRemove={handlePictureRemove}
        />
      </PageContent>
    </PageContainer>
  );
};

export default ProfilePage;