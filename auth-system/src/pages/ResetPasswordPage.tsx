import React from 'react';
import styled, { keyframes } from 'styled-components';
import CleanResetPasswordForm from '../components/CleanResetPasswordForm';
import AnimatedBackground from '../components/ui/AnimatedBackground';
import ColorfulCard from '../components/ui/ColorfulCard';

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

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
`;

const ResetPasswordContainer = styled.div`
  width: 100%;
  max-width: 450px;
  animation: ${fadeInUp} 1s ease-out;
  position: relative;
  z-index: 10;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 30px;
  animation: ${float} 3s ease-in-out infinite;
`;

const IconContainer = styled.div`
  font-size: 4rem;
  margin-bottom: 16px;
  animation: ${rotate} 10s linear infinite;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
`;

const Subtitle = styled.p`
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.1rem;
  font-weight: 500;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  line-height: 1.5;
`;

const StyledCard = styled(ColorfulCard)`
  backdrop-filter: blur(25px);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.1);
`;

const ResetPasswordPage: React.FC = () => {
  return (
    <PageContainer>
      <AnimatedBackground />
      <ResetPasswordContainer>
        <Header>
          <IconContainer>🔄</IconContainer>
          <Title>Reset Password</Title>
          <Subtitle>
            Create a new secure password for your AI assistant account.
          </Subtitle>
        </Header>
        <StyledCard variant="success">
          <CleanResetPasswordForm />
        </StyledCard>
      </ResetPasswordContainer>
    </PageContainer>
  );
};

export default ResetPasswordPage;