/**
 * Centralized Error Dictionary
 * Contains all user-facing error messages with consistent formatting
 */

export interface ErrorAction {
  label: string;
  action: string; // Can be 'navigate:/path', 'retry', 'focus:fieldName', 'dismiss'
  variant: 'primary' | 'secondary';
}

export interface ErrorMessage {
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  actions?: ErrorAction[];
  dismissible: boolean;
  autoHide?: boolean;
  duration?: number; // in milliseconds
}

export type ErrorType = keyof typeof ERROR_MESSAGES;

export const ERROR_MESSAGES = {
  // Missing Data Errors
  MISSING_FIRST_NAME: {
    title: "First Name Required",
    message: "First name is required - please enter your first name",
    type: "error" as const,
    dismissible: false
  },
  
  MISSING_LAST_NAME: {
    title: "Last Name Required", 
    message: "Last name is required - please enter your last name",
    type: "error" as const,
    dismissible: false
  },
  
  MISSING_EMAIL: {
    title: "Email Required",
    message: "Email address is required - please enter your email",
    type: "error" as const,
    dismissible: false
  },
  
  MISSING_PASSWORD: {
    title: "Password Required",
    message: "Password is required - please create a secure password",
    type: "error" as const,
    dismissible: false
  },
  
  MISSING_CONFIRM_PASSWORD: {
    title: "Password Confirmation Required",
    message: "Password confirmation is required - please confirm your password",
    type: "error" as const,
    dismissible: false
  },

  // Format Validation Errors
  INVALID_EMAIL_FORMAT: {
    title: "Invalid Email Format",
    message: "Invalid email format - please enter a valid email address (example: user@domain.com)",
    type: "error" as const,
    dismissible: false
  },
  
  PASSWORD_TOO_SHORT: {
    title: "Password Too Short",
    message: "Password too short - please create a password with at least 8 characters",
    type: "error" as const,
    dismissible: false
  },
  
  PASSWORDS_DONT_MATCH: {
    title: "Passwords Don't Match",
    message: "Passwords don't match - please make sure both password fields are identical",
    type: "error" as const,
    dismissible: false
  },
  
  NAME_TOO_SHORT: {
    title: "Name Too Short",
    message: "Name too short - please enter at least 2 characters",
    type: "error" as const,
    dismissible: false
  },

  // Account Existence Errors
  ACCOUNT_ALREADY_EXISTS: {
    title: "Account Already Exists",
    message: "Account already exists - an account with this email is already registered. Please sign in instead or use a different email address",
    type: "error" as const,
    dismissible: true,
    actions: [
      { label: "Sign In Instead", action: "navigate:/login", variant: "primary" as const },
      { label: "Use Different Email", action: "focus:email", variant: "secondary" as const }
    ]
  },
  
  ACCOUNT_NOT_FOUND: {
    title: "Account Not Found",
    message: "Account not found - no account exists with these credentials. Please check your email and password or create a new account",
    type: "error" as const,
    dismissible: true,
    actions: [
      { label: "Create Account", action: "navigate:/signup", variant: "primary" as const },
      { label: "Try Again", action: "focus:email", variant: "secondary" as const }
    ]
  },
  
  INCORRECT_PASSWORD: {
    title: "Incorrect Password",
    message: "Incorrect password - please check your password and try again. If you forgot your password, use the reset option",
    type: "error" as const,
    dismissible: true,
    actions: [
      { label: "Try Again", action: "focus:password", variant: "primary" as const },
      { label: "Reset Password", action: "navigate:/forgot-password", variant: "secondary" as const }
    ]
  },

  // Email-Specific Validation
  DISPOSABLE_EMAIL_NOT_ALLOWED: {
    title: "Temporary Email Not Allowed",
    message: "Temporary email not allowed - please use a permanent email address from a standard email provider",
    type: "error" as const,
    dismissible: false,
    actions: [
      { label: "Use Different Email", action: "focus:email", variant: "primary" as const }
    ]
  },
  
  INVALID_EMAIL_CHARACTERS: {
    title: "Invalid Email Characters",
    message: "Invalid email characters - please use only letters, numbers, dots, and standard email symbols",
    type: "error" as const,
    dismissible: false
  },
  
  INCOMPLETE_EMAIL_ADDRESS: {
    title: "Incomplete Email Address",
    message: "Incomplete email address - please include the domain (example: @gmail.com)",
    type: "error" as const,
    dismissible: false
  },

  // Password Security Validation
  PASSWORD_TOO_WEAK: {
    title: "Password Needs Improvement",
    message: "Password needs improvement - please include a mix of letters, numbers, and special characters for better security",
    type: "warning" as const,
    dismissible: false
  },
  
  PASSWORD_TOO_COMMON: {
    title: "Password Too Common",
    message: "Password too common - please choose a more unique password to keep your account secure",
    type: "warning" as const,
    dismissible: false
  },
  
  PASSWORD_ONLY_NUMBERS: {
    title: "Password Too Simple",
    message: "Password too simple - please include letters and special characters along with numbers",
    type: "error" as const,
    dismissible: false
  },

  // File Upload Validation
  FILE_TOO_LARGE: {
    title: "File Too Large",
    message: "File too large - please choose an image smaller than 5MB",
    type: "error" as const,
    dismissible: true,
    actions: [
      { label: "Choose Different File", action: "focus:file", variant: "primary" as const }
    ]
  },
  
  FILE_TYPE_NOT_SUPPORTED: {
    title: "File Type Not Supported",
    message: "File type not supported - please upload a JPG, PNG, or GIF image",
    type: "error" as const,
    dismissible: true,
    actions: [
      { label: "Choose Different File", action: "focus:file", variant: "primary" as const }
    ]
  },
  
  FILE_CORRUPTED: {
    title: "File Appears Corrupted",
    message: "File appears corrupted - please try uploading a different image",
    type: "error" as const,
    dismissible: true,
    actions: [
      { label: "Choose Different File", action: "focus:file", variant: "primary" as const }
    ]
  },

  // Network and System Errors
  NETWORK_ERROR: {
    title: "Connection Problem",
    message: "Connection problem - please check your internet connection and try again",
    type: "error" as const,
    dismissible: true,
    actions: [
      { label: "Try Again", action: "retry", variant: "primary" as const }
    ]
  },
  
  SERVER_UNAVAILABLE: {
    title: "Service Unavailable",
    message: "Service temporarily unavailable - please try again in a few moments",
    type: "error" as const,
    dismissible: true,
    actions: [
      { label: "Try Again", action: "retry", variant: "primary" as const }
    ]
  },
  
  REQUEST_TIMEOUT: {
    title: "Request Timed Out",
    message: "Request timed out - the operation took too long. Please try again",
    type: "error" as const,
    dismissible: true,
    actions: [
      { label: "Try Again", action: "retry", variant: "primary" as const }
    ]
  },
  
  UNEXPECTED_ERROR: {
    title: "Something Unexpected Happened",
    message: "Something unexpected happened - please refresh the page and try again. If the problem persists, contact support",
    type: "error" as const,
    dismissible: true,
    actions: [
      { label: "Refresh Page", action: "refresh", variant: "primary" as const },
      { label: "Contact Support", action: "navigate:/support", variant: "secondary" as const }
    ]
  },

  // Success Messages
  ACCOUNT_CREATED_SUCCESS: {
    title: "Account Created Successfully",
    message: "Account created successfully - welcome! You can now sign in with your credentials",
    type: "success" as const,
    dismissible: true,
    autoHide: true,
    duration: 5000,
    actions: [
      { label: "Sign In Now", action: "navigate:/login", variant: "primary" as const }
    ]
  },
  
  LOGIN_SUCCESS: {
    title: "Welcome Back",
    message: "Welcome back - you're now signed in to your account",
    type: "success" as const,
    dismissible: true,
    autoHide: true,
    duration: 3000
  },
  
  PROFILE_PICTURE_UPDATED: {
    title: "Profile Picture Updated",
    message: "Profile picture updated - your new image has been saved successfully",
    type: "success" as const,
    dismissible: true,
    autoHide: true,
    duration: 4000
  },
  
  LOGOUT_SUCCESS: {
    title: "Signed Out Successfully",
    message: "Signed out successfully - you've been safely logged out of your account",
    type: "success" as const,
    dismissible: true,
    autoHide: true,
    duration: 3000
  },

  // Generic fallback
  GENERIC_ERROR: {
    title: "Unexpected Issue",
    message: "An unexpected issue occurred - please try again",
    type: "error" as const,
    dismissible: true
  }
} as const;

/**
 * Get error message by type with optional context
 */
export function getErrorMessage(errorType: ErrorType, context?: Record<string, any>): ErrorMessage {
  const baseMessage = ERROR_MESSAGES[errorType];
  
  if (!baseMessage) {
    console.warn(`Unknown error type: ${errorType}`);
    return ERROR_MESSAGES.GENERIC_ERROR;
  }
  
  // Clone the message to avoid mutations and make actions mutable
  const message: ErrorMessage = {
    title: baseMessage.title,
    message: baseMessage.message,
    type: baseMessage.type,
    dismissible: baseMessage.dismissible,
    autoHide: (baseMessage as any).autoHide,
    duration: (baseMessage as any).duration,
    actions: (baseMessage as any).actions ? [...((baseMessage as any).actions || [])] : undefined
  };
  
  // Apply context-specific modifications if needed
  if (context) {
    // Example: customize message based on context
    if (errorType === 'FILE_TOO_LARGE' && context.maxSize) {
      message.message = `File too large - please choose an image smaller than ${context.maxSize}MB`;
    }
  }
  
  return message;
}

/**
 * Check if an error type exists in the dictionary
 */
export function isValidErrorType(errorType: string): errorType is ErrorType {
  return errorType in ERROR_MESSAGES;
}

/**
 * Get all error types for a specific category
 */
export function getErrorTypesByCategory(category: 'validation' | 'network' | 'file' | 'account' | 'success'): ErrorType[] {
  const categoryMap: Record<string, ErrorType[]> = {
    validation: [
      'MISSING_FIRST_NAME', 'MISSING_LAST_NAME', 'MISSING_EMAIL', 'MISSING_PASSWORD', 
      'MISSING_CONFIRM_PASSWORD', 'INVALID_EMAIL_FORMAT', 'PASSWORD_TOO_SHORT', 
      'PASSWORDS_DONT_MATCH', 'NAME_TOO_SHORT', 'PASSWORD_TOO_WEAK', 'PASSWORD_TOO_COMMON',
      'PASSWORD_ONLY_NUMBERS', 'DISPOSABLE_EMAIL_NOT_ALLOWED', 'INVALID_EMAIL_CHARACTERS',
      'INCOMPLETE_EMAIL_ADDRESS'
    ],
    network: ['NETWORK_ERROR', 'SERVER_UNAVAILABLE', 'REQUEST_TIMEOUT', 'UNEXPECTED_ERROR'],
    file: ['FILE_TOO_LARGE', 'FILE_TYPE_NOT_SUPPORTED', 'FILE_CORRUPTED'],
    account: ['ACCOUNT_ALREADY_EXISTS', 'ACCOUNT_NOT_FOUND', 'INCORRECT_PASSWORD'],
    success: ['ACCOUNT_CREATED_SUCCESS', 'LOGIN_SUCCESS', 'PROFILE_PICTURE_UPDATED', 'LOGOUT_SUCCESS']
  };
  
  // Handle invalid categories by checking if the category exists
  if (!(category in categoryMap)) {
    return [];
  }
  
  return categoryMap[category];
}