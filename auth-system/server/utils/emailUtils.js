/**
 * Email utility functions for consistent email handling
 */

/**
 * Normalize email address for consistent storage and comparison
 * @param {string} email - Raw email address
 * @returns {string} - Normalized email address
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('Invalid email provided');
  }
  
  return email.trim().toLowerCase();
}

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if email is from a disposable email provider
 * @param {string} email - Email address to check
 * @returns {boolean} - True if disposable, false otherwise
 */
function isDisposableEmail(email) {
  const disposableDomains = [
    '10minutemail.com',
    'tempmail.org',
    'guerrillamail.com',
    'mailinator.com',
    'throwaway.email'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  return disposableDomains.includes(domain);
}

module.exports = {
  normalizeEmail,
  isValidEmail,
  isDisposableEmail
};