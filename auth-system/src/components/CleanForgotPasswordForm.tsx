import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { cleanAuthService } from '../services/cleanAuthService';
import { PrimaryButton, SecondaryButton } from './ui/Button';
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

const SuccessMessage = styled.div`
  background: rgba(17, 153, 142, 0.1);
  border: 1px solid rgba(17, 153, 142, 0.3);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  color: #059669;
  text-align: center;
  backdrop-filter: blur(10px);
`;

const BackToLoginLink = styled(Link)`
  font-size: 14px;
  color: #4f46e5;
  text-decoration: none;
  text-align: center;
  margin-top: 16px;
  font-weight: 600;
  transition: all 0.3s ease;
  
  &:hover {
    color: #3730a3;
    text-decoration: underline;
  }
`;

const CleanForgotPasswordForm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorType | null>(null);
  const [fieldError, setFieldError] = useState<ErrorType | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');

  const validateEmail = (value: string): ErrorType | null => {
    if (!value.trim()) return 'MISSING_EMAIL';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'INVALID_EMAIL_FORMAT';
    return null;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    
    // Clear errors when user starts typing
    if (fieldError) setFieldError(null);
    if (error) setError(null);
  };

  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const emailError = validateEmail(e.target.value);
    setFieldError(emailError);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const emailError = validateEmail(email);
    setFieldError(emailError);
    
    if (emailError) {
      return;
    }

    setLoading(true);

    try {
      await cleanAuthService.requestPasswordReset(email);
      setSubmittedEmail(email);
      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      
      if (err.message.includes('not found') || err.message.includes('does not exist')) {
        setError('ACCOUNT_NOT_FOUND');
      } else if (err.message.includes('network') || err.message.includes('fetch')) {
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
      case 'navigate:/signup':
        window.location.href = '/signup';
        break;
      case 'focus:email':
        (document.querySelector('input[name="email"]') as HTMLInputElement)?.focus();
        break;
      case 'retry':
        handleSubmit(new Event('submit') as any);
        break;
      case 'dismiss':
        setError(null);
        break;
    }
  };

  if (success) {
    return (
      <FormContainer>
        <Title>Check Your Email 📧</Title>
        <SuccessMessage>
          We've sent password reset instructions to <strong>{submittedEmail}</strong>.
          <br />
          Please check your email and follow the link to reset your password.
        </SuccessMessage>
        
        <Description>
          Didn't receive the email? Check your spam folder or try again with a different email address.
        </Description>

        <SecondaryButton
          type="button"
          fullWidth
          onClick={() => setSuccess(false)}
          animated
        >
          🔄 Try Different Email
        </SecondaryButton>

        <BackToLoginLink to="/login">
          ← Back to Sign In
        </BackToLoginLink>
      </FormContainer>
    );
  }

  return (
    <FormContainer>
      <Title>Forgot Password? 🔐</Title>
      <Description>
        No worries! Enter your email address and we'll send you a link to reset your password.
      </Description>
      
      {error && (
        <ActionableError
          error={getErrorMessage(error)}
          onAction={handleErrorAction}
        />
      )}
      
      <Form onSubmit={handleSubmit}>
        <ColorfulInput
          label="Email Address"
          type="email"
          name="email"
          value={email}
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
          placeholder="Enter your email address"
          leftIcon="📧"
          error={fieldError ? getErrorMessage(fieldError).message : undefined}
          required
        />
        
        <PrimaryButton
          type="submit"
          fullWidth
          loading={loading}
          disabled={loading}
          animated
        >
          {loading ? 'Sending...' : '🚀 Send Reset Link'}
        </PrimaryButton>
      </Form>
      
      <BackToLoginLink to="/login">
        ← Back to Sign In
      </BackToLoginLink>
    </FormContainer>
  );
};

export default CleanForgotPasswordForm;