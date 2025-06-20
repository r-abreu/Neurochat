/**
 * Email validation utility
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Get email validation error message
 */
export const getEmailValidationError = (email: string): string => {
  if (!email) {
    return 'Email is required';
  }
  if (!validateEmail(email)) {
    return 'Please enter a valid email address';
  }
  return '';
};

/**
 * Check if email is valid and not empty
 */
export const isValidEmail = (email: string): boolean => {
  return email.trim() !== '' && validateEmail(email);
}; 