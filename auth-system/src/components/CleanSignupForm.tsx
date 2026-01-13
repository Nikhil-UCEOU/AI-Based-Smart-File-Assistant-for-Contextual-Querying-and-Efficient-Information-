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

const NameRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
`;

const SuccessMessage = styled.div`
  background: rgba(17, 153, 142, 0.1);
  border: 1px solid rgba(17, 153, 142, 0.3);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  margin-bottom: 16px;
  backdrop-filter: blur(10px);
`;

const LoginPrompt = styled.div`
  text-align: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  font-size: 14px;
  color: #6b7280;
`;

const LoginLink = styled(Link)`
  color: #4f46e5;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
  
  &:hover {
    color: #3730a3;
    text-decoration: underline;
  }
`;

const FileInputContainer = styled.div`
  position: relative;
`;

const FileInputWrapper = styled.div`
  position: relative;
  overflow: hidden;
  display: inline-block;
  width: 100%;
`;

const FileInput = styled.input`
  position: absolute;
  left: -9999px;
  opacity: 0;
`;

const FileInputButton = styled.label`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 18px 20px;
  border: 2px solid #4facfe;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  color: #1f2937;
  
  &:hover {
    background: rgba(255, 255, 255, 0.95);
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    border-color: #667eea;
  }
`;

const FileInputIcon = styled.span`
  margin-right: 12px;
  font-size: 20px;
`;

const FileInputText = styled.span`
  flex: 1;
  text-align: left;
`;

const FileLabel = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
  margin-bottom: 8px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
`;

const ErrorMessage = styled.div`
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 8px;
  color: #dc2626;
  font-size: 14px;
  font-weight: 500;
`;

const CleanSignupForm: React.FC = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorType | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, ErrorType | null>>({
    firstName: null,
    lastName: null,
    email: null,
    password: null,
    confirmPassword: null,
    profilePicture: null
  });
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [profilePicture, setProfilePicture] = useState<File | null>(null);

  const validateField = (name: string, value: string | File | null): ErrorType | null => {
    switch (name) {
      case 'firstName':
        if (!value || (typeof value === 'string' && !value.trim())) return 'MISSING_FIRST_NAME';
        if (typeof value === 'string' && value.trim().length < 2) return 'NAME_TOO_SHORT';
        return null;
      case 'lastName':
        if (!value || (typeof value === 'string' && !value.trim())) return 'MISSING_LAST_NAME';
        if (typeof value === 'string' && value.trim().length < 2) return 'NAME_TOO_SHORT';
        return null;
      case 'email':
        if (!value || (typeof value === 'string' && !value.trim())) return 'MISSING_EMAIL';
        if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'INVALID_EMAIL_FORMAT';
        return null;
      case 'password':
        if (!value || (typeof value === 'string' && !value)) return 'MISSING_PASSWORD';
        if (typeof value === 'string' && value.length < 8) return 'PASSWORD_TOO_SHORT';
        return null;
      case 'confirmPassword':
        if (!value || (typeof value === 'string' && !value)) return 'MISSING_CONFIRM_PASSWORD';
        if (typeof value === 'string' && value !== formData.password) return 'PASSWORDS_DONT_MATCH';
        return null;
      case 'profilePicture':
        if (value && value instanceof File) {
          if (value.size > 5 * 1024 * 1024) return 'FILE_TOO_LARGE'; // 5MB
          if (!['image/jpeg', 'image/png', 'image/gif'].includes(value.type)) return 'FILE_TYPE_NOT_SUPPORTED';
        }
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setProfilePicture(file);
    
    // Validate file immediately
    const fileError = validateField('profilePicture', file);
    setFieldErrors({
      ...fieldErrors,
      profilePicture: fileError
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate all fields
    const firstNameError = validateField('firstName', formData.firstName);
    const lastNameError = validateField('lastName', formData.lastName);
    const emailError = validateField('email', formData.email);
    const passwordError = validateField('password', formData.password);
    const confirmPasswordError = validateField('confirmPassword', formData.confirmPassword);
    const profilePictureError = validateField('profilePicture', profilePicture);
    
    setFieldErrors({
      firstName: firstNameError,
      lastName: lastNameError,
      email: emailError,
      password: passwordError,
      confirmPassword: confirmPasswordError,
      profilePicture: profilePictureError
    });

    if (firstNameError || lastNameError || emailError || passwordError || confirmPasswordError || profilePictureError) {
      return;
    }

    setLoading(true);

    try {
      await signup({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        profilePicture: profilePicture || undefined
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      console.error('Signup error:', err);
      
      // Map server errors to ErrorDictionary types
      if (err.message.includes('EMAIL_ALREADY_EXISTS') || err.message.includes('already exists')) {
        setError('ACCOUNT_ALREADY_EXISTS');
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
      case 'navigate:/login':
        navigate('/login');
        break;
      case 'focus:email':
        (document.querySelector('input[name="email"]') as HTMLInputElement)?.focus();
        break;
      case 'focus:file':
        (document.querySelector('input[type="file"]') as HTMLInputElement)?.click();
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
        <Title>Account Created! 🎉</Title>
        <SuccessMessage>
          <p style={{ margin: 0, color: '#059669', fontWeight: 600, fontSize: '16px' }}>
            Your account has been created successfully!
          </p>
          <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            Redirecting to login page...
          </p>
        </SuccessMessage>
        <PrimaryButton fullWidth onClick={() => navigate('/login')} animated>
          🚀 Go to Login
        </PrimaryButton>
      </FormContainer>
    );
  }

  return (
    <FormContainer>
      <Title>Create Account</Title>
      <Subtitle>Join us today! Create your account to get started</Subtitle>
      
      {error && (
        <ActionableError
          error={getErrorMessage(error)}
          onAction={handleErrorAction}
        />
      )}
      
      <Form onSubmit={handleSubmit}>
        <NameRow>
          <ColorfulInput
            label="First Name"
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder="Enter your first name"
            leftIcon="👤"
            error={fieldErrors.firstName ? getErrorMessage(fieldErrors.firstName).message : undefined}
            required
          />
          
          <ColorfulInput
            label="Last Name"
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder="Enter your last name"
            leftIcon="👤"
            error={fieldErrors.lastName ? getErrorMessage(fieldErrors.lastName).message : undefined}
            required
          />
        </NameRow>
        
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
          placeholder="Create a password"
          leftIcon="🔒"
          error={fieldErrors.password ? getErrorMessage(fieldErrors.password).message : undefined}
          required
        />
        
        <ColorfulInput
          label="Confirm Password"
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder="Confirm your password"
          leftIcon="🔒"
          error={fieldErrors.confirmPassword ? getErrorMessage(fieldErrors.confirmPassword).message : undefined}
          required
        />
        
        <FileInputContainer>
          <FileLabel>Profile Picture (Optional)</FileLabel>
          <FileInputWrapper>
            <FileInput
              id="profilePicture"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
            <FileInputButton htmlFor="profilePicture">
              <FileInputIcon>📁</FileInputIcon>
              <FileInputText>
                {profilePicture ? profilePicture.name : 'Choose Profile Picture'}
              </FileInputText>
            </FileInputButton>
          </FileInputWrapper>
          {fieldErrors.profilePicture && (
            <ErrorMessage>{getErrorMessage(fieldErrors.profilePicture).message}</ErrorMessage>
          )}
        </FileInputContainer>
        
        <PrimaryButton
          type="submit"
          fullWidth
          loading={loading}
          disabled={loading}
          animated
        >
          {loading ? 'Creating Account...' : '🎯 Create Account'}
        </PrimaryButton>
      </Form>
      
      <LoginPrompt>
        Already have an account?{' '}
        <LoginLink to="/login">Sign in here</LoginLink>
      </LoginPrompt>
    </FormContainer>
  );
};

export default CleanSignupForm;