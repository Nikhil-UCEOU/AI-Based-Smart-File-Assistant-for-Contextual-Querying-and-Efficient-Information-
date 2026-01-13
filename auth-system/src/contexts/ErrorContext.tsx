import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorMessage, ErrorType, getErrorMessage, ErrorAction } from '../utils/ErrorDictionary';

interface ErrorState {
  fieldErrors: Map<string, ErrorMessage>;
  systemErrors: ErrorMessage[];
  isLoading: boolean;
}

interface ErrorContextType {
  // State
  errorState: ErrorState;
  
  // Field-level errors
  setFieldError: (fieldName: string, errorType: ErrorType, context?: Record<string, any>) => void;
  clearFieldError: (fieldName: string) => void;
  getFieldError: (fieldName: string) => ErrorMessage | undefined;
  hasFieldError: (fieldName: string) => boolean;
  
  // System-level errors
  showSystemError: (errorType: ErrorType, context?: Record<string, any>) => void;
  clearSystemError: (index: number) => void;
  clearAllSystemErrors: () => void;
  
  // Actions
  executeAction: (action: ErrorAction) => void;
  
  // Loading state
  setLoading: (loading: boolean) => void;
  
  // Utilities
  clearAllErrors: () => void;
  hasAnyErrors: () => boolean;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

interface ErrorProviderProps {
  children: ReactNode;
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const [errorState, setErrorState] = useState<ErrorState>({
    fieldErrors: new Map(),
    systemErrors: [],
    isLoading: false
  });

  // Field-level error management
  const setFieldError = useCallback((fieldName: string, errorType: ErrorType, context?: Record<string, any>) => {
    const errorMessage = getErrorMessage(errorType, context);
    
    setErrorState(prev => {
      const newFieldErrors = new Map(prev.fieldErrors);
      newFieldErrors.set(fieldName, errorMessage);
      
      return {
        ...prev,
        fieldErrors: newFieldErrors
      };
    });
  }, []);

  const clearFieldError = useCallback((fieldName: string) => {
    setErrorState(prev => {
      const newFieldErrors = new Map(prev.fieldErrors);
      newFieldErrors.delete(fieldName);
      
      return {
        ...prev,
        fieldErrors: newFieldErrors
      };
    });
  }, []);

  const getFieldError = useCallback((fieldName: string): ErrorMessage | undefined => {
    return errorState.fieldErrors.get(fieldName);
  }, [errorState.fieldErrors]);

  const hasFieldError = useCallback((fieldName: string): boolean => {
    return errorState.fieldErrors.has(fieldName);
  }, [errorState.fieldErrors]);

  // System-level error management
  const showSystemError = useCallback((errorType: ErrorType, context?: Record<string, any>) => {
    const errorMessage = getErrorMessage(errorType, context);
    
    setErrorState(prev => ({
      ...prev,
      systemErrors: [...prev.systemErrors, errorMessage]
    }));

    // Auto-hide if specified
    if (errorMessage.autoHide && errorMessage.duration) {
      setTimeout(() => {
        setErrorState(current => ({
          ...current,
          systemErrors: current.systemErrors.filter(error => error !== errorMessage)
        }));
      }, errorMessage.duration);
    }
  }, []);

  const clearSystemError = useCallback((index: number) => {
    setErrorState(prev => ({
      ...prev,
      systemErrors: prev.systemErrors.filter((_, i) => i !== index)
    }));
  }, []);

  const clearAllSystemErrors = useCallback(() => {
    setErrorState(prev => ({
      ...prev,
      systemErrors: []
    }));
  }, []);

  // Action execution
  const executeAction = useCallback((action: ErrorAction) => {
    switch (true) {
      case action.action.startsWith('navigate:'):
        const path = action.action.replace('navigate:', '');
        navigate(path);
        break;
        
      case action.action.startsWith('focus:'):
        const fieldName = action.action.replace('focus:', '');
        const element = document.querySelector(`[name="${fieldName}"]`) as HTMLElement;
        if (element) {
          element.focus();
          // Clear the field error when focusing
          clearFieldError(fieldName);
        }
        break;
        
      case action.action === 'retry':
        // Trigger a retry - this should be handled by the component that showed the error
        // For now, we'll just clear the error and let the component handle retry logic
        clearAllSystemErrors();
        break;
        
      case action.action === 'refresh':
        window.location.reload();
        break;
        
      case action.action === 'dismiss':
        // This will be handled by the component showing the error
        break;
        
      default:
        console.warn(`Unknown action: ${action.action}`);
    }
  }, [navigate, clearFieldError, clearAllSystemErrors]);

  // Loading state management
  const setLoading = useCallback((loading: boolean) => {
    setErrorState(prev => ({
      ...prev,
      isLoading: loading
    }));
  }, []);

  // Utility functions
  const clearAllErrors = useCallback(() => {
    setErrorState(prev => ({
      ...prev,
      fieldErrors: new Map(),
      systemErrors: []
    }));
  }, []);

  const hasAnyErrors = useCallback((): boolean => {
    return errorState.fieldErrors.size > 0 || errorState.systemErrors.length > 0;
  }, [errorState.fieldErrors.size, errorState.systemErrors.length]);

  const contextValue: ErrorContextType = {
    errorState,
    setFieldError,
    clearFieldError,
    getFieldError,
    hasFieldError,
    showSystemError,
    clearSystemError,
    clearAllSystemErrors,
    executeAction,
    setLoading,
    clearAllErrors,
    hasAnyErrors
  };

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
    </ErrorContext.Provider>
  );
};

export const useError = (): ErrorContextType => {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

// Hook for field-specific error handling
export const useFieldError = (fieldName: string) => {
  const { setFieldError, clearFieldError, getFieldError, hasFieldError } = useError();
  
  return {
    setError: (errorType: ErrorType, context?: Record<string, any>) => 
      setFieldError(fieldName, errorType, context),
    clearError: () => clearFieldError(fieldName),
    error: getFieldError(fieldName),
    hasError: hasFieldError(fieldName)
  };
};