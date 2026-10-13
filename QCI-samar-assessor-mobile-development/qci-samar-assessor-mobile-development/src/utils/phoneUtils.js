import { parsePhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import { Logger } from './logger';

/**
 * Phone utility functions for the application
 */

/**
 * Formats a phone number in international format
 * @param {string} phoneNumber - The phone number to format
 * @returns {string} - The formatted phone number
 */
export const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) {
    Logger.error('Invalid phone number: empty or undefined');
    return '';
  }

  try {
    return parsePhoneNumber(phoneNumber).formatInternational();
  } catch (error) {
    Logger.error('Error formatting phone number:', error);
    return phoneNumber;
  }
};

/**
 * Extracts the national number portion from a phone number
 * @param {string} phoneNumber - The phone number
 * @returns {string|null} - The national number
 */
export const getNationalNumber = (phoneNumber) => {
  if (!phoneNumber) {
    return null;
  }

  // Remove spaces
  const cleanedNumber = phoneNumber.replace(/\s/g, '');

  if (!cleanedNumber.startsWith('+')) {
    return cleanedNumber; // Return as is if there's no country code
  }

  try {
    const parsedNumber = parsePhoneNumberFromString(cleanedNumber);
    return parsedNumber ? parsedNumber.nationalNumber : null;
  } catch (error) {
    Logger.error('Error extracting national number:', error);
    return null;
  }
};

/**
 * Extracts the country code from a phone number
 * @param {string} phoneNumber - The phone number
 * @returns {string|null} - The country code with + prefix
 */
export const getCountryCode = (phoneNumber) => {
  if (!phoneNumber) {
    return null;
  }

  // Remove spaces
  const cleanedNumber = phoneNumber.replace(/\s/g, '');

  if (!cleanedNumber.startsWith('+')) {
    return null; // No country code present
  }

  try {
    const parsedNumber = parsePhoneNumberFromString(cleanedNumber);
    return parsedNumber ? `+${parsedNumber.countryCallingCode}` : null;
  } catch (error) {
    Logger.error('Error extracting country code:', error);
    return null;
  }
};

/**
 * Validates if a phone number is valid for a specific country
 * @param {string} phoneNumber - The phone number to validate
 * @param {string} countryCode - The ISO country code (e.g., 'US', 'IN')
 * @returns {boolean} - Whether the phone number is valid
 */
export const isValidPhoneNumber = (phoneNumber, countryCode) => {
  if (!phoneNumber) {
    return false;
  }

  try {
    const parsedNumber = parsePhoneNumberFromString(phoneNumber, countryCode);
    return parsedNumber ? parsedNumber.isValid() : false;
  } catch (error) {
    Logger.error('Error validating phone number:', error);
    return false;
  }
};

// Legacy function names for backward compatibility
export const getCountryNameFromPhoneNumber = getNationalNumber;
export const getCountryCodeFromPhoneNumber = getCountryCode;

/**
 * Formats a phone number to Indian format (+91 XXXXX XXXXX)
 * @param {string} phoneNumber - The phone number to format
 * @returns {string} - The formatted phone number
 */
export const formatIndianPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) {
    return '';
  }
  const cleaned = phoneNumber.toString().replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phoneNumber;
};
