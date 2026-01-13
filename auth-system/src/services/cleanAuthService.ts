import { LoginCredentials, SignupData, AuthSession, User } from '../types/auth';

const API_BASE = 'http://localhost:3001/api';

class CleanAuthService {
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    const { user: userData, tokens } = data.data;
    
    const user: User = {
      id: userData.id,
      databaseId: userData.databaseId,
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      profilePictureUrl: userData.profilePictureUrl,
      userIndex: userData.userIndex,
      pineconeId: userData.pineconeId,
      authProvider: userData.authProvider,
      emailVerified: userData.emailVerified,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const session: AuthSession = {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(tokens.expiresAt),
    };

    return session;
  }

  async signup(userData: SignupData): Promise<void> {
    // If there's a profile picture, upload it first
    let profilePictureUrl: string | undefined;
    if (userData.profilePicture) {
      profilePictureUrl = await this.uploadProfilePicture(userData.profilePicture);
    }

    const signupRequest = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      password: userData.password,
      profilePictureUrl: profilePictureUrl,
    };

    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signupRequest),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
    }
  }

  async uploadProfilePicture(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('profilePicture', file);

    const response = await fetch(`${API_BASE}/upload/profile-picture`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'File upload failed');
    }

    return data.data.url;
  }

  async requestPasswordReset(email: string): Promise<string> {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to request password reset');
    }

    return data.message || 'Password reset email sent successfully';
  }

  async verifyResetToken(token: string): Promise<{ email: string; firstName: string }> {
    const response = await fetch(`${API_BASE}/auth/reset-password/${token}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Invalid reset token');
    }

    return data.data;
  }

  async resetPassword(token: string, newPassword: string): Promise<string> {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, newPassword }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to reset password');
    }

    return data.message || 'Password reset successfully';
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Clear local storage regardless of server response
    localStorage.removeItem('authSession');
  }
}

export const cleanAuthService = new CleanAuthService();