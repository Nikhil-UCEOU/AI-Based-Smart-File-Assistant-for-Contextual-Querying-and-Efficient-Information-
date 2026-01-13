import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Toast } from '../components/ui/Toast';

interface ToastData {
  id: string;
  variant: 'success' | 'error' | 'info';
  title?: string;
  message: string;
  duration?: number;
  autoClose?: boolean;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastData, 'id'>) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const showToast = (toast: Omit<ToastData, 'id'>) => {
    const id = generateId();
    const newToast: ToastData = {
      id,
      ...toast,
    };

    setToasts(prev => [...prev, newToast]);
  };

  const showSuccess = (message: string, title?: string) => {
    showToast({
      variant: 'success',
      title,
      message,
    });
  };

  const showError = (message: string, title?: string) => {
    showToast({
      variant: 'error',
      title,
      message,
    });
  };

  const showInfo = (message: string, title?: string) => {
    showToast({
      variant: 'info',
      title,
      message,
    });
  };

  const hideToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const value: ToastContextType = {
    showToast,
    showSuccess,
    showError,
    showInfo,
    hideToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          title={toast.title}
          message={toast.message}
          isVisible={true}
          onClose={() => hideToast(toast.id)}
          autoClose={toast.autoClose}
          duration={toast.duration}
        />
      ))}
    </ToastContext.Provider>
  );
};