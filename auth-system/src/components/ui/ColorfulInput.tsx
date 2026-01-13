import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 5px rgba(79, 172, 254, 0.3); }
  50% { box-shadow: 0 0 20px rgba(79, 172, 254, 0.6), 0 0 30px rgba(240, 147, 251, 0.3); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-2px); }
`;

const InputContainer = styled.div`
  position: relative;
  margin-bottom: 20px;
`;

const InputField = styled.input<{ hasError?: boolean; isFocused?: boolean }>`
  width: 100%;
  padding: 18px 20px;
  border: 2px solid;
  border-color: ${props => props.hasError ? '#ff6b6b' : '#4facfe'};
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  color: #1f2937;
  
  &:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.95);
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    border-color: ${props => props.hasError ? '#ff6b6b' : '#667eea'};
    animation: ${glow} 2s ease-in-out infinite;
  }

  &::placeholder {
    color: #9ca3af;
    transition: all 0.3s ease;
  }

  &:focus::placeholder {
    color: #d1d5db;
  }
`;

const Label = styled.label<{ hasError?: boolean }>`
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.hasError ? '#ff6b6b' : '#667eea'};
  margin-bottom: 8px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
`;

const InputIcon = styled.div<{ position: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${props => props.position}: 16px;
  color: #9ca3af;
  font-size: 20px;
  transition: all 0.3s ease;
  z-index: 1;
  pointer-events: none;
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
  animation: ${float} 2s ease-in-out infinite;
`;

const SuccessMessage = styled.div`
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(17, 153, 142, 0.1);
  border: 1px solid rgba(17, 153, 142, 0.3);
  border-radius: 8px;
  color: #059669;
  font-size: 14px;
  font-weight: 500;
  animation: ${float} 2s ease-in-out infinite;
`;

interface ColorfulInputProps {
  label?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  success?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}

export const ColorfulInput: React.FC<ColorfulInputProps> = ({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  onFocus,
  onBlur,
  error,
  success,
  leftIcon,
  rightIcon,
  disabled,
  required,
  name,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <InputContainer>
      {label && (
        <Label hasError={!!error}>
          {label} {required && '*'}
        </Label>
      )}
      
      <div style={{ position: 'relative' }}>
        {leftIcon && <InputIcon position="left">{leftIcon}</InputIcon>}
        {rightIcon && <InputIcon position="right">{rightIcon}</InputIcon>}
        
        <InputField
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          hasError={!!error}
          isFocused={isFocused}
          disabled={disabled}
          required={required}
          name={name}
          style={{
            paddingLeft: leftIcon ? '50px' : '20px',
            paddingRight: rightIcon ? '50px' : '20px',
          }}
        />
      </div>
      
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && !error && <SuccessMessage>{success}</SuccessMessage>}
    </InputContainer>
  );
};

export default ColorfulInput;