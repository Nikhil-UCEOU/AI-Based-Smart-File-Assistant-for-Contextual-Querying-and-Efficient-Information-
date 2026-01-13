import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { PrimaryButton } from './ui/Button';
import ColorfulInput from './ui/ColorfulInput';
import { useAuth } from '../contexts/AuthContext';
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

const Subtitle = styled.p`
  color: #6b7280;
  font-size: 1rem;
  margin-bottom: 24px;
  text-align: center;
`;

const ForgotPasswordLink = styled(Link)`
  font-size: 14px;
  color: #4f46e5;
  text-decoration: none;
  text-align: right;
  font-weight: 600;
  transition: all 0.3s ease;
  
  &:hover {
    color: #3730a3;
    text-decoration: underline;
  }
`;

const SignupPrompt = styled.div`
  text-align: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  font-size: 14px;
  color: #6b7280;
`;

const SignupLink = styled(Link)`
  color: #4f46e5;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
  
  &:hover {
    color: #3730a3;
    text-decoration: underline;
  }
`;

const CleanLoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorType | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, ErrorType | null>>({
    email: null,
    password: null
  });
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const validateField = (name: string, value: string): ErrorType | null => {
    switch (name) {
      case 'email':
        if (!value.trim()) return 'MISSING_EMAIL';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'INVALID_EMAIL_FORMAT';
        return null;
      case 'password':
        if (!value) return 'MISSING_PASSWORD';
        return null;
      default:
        return null;
    }
  };

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
    
    // Validate all fields
    const emailError = validateField('email', formData.email);
    const passwordError = validateField('password', formData.password);
    
    setFieldErrors({
      email: emailError,
      password: passwordError
    });

    if (emailError || passwordError) {
      return;
    }

    setLoading(true);

    try {
      await login(formData);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      
      // Map server errors to ErrorDictionary types
      if (err.message.includes('Invalid credentials') || err.message.includes('not found')) {
        setError('ACCOUNT_NOT_FOUND');
      } else if (err.message.includes('password')) {
        setError('INCORRECT_PASSWORD');
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
        navigate('/signup');
        break;
      case 'navigate:/forgot-password':
        navigate('/forgot-password');
        break;
      case 'focus:email':
        (document.querySelector('input[name="email"]') as HTMLInputElement)?.focus();
        break;
      case 'focus:password':
        (document.querySelector('input[name="password"]') as HTMLInputElement)?.focus();
        break;
      case 'retry':
        handleSubmit(new Event('submit') as any);
        break;
      case 'dismiss':
        setError(null);
        break;
    }
  };

  return (
    <FormContainer>
      <Title>Sign In</Title>
      <Subtitle>Welcome back! Please sign in to your account</Subtitle>
      
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
          value={formData.email}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder="Enter your email"
          leftIcon="📧"
          error={fieldErrors.email ? getErrorMessage(fieldErrors.email).message : undefined}
          required
        />
        
        <ColorfulInput
          label="Password"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder="Enter your password"
          leftIcon="🔒"
          error={fieldErrors.password ? getErrorMessage(fieldErrors.password).message : undefined}
          required
        />
        
        <ForgotPasswordLink to="/forgot-password">
          Forgot your password?
        </ForgotPasswordLink>
        
        <PrimaryButton
          type="submit"
          fullWidth
          loading={loading}
          disabled={loading}
          animated
        >
          {loading ? 'Signing In...' : '🚀 Sign In'}
        </PrimaryButton>
      </Form>
      
      <SignupPrompt>
        Don't have an account?{' '}
        <SignupLink to="/signup">Sign up here</SignupLink>
      </SignupPrompt>
    </FormContainer>
  );
};

export default CleanLoginForm;