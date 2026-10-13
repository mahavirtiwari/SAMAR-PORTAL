// src/utils/FormatIndianLandline.js

import { LANDLINE_NUMBER_LENGTH } from '../constants/appConstants';

/**
 * Parses a landline number string, removing all non-digit characters.
 * @param {string} value - The input string.
 * @returns {string} The digits-only string.
 */
export const parseIndianLandline = value => {
  if (!value) {
    return '';
  }
  // Keep only digits and limit to 12
  return value.replace(/\D/g, '').slice(0, LANDLINE_NUMBER_LENGTH);
};

/**
 * Formats a string of digits into a readable Indian landline number format.
 * This function attempts to group numbers logically but does not validate STD codes.
 * Example formats: 011 XXXX XXXX or 0123 XXX XXXX
 * @param {string} digits - The digits-only string, which should include the STD code.
 * @returns {string} The formatted landline number string.
 */
export const formatIndianLandline = digits => {
  if (!digits) {
    return '';
  }
  const cleaned = parseIndianLandline(digits);
  const len = cleaned.length;

  if (len === 0) {
    return '';
  }

  // Short values - just return digits
  if (len <= 2) {
    return cleaned;
  }

  // If full 12-digit number (STD + 8-digit local), format as xxxx-xxxxxxxx
  if (len === 12) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 12)}`;
  }

  // For other common lengths, provide readable grouping
  if (len <= 5) {
    // e.g., 011 12 -> join only non-empty parts to avoid trailing spaces
    const parts = [cleaned.slice(0, 3), cleaned.slice(3)].filter(Boolean);
    return parts.join(' ');
  }
  if (len <= 8) {
    // e.g., 011 123 456 -> join only non-empty parts
    const parts = [cleaned.slice(0, 3), cleaned.slice(3, 6), cleaned.slice(6)].filter(Boolean);
    return parts.join(' ');
  }
  // 9-11 digits -> try 3-4-remaining grouping
  if (len <= 11) {
    const parts = [cleaned.slice(0, 3), cleaned.slice(3, 7), cleaned.slice(7)].filter(Boolean);
    return parts.join(' ');
  }

  // Fallback: just return cleaned
  return cleaned;
};
