import React from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { GradientButton, SecondaryButton } from '../components/ui/Button';
import AnimatedBackground from '../components/ui/AnimatedBackground';

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

const fadeInLeft = keyframes`
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const fadeInRight = keyframes`
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const bounce = keyframes`
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  60% { transform: translateY(-5px); }
`;

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const LandingContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-x: hidden;
`;

const Header = styled.header`
  padding: 20px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  z-index: 10;
  animation: ${fadeInUp} 1s ease-out;
`;

const Logo = styled.div`
  font-size: 28px;
  font-weight: 800;
  color: white;
  display: flex;
  align-items: center;
  gap: 12px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  animation: ${fadeInLeft} 1s ease-out 0.2s both;

  .icon {
    animation: ${rotate} 20s linear infinite;
    font-size: 32px;
  }
`;

const NavButtons = styled.div`
  display: flex;
  gap: 16px;
  animation: ${fadeInRight} 1s ease-out 0.4s both;
`;

const NavButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 12px 24px;
  border-radius: 25px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.9);
    color: #667eea;
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }
`;

const HeroSection = styled.section`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  text-align: center;
  position: relative;
  z-index: 5;
`;

const HeroContent = styled.div`
  max-width: 1200px;
  color: white;
  animation: ${fadeInUp} 1s ease-out 0.6s both;
`;

const Title = styled.h1`
  font-size: 4rem;
  font-weight: 800;
  margin-bottom: 24px;
  line-height: 1.2;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 50%, #e0f2fe 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ${fadeInUp} 1s ease-out 0.8s both;
  
  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const Subtitle = styled.p`
  font-size: 1.4rem;
  margin-bottom: 40px;
  opacity: 0.95;
  line-height: 1.6;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  animation: ${fadeInUp} 1s ease-out 1s both;
  
  @media (max-width: 768px) {
    font-size: 1.1rem;
  }
`;

const CTAButtons = styled.div`
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 60px;
  animation: ${fadeInUp} 1s ease-out 1.2s both;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
  }
`;

const AnimatedCTA = styled(GradientButton)`
  animation: ${bounce} 2s ease-in-out infinite;
  animation-delay: 2s;
  font-size: 18px;
  padding: 18px 36px;
  border-radius: 30px;
  text-transform: uppercase;
  letter-spacing: 1px;
  
  &:hover {
    animation-play-state: paused;
  }
`;

const SecondaryAnimatedButton = styled(SecondaryButton)`
  font-size: 18px;
  padding: 18px 36px;
  border-radius: 30px;
  text-transform: uppercase;
  letter-spacing: 1px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  
  &:hover {
    background: rgba(255, 255, 255, 0.9);
    color: #667eea;
  }
`;

const FeaturesSection = styled.section`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  padding: 100px 40px;
  position: relative;
  z-index: 5;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
`;

const FeaturesContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const FeaturesTitle = styled.h2`
  font-size: 3rem;
  color: white;
  text-align: center;
  margin-bottom: 60px;
  font-weight: 700;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ${fadeInUp} 1s ease-out;
`;

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 40px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FeatureCard = styled.div<{ delay: number }>`
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  border-radius: 25px;
  padding: 40px 30px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.4s ease;
  position: relative;
  overflow: hidden;
  animation: ${fadeInUp} 1s ease-out ${props => props.delay}s both;
  
  &:hover {
    transform: translateY(-10px) scale(1.02);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    background: rgba(255, 255, 255, 0.2);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #4facfe, #00f2fe, #667eea, #764ba2);
    background-size: 200% 100%;
    animation: shimmer 3s linear infinite;
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

const FeatureIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 20px;
  animation: ${bounce} 2s ease-in-out infinite;
  animation-delay: 1s;
`;

const FeatureTitle = styled.h3`
  font-size: 1.6rem;
  color: white;
  margin-bottom: 16px;
  font-weight: 700;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
`;

const FeatureDescription = styled.p`
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.6;
  font-size: 1rem;
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.2);
`;

const Footer = styled.footer`
  background: rgba(0, 0, 0, 0.3);
  padding: 60px 40px;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  position: relative;
  z-index: 5;
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const FooterContent = styled.div`
  max-width: 800px;
  margin: 0 auto;
  animation: ${fadeInUp} 1s ease-out;
`;

const FooterTitle = styled.h3`
  font-size: 1.5rem;
  margin-bottom: 16px;
  color: white;
  font-weight: 600;
`;

const FooterText = styled.p`
  font-size: 1.1rem;
  line-height: 1.6;
  margin-bottom: 8px;
`;

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: '🤖',
      title: 'AI-Powered Analysis',
      description: 'Advanced AI algorithms analyze your documents and provide intelligent insights. Extract key information and understand document context with precision.'
    },
    {
      icon: '📚',
      title: 'Multi-Document Support',
      description: 'Upload and process multiple document formats including PDF, DOCX, HTML, and TXT files. Handle large document collections efficiently.'
    },
    {
      icon: '🔍',
      title: 'Smart Context Queries',
      description: 'Ask intelligent questions about your documents and get precise answers with relevant context and source references.'
    },
    {
      icon: '📖',
      title: 'Source Tracking',
      description: 'Every response includes precise source references with document names, sections, and chunk references for complete transparency.'
    },
    {
      icon: '🔒',
      title: 'Secure Processing',
      description: 'Your documents are processed securely with enterprise-grade encryption. Complete confidentiality for sensitive materials.'
    },
    {
      icon: '⚡',
      title: 'Instant Analysis',
      description: 'Get immediate analysis and information extraction from your document database with lightning-fast response times.'
    }
  ];

  return (
    <LandingContainer>
      <AnimatedBackground />
      
      <Header>
        <Logo>
          <span className="icon">🤖</span>
          AI Document Assistant
        </Logo>
        <NavButtons>
          <NavButton onClick={() => navigate('/login')}>
            Sign In
          </NavButton>
          <NavButton onClick={() => navigate('/signup')}>
            Sign Up
          </NavButton>
        </NavButtons>
      </Header>

      <HeroSection>
        <HeroContent>
          <Title>
            AI Based Smart File Assistant
          </Title>
          <Subtitle>
            Your intelligent document processing companion powered by AI. Upload, analyze, and extract information from multiple documents with smart context queries and efficient information retrieval.
          </Subtitle>
          <CTAButtons>
            <AnimatedCTA onClick={() => navigate('/signup')}>
              🚀 Get Started Free
            </AnimatedCTA>
            <SecondaryAnimatedButton onClick={() => navigate('/login')}>
              🔑 Sign In
            </SecondaryAnimatedButton>
          </CTAButtons>
        </HeroContent>
      </HeroSection>

      <FeaturesSection>
        <FeaturesContainer>
          <FeaturesTitle>
            Powerful Document Processing Features
          </FeaturesTitle>
          <FeaturesGrid>
            {features.map((feature, index) => (
              <FeatureCard key={index} delay={index * 0.2}>
                <FeatureIcon>{feature.icon}</FeatureIcon>
                <FeatureTitle>{feature.title}</FeatureTitle>
                <FeatureDescription>{feature.description}</FeatureDescription>
              </FeatureCard>
            ))}
          </FeaturesGrid>
        </FeaturesContainer>
      </FeaturesSection>

      <Footer>
        <FooterContent>
          <FooterTitle>Ready to Transform Your Document Processing?</FooterTitle>
          <FooterText>&copy; 2024 AI Based Smart File Assistant. All rights reserved.</FooterText>
          <FooterText>Empowering intelligent document analysis with AI-powered information extraction.</FooterText>
          <FooterText style={{ fontSize: '0.9rem', marginTop: '16px', opacity: 0.7 }}>
            <strong>Note:</strong> This tool is designed for document analysis and information extraction. 
            Always verify important information from original sources.
          </FooterText>
        </FooterContent>
      </Footer>
    </LandingContainer>
  );
};

export default LandingPage;