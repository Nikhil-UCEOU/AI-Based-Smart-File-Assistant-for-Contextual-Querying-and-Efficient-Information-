import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthSession, LoginCredentials, SignupData, AuthContextType } from '../types/auth';
import { cleanAuthService } from '../services/cleanAuthService';
import { useToast } from './ToastContext';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    // Check for existing session on app load
    const savedSession = localStorage.getItem('authSession');
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession);
        if (new Date(parsedSession.expiresAt) > new Date()) {
          setSession(parsedSession);
          setUser(parsedSession.user);
        } else {
          localStorage.removeItem('authSession');
        }
      } catch (error) {
        localStorage.removeItem('authSession');
      }
    }
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setLoading(true);
    setError(null);
    try {
      const authSession = await cleanAuthService.login(credentials);
      setSession(authSession);
      setUser(authSession.user);
      localStorage.setItem('authSession', JSON.stringify(authSession));
      
      showSuccess(
        `Welcome back, ${authSession.user.firstName}!`,
        'Login Successful'
      );
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      showError(errorMessage, 'Login Failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (userData: SignupData) => {
    setLoading(true);
    setError(null);
    try {
      await cleanAuthService.signup(userData);
      showSuccess(
        'Please check your email to verify your account.',
        'Account Created Successfully'
      );
    } catch (err: any) {
      const errorMessage = err.message || 'Signup failed';
      setError(errorMessage);
      showError(errorMessage, 'Signup Failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await cleanAuthService.logout();
      setUser(null);
      setSession(null);
      setError(null);
      localStorage.removeItem('authSession');
      
      showSuccess('You have been logged out successfully.', 'Logged Out');
    } catch (err: any) {
      console.error('Logout error:', err);
      // Clear local state even if server logout fails
      setUser(null);
      setSession(null);
      setError(null);
      localStorage.removeItem('authSession');
    }
  };

  const refreshUserProfile = async () => {
    try {
      // For now, we'll just refresh from the current session
      // In a real app, you'd fetch updated user data from the server
      if (session?.user) {
        setUser(session.user);
      }
    } catch (err: any) {
      console.error('Refresh user profile error:', err);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    
    // Update the session in localStorage with the new user data
    if (session) {
      const updatedSession = {
        ...session,
        user: updatedUser
      };
      setSession(updatedSession);
      localStorage.setItem('authSession', JSON.stringify(updatedSession));
    }
  };

  const value: AuthContextType = {
    user,
    session,
    login,
    signup,
    logout,
    refreshUserProfile,
    updateUser,
    loading,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};