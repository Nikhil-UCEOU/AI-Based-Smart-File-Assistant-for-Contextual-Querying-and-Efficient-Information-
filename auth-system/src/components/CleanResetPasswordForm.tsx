import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { cleanAuthService } from '../services/cleanAuthService';
import { PrimaryButton } from './ui/Button';
import ColorfulInput from './ui/ColorfulInput';
import { getErrorMessage, ErrorType } from '../utils/ErrorDictionary';
import { ActionableError } from './ui/ActionableError';

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const FormContainer = styled.div`
  width: 100%;
  animation: ${fadeInUp} 1s ease-out;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Title = styled.h2`
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 8px;
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const Description = styled.p`
  color: #6b7280;
  font-size: 1rem;
  text-align: center;
  margin-bottom: 24px;
  line-height: 1.6;
`;

const UserInfo = styled.div`
  background: rgba(79, 172, 254, 0.1);
  border: 1px solid rgba(79, 172, 254, 0.3);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  text-align: center;
  color: #1e40af;
  font-weight: 500;
  backdrop-filter: blur(10px);
`;

const BackToLoginLink = styled.a`
  font-size: 14px;
  color: #4f46e5;
  text-decoration: none;
  text-align: center;
  margin-top: 16px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  
  &:hover {
    color: #3730a3;
    text-decoration: underline;
  }
`;

const CleanResetPasswordForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorType | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [userInfo, setUserInfo] = useState<{ email: string; firstName: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, ErrorType | null>>({
    newPassword: null,
    confirmPassword: null
  });
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const token = searchParams.get('token');

  const validateField = (name: string, value: string): ErrorType | null => {
    switch (name) {
      case 'newPassword':
        if (!value) return 'MISSING_PASSWORD';
        if (value.length < 8) return 'PASSWORD_TOO_SHORT';
        return null;
      case 'confirmPassword':
        if (!value) return 'MISSING_CONFIRM_PASSWORD';
        if (value !== formData.newPassword) return 'PASSWORDS_DONT_MATCH';
        return null;
      default:
        return null;
    }
  };

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('UNEXPECTED_ERROR');
        setTokenValid(false);
        return;
      }

      try {
        const userData = await cleanAuthService.verifyResetToken(token);
        setUserInfo(userData);
        setTokenValid(true);
      } catch (error: any) {
        setError('UNEXPECTED_ERROR');
        setTokenValid(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors({
        ...fieldErrors,
        [name]: null
      });
    }
    
    // Clear general error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const fieldError = validateField(name, value);
    
    setFieldErrors({
      ...fieldErrors,
      [name]: fieldError
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('UNEXPECTED_ERROR');
      return;
    }

    // Validate all fields
    const newPasswordError = validateField('newPassword', formData.newPassword);
    const confirmPasswordError = validateField('confirmPassword', formData.confirmPassword);
    
    setFieldErrors({
      newPassword: newPasswordError,
      confirmPassword: confirmPasswordError
    });

    if (newPasswordError || confirmPasswordError) {
      return;
    }

    setLoading(true);

    try {
      await cleanAuthService.resetPassword(token, formData.newPassword);
      
      // Show success and redirect
      alert('Password reset successfully! Please sign in with your new password.');
      navigate('/login');
    } catch (error: any) {
      console.error('Reset password error:', error);
      
      if (error.message.includes('network') || error.message.includes('fetch')) {
        setError('NETWORK_ERROR');
      } else {
        setError('UNEXPECTED_ERROR');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleErrorAction = (action: string) => {
    switch (action) {
      case 'retry':
        handleSubmit(new Event('submit') as any);
        break;
      case 'refresh':
        window.location.reload();
        break;
      case 'dismiss':
        setError(null);
        break;
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  if (tokenValid === null) {
    return (
      <FormContainer>
        <Title>Verifying Reset Link... ⏳</Title>
        <Description>Please wait while we verify your password reset link.</Description>
      </FormContainer>
    );
  }

  if (tokenValid === false) {
    return (
      <FormContainer>
        <Title>Invalid Reset Link ❌</Title>
        {error && (
          <ActionableError
            error={getErrorMessage(error)}
            onAction={handleErrorAction}
          />
        )}
        <Description>
          Please request a new password reset link to continue.
        </Description>
        <PrimaryButton
          type="button"
          fullWidth
          onClick={handleBackToLogin}
          animated
        >
          🔙 Back to Sign In
        </PrimaryButton>
      </FormContainer>
    );
  }

  return (
    <FormContainer>
      <Title>Reset Your Password 🔐</Title>
      <Description>
        Enter your new password below. Make sure it's strong and secure.
      </Description>

      {userInfo && (
        <UserInfo>
          Resetting password for <strong>{userInfo.email}</strong>
        </UserInfo>
      )}
      
      {error && (
        <ActionableError
          error={getErrorMessage(error)}
          onAction={handleErrorAction}
        />
      )}
      
      <Form onSubmit={handleSubmit}>
        <ColorfulInput
          label="New Password"
          type="password"
          name="newPassword"
          value={formData.newPassword}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder="Enter your new password"
          leftIcon="🔒"
          error={fieldErrors.newPassword ? getErrorMessage(fieldErrors.newPassword).message : undefined}
          required
        />

        <ColorfulInput
          label="Confirm New Password"
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder="Confirm your new password"
          leftIcon="🔒"
          error={fieldErrors.confirmPassword ? getErrorMessage(fieldErrors.confirmPassword).message : undefined}
          required
        />
        
        <PrimaryButton
          type="submit"
          fullWidth
          loading={loading}
          disabled={loading}
          animated
        >
          {loading ? 'Resetting Password...' : '🚀 Reset Password'}
        </PrimaryButton>
      </Form>
      
      <BackToLoginLink onClick={handleBackToLogin}>
        ← Back to Sign In
      </BackToLoginLink>
    </FormContainer>
  );
};

export default CleanResetPasswordForm;