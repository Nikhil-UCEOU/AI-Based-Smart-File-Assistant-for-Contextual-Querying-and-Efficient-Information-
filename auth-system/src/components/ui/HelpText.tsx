/**
 * Contextual Help Text Components
 * Provides inline guidance for complex validations and form fields
 */

import React, { useState } from 'react';

interface HelpTextProps {
  children: React.ReactNode;
  className?: string;
}

export const HelpText: React.FC<HelpTextProps> = ({ children, className = '' }) => (
  <p className={`text-sm text-gray-600 mt-1 ${className}`}>
    {children}
  </p>
);

interface ProgressiveHelpProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}

export const ProgressiveHelp: React.FC<ProgressiveHelpProps> = ({ 
  trigger, 
  content, 
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        aria-expanded={isOpen}
      >
        {trigger}
        <svg 
          className={`ml-1 h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
          {content}
        </div>
      )}
    </div>
  );
};

interface TooltipHelpProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const TooltipHelp: React.FC<TooltipHelpProps> = ({ 
  content, 
  children, 
  position = 'top' 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && (
        <div className={`absolute z-10 px-3 py-2 text-sm text-white bg-gray-900 rounded-md shadow-lg whitespace-nowrap ${positionClasses[position]}`}>
          {content}
          <div className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${
            position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1' :
            position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1' :
            position === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1' :
            'right-full top-1/2 -translate-y-1/2 -mr-1'
          }`} />
        </div>
      )}
    </div>
  );
};

// Field-specific help text components
export const EmailHelpText: React.FC = () => (
  <HelpText>
    Use a permanent email address from a standard provider (Gmail, Outlook, etc.)
  </HelpText>
);

export const PasswordHelpText: React.FC = () => (
  <ProgressiveHelp
    trigger="Password requirements"
    content={
      <div className="space-y-2">
        <p className="font-medium">Your password must include:</p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>At least 8 characters</li>
          <li>Mix of uppercase and lowercase letters</li>
          <li>At least one number</li>
          <li>At least one special character (!@#$%^&*)</li>
        </ul>
        <p className="text-xs mt-2">
          Avoid common passwords like "password123" or personal information
        </p>
      </div>
    }
  />
);

export const NameHelpText: React.FC = () => (
  <HelpText>
    Enter your real name as it appears on official documents
  </HelpText>
);

export const FileUploadHelpText: React.FC = () => (
  <ProgressiveHelp
    trigger="File upload guidelines"
    content={
      <div className="space-y-2">
        <p className="font-medium">Supported file types:</p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>JPEG (.jpg, .jpeg)</li>
          <li>PNG (.png)</li>
          <li>GIF (.gif)</li>
        </ul>
        <p className="text-sm mt-2">
          <strong>Maximum file size:</strong> 5MB
        </p>
        <p className="text-xs mt-2">
          For best results, use a square image at least 200x200 pixels
        </p>
      </div>
    }
  />
);

// Contextual help for specific validation scenarios
export const ValidationHelp = {
  email: {
    format: "Please enter a valid email address (example: user@domain.com)",
    disposable: "Temporary email addresses are not allowed. Please use a permanent email.",
    availability: "This email is already registered. Try signing in instead."
  },
  
  password: {
    strength: "Use a mix of letters, numbers, and special characters for better security",
    common: "This password is too common. Choose something more unique.",
    match: "Make sure both password fields are identical"
  },
  
  name: {
    length: "Names must be at least 2 characters long",
    characters: "Names can only contain letters, spaces, hyphens, and apostrophes"
  },
  
  file: {
    size: "Files must be smaller than 5MB. Try compressing your image.",
    type: "Only JPEG, PNG, and GIF images are supported",
    corruption: "This file appears to be corrupted. Try uploading a different image."
  }
};

// Smart help text component that shows contextual guidance
interface SmartHelpProps {
  fieldType: 'email' | 'password' | 'name' | 'file';
  validationState?: 'valid' | 'invalid' | 'warning' | null;
  specificError?: string;
}

export const SmartHelp: React.FC<SmartHelpProps> = ({ 
  fieldType, 
  validationState, 
  specificError 
}) => {
  // Show specific error help if available
  if (specificError && ValidationHelp[fieldType]) {
    const helpText = ValidationHelp[fieldType][specificError as keyof typeof ValidationHelp[typeof fieldType]];
    if (helpText) {
      return <HelpText className="text-orange-600">{helpText}</HelpText>;
    }
  }

  // Show general help based on field type
  switch (fieldType) {
    case 'email':
      return <EmailHelpText />;
    case 'password':
      return <PasswordHelpText />;
    case 'name':
      return <NameHelpText />;
    case 'file':
      return <FileUploadHelpText />;
    default:
      return null;
  }
};

// Inline guidance component for complex forms
interface InlineGuidanceProps {
  steps: Array<{
    title: string;
    description: string;
    completed?: boolean;
  }>;
  currentStep?: number;
}

export const InlineGuidance: React.FC<InlineGuidanceProps> = ({ 
  steps, 
  currentStep = 0 
}) => (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
    <h3 className="text-sm font-medium text-blue-900 mb-3">
      Complete your profile ({currentStep + 1} of {steps.length})
    </h3>
    
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div 
          key={index}
          className={`flex items-center text-sm ${
            index === currentStep ? 'text-blue-900 font-medium' :
            step.completed ? 'text-green-700' :
            'text-gray-600'
          }`}
        >
          <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
            step.completed ? 'bg-green-500 border-green-500' :
            index === currentStep ? 'border-blue-500' :
            'border-gray-300'
          }`}>
            {step.completed ? (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <span className="text-xs">{index + 1}</span>
            )}
          </div>
          
          <div>
            <div className="font-medium">{step.title}</div>
            <div className="text-xs text-gray-600">{step.description}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);