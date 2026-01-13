import React from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';

const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const ActionsContainer = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  height: fit-content;
`;

const ActionsHeader = styled.div`
  margin-bottom: 20px;
`;

const ActionsTitle = styled.h3`
  color: #111827;
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
`;

const ActionButton = styled.button<{ color: string; delay?: number }>`
  background: ${props => props.color};
  border: none;
  border-radius: 12px;
  padding: 20px 16px;
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: ${slideUp} 0.5s ease-out;
  animation-delay: ${props => props.delay || 0}ms;
  animation-fill-mode: both;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(0);
  }
`;

const ActionIcon = styled.div`
  font-size: 1.5rem;
  margin-bottom: 4px;
`;

const ActionLabel = styled.span`
  line-height: 1.2;
`;

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color: string;
  path?: string;
  onClick?: () => void;
}

interface QuickActionsGridProps {
  onLogout?: () => void;
}

export const QuickActionsGrid: React.FC<QuickActionsGridProps> = ({ onLogout }) => {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    {
      id: 'upload',
      label: 'Upload Documents',
      icon: '📤',
      color: 'linear-gradient(135deg, #667eea, #764ba2)',
      path: '/upload-documents'
    },
    {
      id: 'search',
      label: 'Search Documents',
      icon: '🔍',
      color: 'linear-gradient(135deg, #11998e, #38ef7d)',
      path: '/search-documents'
    },
    {
      id: 'chat',
      label: 'AI Assistant',
      icon: '🤖',
      color: 'linear-gradient(135deg, #4facfe, #00f2fe)',
      path: '/chat'
    },
    {
      id: 'performance',
      label: 'Analytics',
      icon: '📊',
      color: 'linear-gradient(135deg, #ff6b6b, #feca57)',
      path: '/performance'
    },
    {
      id: 'profile',
      label: 'Edit Profile',
      icon: '👤',
      color: 'linear-gradient(135deg, #f093fb, #f5576c)',
      path: '/profile'
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: '🚪',
      color: 'linear-gradient(135deg, #6b7280, #4b5563)',
      onClick: onLogout
    }
  ];

  const handleActionClick = (action: QuickAction) => {
    if (action.onClick) {
      action.onClick();
    } else if (action.path) {
      navigate(action.path);
    }
  };

  return (
    <ActionsContainer>
      <ActionsHeader>
        <ActionsTitle>
          ⚡ Quick Actions
        </ActionsTitle>
      </ActionsHeader>

      <ActionsGrid>
        {actions.map((action, index) => (
          <ActionButton
            key={action.id}
            color={action.color}
            delay={index * 100}
            onClick={() => handleActionClick(action)}
          >
            <ActionIcon>{action.icon}</ActionIcon>
            <ActionLabel>{action.label}</ActionLabel>
          </ActionButton>
        ))}
      </ActionsGrid>
    </ActionsContainer>
  );
};

export default QuickActionsGrid;