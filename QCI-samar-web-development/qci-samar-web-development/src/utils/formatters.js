/**
 * Utility functions for formatting values
 */

import { Logger } from './logger';

/**
 * Format a number as Indian Rupee currency
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string (e.g., "₹1,00,000.00")
 */
export const formatCurrency = amount => {
  if (amount === null || amount === undefined) {
    return '₹0.00';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format a date string to Indian locale format
 * @param {string|Date} dateString - The date to format
 * @returns {string} Formatted date string (e.g., "5 Sep, 2025")
 */
export const formatDate = dateString => {
  if (!dateString) {
    return 'N/A';
  }
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return 'N/A';
  }
  const day = date.getDate();
  const monthShort = date.toLocaleString('en-IN', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${monthShort}, ${year}`;
};

/**
 * Format a date string to full date format
 * @param {string|Date} dateString - The date to format
 * @returns {string} Formatted date string (e.g., "5 September 2025")
 */
export const formatDateFull = dateString => {
  if (!dateString) {
    return 'N/A';
  }
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return 'N/A';
  }
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Format a time string to 12-hour format
 * @param {string} timeString - The time to format (e.g., "14:00" or "14:00:00")
 * @returns {string} Formatted time string (e.g., "02:00 PM")
 */
export const formatTime = timeString => {
  if (!timeString) {
    return '';
  }
  // If it's already a Date object, format directly
  if (timeString instanceof Date) {
    return timeString.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  // If it's an ISO datetime string (e.g., "2026-02-09T09:37:00.000000Z"), parse as Date
  if (typeof timeString === 'string' && timeString.includes('T')) {
    const date = new Date(timeString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
  }
  // If it's a time string like "14:00" or "14:00:00"
  const timeParts = timeString.split(':');
  if (timeParts.length >= 2) {
    const hours = parseInt(timeParts[0], 10);
    const minutes = timeParts[1];
    if (isNaN(hours)) {
      return timeString;
    }
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours.toString().padStart(2, '0')}:${minutes} ${period}`;
  }
  return timeString;
};

/**
 * Format a date and time string to combined format
 * @param {string|Date} dateString - The date/time to format
 * @returns {string} Formatted date time string (e.g., "5 Sep, 2025, 02:00 PM")
 */
export const formatDateTime = dateString => {
  if (!dateString) {
    return 'N/A';
  }
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return 'N/A';
  }
  const datePart = formatDate(dateString);
  const timePart = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
};

/**
 * Format a latitude/longitude pair for display; null when either is missing
 * so callers can hide the location line instead of showing a bogus value.
 * @returns {string|null} e.g. "28.628987, 77.239020"
 */
export const formatCoordinates = (lat, lng) => {
  if (!lat || !lng) {
    return null;
  }
  return `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
};

/**
 * Date-time for photo overlays and comment stamps: a dash when missing,
 * matching the empty-value glyph used on the detail headers.
 */
export const formatDateTimeOrDash = dateString => (dateString ? formatDateTime(dateString) : '-');

/**
 * Format a date string to ISO format (YYYY-MM-DD)
 * @param {string|Date} dateString - The date to format
 * @returns {string} Formatted date string (e.g., "2025-09-05")
 */
export const formatDateISO = dateString => {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().split('T')[0];
};

/**
 * Format a number with Indian number system grouping
 * @param {number} number - The number to format
 * @returns {string} Formatted number string (e.g., "1,00,000")
 */
export const formatNumber = number => {
  if (number === null || number === undefined) {
    return '';
  }
  return new Intl.NumberFormat('en-IN').format(number);
};

/**
 * Format a numeric input value for display in a text field while the user is typing.
 * Applies Indian number grouping to the integer part but preserves the decimal
 * portion exactly as typed (including a trailing "." and trailing zeros), so the
 * user can enter decimals like "12.", "12.0" or "12.50" without characters being
 * stripped mid-entry.
 * @param {string|number|null|undefined} val
 * @returns {string} Formatted value for display (e.g. "1,234.50"), or '' when empty
 */
export const formatNumberInput = val => {
  if (val === null || val === undefined) {
    return '';
  }
  const s = String(val);
  const negative = s.trim().startsWith('-');
  // Keep only digits and decimal points, then collapse to a single decimal point
  const cleaned = s.replace(/[^0-9.]/g, '');
  if (cleaned === '') {
    return '';
  }
  const hasDot = cleaned.includes('.');
  const [intPart, ...rest] = cleaned.split('.');
  const decPart = rest.join('');
  const formattedInt = intPart === '' ? '' : new Intl.NumberFormat('en-IN').format(Number(intPart));
  let result = formattedInt;
  if (hasDot) {
    result += '.' + decPart;
  }
  return (negative ? '-' : '') + result;
};

/**
 * Format a phone number
 * @param {string} phone - The phone number to format
 * @returns {string} Formatted phone number
 */
export const formatPhone = phone => {
  if (!phone) {
    return 'N/A';
  }
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  // Format as Indian phone number if 10 digits
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
};

/**
 * Parse a numeric input value commonly produced by form fields.
 * - Treats empty string or whitespace as null
 * - Removes commas and other common thousands separators
 * - Returns a Number when parsable, otherwise null
 * @param {string|number|null|undefined} val
 * @returns {number|null}
 */
export const parseNumericOrNull = val => {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  const s = String(val).trim();
  if (s === '') {
    return null;
  }
  // Remove commas and non-numeric characters except dot and minus
  const cleaned = s.replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '.' || cleaned === '-' || cleaned === '-.' || cleaned === ',') {
    return null;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/**
 * Format a full address with district, state, and pincode
 * @param {string} address - The street address
 * @param {string} district - The district name
 * @param {string} state - The state name
 * @param {string} pinCode - The pincode/postal code
 * @returns {string} Formatted full address (e.g., "123 Main St, District, State - 123456")
 */
export const formatFullAddress = (address, district, state, pinCode) => {
  const parts = [];
  if (address) {
    parts.push(address);
  }
  if (district) {
    parts.push(district);
  }
  if (state) {
    parts.push(state);
  }
  const addressLine = parts.join(', ');
  if (pinCode) {
    return addressLine ? `${addressLine} - ${pinCode}` : pinCode;
  }
  return addressLine || '-';
};

export const formatDisplayValue = value => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (Array.isArray(value)) {
    return value.map(v => formatDisplayValue(v)).join(', ');
  }
  // File object (from file inputs)
  if (typeof File !== 'undefined' && value instanceof File) {
    return value.name || 'File';
  }
  if (typeof value === 'object') {
    if (value.name) {
      return value.name;
    }
    if (value.fileName) {
      return value.fileName;
    }
    if (value.filename) {
      return value.filename;
    }
    // if backend returns an object with data or id, try to show readable bits
    if (typeof value.data === 'string') {
      return value.data;
    }
    try {
      return JSON.stringify(value);
    } catch (e) {
      Logger.error('Error stringifying value in formatDisplayValue:', e);
      return String(value);
    }
  }
  return String(value);
};

// Prefer first + last name; fall back to a single name/fullName field.
export const formatPersonName = person => {
  if (!person) {
    return '';
  }
  const combined = [person.firstName, person.lastName].filter(Boolean).join(' ');
  return combined || person.name || person.fullName || '';
};

// Person name with designation appended, e.g. "Srinivas Reddy (Director - Engineering)".
export const formatPersonNameWithDesignation = person => {
  const name = formatPersonName(person);
  if (person?.designation) {
    return name ? `${name} (${person.designation})` : person.designation;
  }
  return name;
};

const ASSESSOR_ROLE_LABELS = {
  lead_assessor: 'Lead Assessor',
  co_assessor: 'Co-Assessor',
};

// Label for an assessment team member's role, e.g. "Lead Assessor". '' when unknown.
export const formatAssessorRole = role => ASSESSOR_ROLE_LABELS[role] || '';

// Designation for the uploader of an assessment image. Assessor uploads carry the
// Lead/Co role on `teamMember.role`; applicant uploads carry a free-text designation
// on `uploadedByUser`. Falls back to "Applicant".
export const formatUploaderDesignation = picture => {
  const roleLabel = formatAssessorRole(picture?.teamMember?.role);
  if (roleLabel) {
    return roleLabel;
  }
  return picture?.uploadedByUser?.designation || 'Applicant';
};
