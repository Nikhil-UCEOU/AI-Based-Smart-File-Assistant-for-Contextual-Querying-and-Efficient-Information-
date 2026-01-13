const API_BASE = 'http://localhost:3001/api';

export interface ProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  displayName?: string;
  bio?: string;
  timezone?: string;
}

export interface ProfilePictureUploadResponse {
  profilePictureUrl: string;
  message: string;
}

export interface ProfileUpdateResponse {
  user: any; // Will match the User type from auth context
  message: string;
}

class ProfileService {
  private getAuthToken(): string | null {
    const session = localStorage.getItem('authSession');
    if (session) {
      const parsedSession = JSON.parse(session);
      return parsedSession.accessToken;
    }
    return null;
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getAuthToken();
    return {
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  async updateProfile(updates: ProfileUpdateRequest): Promise<ProfileUpdateResponse> {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update profile');
    }

    return data.data;
  }

  async uploadProfilePicture(file: File): Promise<ProfilePictureUploadResponse> {
    // Validate file before upload
    const validation = this.validateImageFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const formData = new FormData();
    formData.append('profilePicture', file);

    const response = await fetch(`${API_BASE}/profile/picture`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to upload profile picture');
    }

    return data.data;
  }

  async removeProfilePicture(): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/profile/picture`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to remove profile picture');
    }

    return data.data;
  }

  async getCurrentProfile(): Promise<any> {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch profile');
    }

    return data.data;
  }

  validateImageFile(file: File): { isValid: boolean; error?: string } {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.'
      };
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'File too large. Maximum size is 5MB.'
      };
    }

    return { isValid: true };
  }

  async resizeImage(file: File, maxWidth: number = 400, maxHeight: number = 400, quality: number = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and resize image
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(resizedFile);
            } else {
              reject(new Error('Failed to resize image'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  validateProfileData(data: ProfileUpdateRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate email format
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push('Please enter a valid email address');
      }
    }

    // Validate name fields
    if (data.firstName !== undefined && data.firstName.trim().length < 1) {
      errors.push('First name is required');
    }

    if (data.lastName !== undefined && data.lastName.trim().length < 1) {
      errors.push('Last name is required');
    }

    // Validate display name length
    if (data.displayName && data.displayName.length > 50) {
      errors.push('Display name must be 50 characters or less');
    }

    // Validate bio length
    if (data.bio && data.bio.length > 500) {
      errors.push('Bio must be 500 characters or less');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getSupportedImageTypes(): string[] {
    return ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  }

  getMaxImageSize(): number {
    return 5 * 1024 * 1024; // 5MB
  }
}

export const profileService = new ProfileService();