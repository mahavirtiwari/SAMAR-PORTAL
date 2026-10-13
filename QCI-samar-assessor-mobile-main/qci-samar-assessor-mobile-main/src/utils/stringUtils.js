import { Logger } from '.';

/**
 * String utility functions for the application
 */

/**
 * Adds spaces to a camelCase string
 * @param {string} text - The camelCase string to add spaces to
 * @returns {string} - The string with spaces added
 */
export const addSpacesToCamelCase = (text) => {
  if (typeof text !== 'string') {
    Logger.error('Invalid input: Expected a string');
    return text;
  }
  return text.replace(/([a-z])([A-Z])/g, '$1 $2');
};

/**
 * Formats a string by adding spaces between camelCase words
 * @param {string} str - The string to format
 * @returns {string} - The formatted string
 */
export const formatString = (str) => {
  if (!str) {
    return '';
  }
  return str.replace(/([a-z])([A-Z])/g, '$1 $2');
};

/**
 * Converts a string to camelCase
 * @param {string} str - The string to convert
 * @returns {string} - The camelCase string
 */
export const toCamelCase = (str) => {
  if (!str) {
    return '';
  }
  return str
    .split(/[^a-zA-Z0-9]/)
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
};

/**
 * Gets the first and last letters of a name (useful for avatars)
 * @param {string} string - The full name
 * @returns {Object} - Object containing first and last letters
 */
export const getFirstAndLastLetters = (string) => {
  if (!string) {
    return { firstLetter: '', lastLetter: '' };
  }

  const words = string.trim().split(/\s+/);
  const firstLetter = words.length > 0 ? words[0][0] : '';
  const lastLetter = words.length > 1 ? words[words.length - 1][0] : '';

  return { firstLetter, lastLetter };
};

/**
 * Gets initials from a name
 * @param {string} str - The full name
 * @returns {Object} - Object containing first and last initials
 */
export const getInitialLetters = (str) => {
  if (!str) {
    return { firstInitial: '', lastInitial: '' };
  }

  const words = str.split(/\s+/);
  const firstInitial = words[0] ? words[0][0] : '';
  const lastWordIndex = words.length - 1;
  const lastInitial = words[lastWordIndex]
    ? lastWordIndex === 0
      ? ''
      : words[lastWordIndex][0]
    : '';

  return { firstInitial, lastInitial };
};

/**
 * Gets initials from a name as a string (for display)
 * @param {string} str - The full name
 * @returns {string} - Initials as a string (e.g., "AU" for "Assessor User")
 */
export const getInitials = (str) => {
  if (!str) {
    return '';
  }

  const words = str
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return '';
  }

  if (words.length === 1) {
    return words[0][0].toUpperCase();
  }

  const firstInitial = words[0][0].toUpperCase();
  const lastInitial = words[words.length - 1][0].toUpperCase();

  return firstInitial + lastInitial;
};

/**
 * Uppercases only the first character of a string, leaving the rest as typed.
 * Used to force-capitalize free-text input fields, since the native
 * `autoCapitalize` prop is only a keyboard hint — some IMEs (and ADB text
 * injection on emulators) don't honor it, leaving the stored value lowercase.
 * @param {string} text - The text to capitalize
 * @returns {string} - The text with its first character uppercased
 */
export const capitalizeFirstLetter = (text) => {
  if (typeof text !== 'string' || text.length === 0) {
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * RFC-4122 v4 UUID. Math.random is sufficient here — this is a stable
 * identifier, not a security secret.
 * @returns {string}
 */
export const generateUuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
