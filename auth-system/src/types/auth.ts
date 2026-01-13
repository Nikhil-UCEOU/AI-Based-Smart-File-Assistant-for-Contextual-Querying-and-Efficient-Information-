export interface User {
  id: string; // This will now be the Pinecone ID
  databaseId?: number; // Internal database ID (optional for backward compatibility)
  firstName: string;
  lastName: string;
  email: string;
  profilePictureUrl?: string;
  userIndex: number;
  pineconeId: string; // Explicit Pinecone ID field
  authProvider: 'email';
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  profilePicture?: File;
}

export interface FormState {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

export interface FileUploadState {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  progress: number;
  error: string | null;
}

export interface AuthContextType {
  user: User | null;
  session: AuthSession | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (userData: SignupData) => Promise<void>;
  logout: () => void;
  refreshUserProfile: () => Promise<void>;
  updateUser?: (user: User) => void;
  loading: boolean;
  error: string | null;
}

export interface ApiError {
  message: string;
  field?: string;
  code?: string;
}