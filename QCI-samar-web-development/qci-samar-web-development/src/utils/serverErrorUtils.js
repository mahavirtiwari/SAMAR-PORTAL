/**
 * Server Error Utilities
 *
 * Utilities for handling server-side validation errors and mapping them to Formik fields.
 *
 * Server Error Response Formats Supported:
 * 1. Field-level errors: { email: ["Error message"], password: ["Error message"] }
 * 2. Wrapped errors: { errors: { email: ["Error message"] } }
 * 3. Message only: { message: "General error message" }
 * 4. Nested errors: { addresses: [{ street: ["Error"] }] }
 */

/**
 * Normalizes server error response to a consistent format.
 * Handles various server response structures.
 *
 * @param {Object|string} serverError - The error response from the server
 * @returns {Object} Normalized error object with field names as keys and error messages as values
 */
export const normalizeServerErrors = serverError => {
  if (!serverError) {
    return {};
  }

  // If it's a string, return as a general message
  if (typeof serverError === 'string') {
    return { _general: serverError };
  }

  // If errors are wrapped in an 'errors' property
  if (serverError.errors && typeof serverError.errors === 'object') {
    return normalizeFieldErrors(serverError.errors);
  }

  // If it has field-level errors directly
  const fieldErrors = normalizeFieldErrors(serverError);

  // If there's also a message, include it as general error
  if (serverError.message) {
    fieldErrors._general = serverError.message;
  }

  // If no field errors and no message, return empty
  return fieldErrors;
};

/**
 * Normalizes field-level errors from server response.
 *
 * @param {Object} errors - Object with field names as keys
 * @returns {Object} Normalized field errors with first error message for each field
 */
const normalizeFieldErrors = errors => {
  const normalized = {};

  if (!errors || typeof errors !== 'object') {
    return normalized;
  }

  Object.keys(errors).forEach(key => {
    // Skip envelope / non-field properties. `reference` and `success` appear on
    // the generic 500 body and must never be treated as Formik field names.
    if (['message', 'status', 'statusCode', 'type', 'traceId', 'title', 'success', 'reference'].includes(key)) {
      return;
    }

    const value = errors[key];

    if (Array.isArray(value)) {
      // Take the first error message from the array
      if (value.length > 0) {
        // Handle nested array objects (for array fields like addresses[0].street)
        if (typeof value[0] === 'object' && value[0] !== null) {
          // Handle array of objects (nested validation errors)
          value.forEach((item, index) => {
            if (item && typeof item === 'object') {
              Object.keys(item).forEach(nestedKey => {
                const nestedValue = item[nestedKey];
                const fullKey = `${key}[${index}].${nestedKey}`;
                if (Array.isArray(nestedValue) && nestedValue.length > 0) {
                  normalized[fullKey] = nestedValue[0];
                } else if (typeof nestedValue === 'string') {
                  normalized[fullKey] = nestedValue;
                }
              });
            }
          });
        } else {
          normalized[key] = value[0];
        }
      }
    } else if (typeof value === 'string') {
      normalized[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      // Handle nested object errors (e.g., { address: { street: ["Error"] } })
      const nestedErrors = normalizeFieldErrors(value);
      Object.keys(nestedErrors).forEach(nestedKey => {
        normalized[`${key}.${nestedKey}`] = nestedErrors[nestedKey];
      });
    }
  });

  return normalized;
};

/**
 * Maps server errors to Formik's setFieldError function.
 * Call this in your form submission error handler.
 *
 * @param {Object} serverError - The error response from the server
 * @param {Function} setFieldError - Formik's setFieldError function
 * @returns {string|null} General error message if present, null otherwise
 */
export const mapServerErrorsToFormik = (serverError, setFieldError) => {
  const normalizedErrors = normalizeServerErrors(serverError);
  let generalError = null;
  Object.keys(normalizedErrors).forEach(fieldName => {
    if (fieldName === '_general') {
      generalError = normalizedErrors[fieldName];
    } else {
      setFieldError(fieldName, normalizedErrors[fieldName]);
    }
  });

  return generalError;
};

/**
 * Extracts the first field error from a server error response.
 * Useful for displaying a single error message in a toast.
 *
 * @param {Object} serverError - The error response from the server
 * @returns {string} The first error message found, or a default message
 */
export const getFirstServerError = serverError => {
  if (!serverError) {
    return 'An unexpected error occurred. Please try again or contact support.';
  }

  if (typeof serverError === 'string') {
    return serverError;
  }

  // Check for wrapped errors
  const errors = serverError.errors || serverError;

  // Look for field-level errors
  const fieldKeys = Object.keys(errors).filter(key => !['message', 'status', 'statusCode', 'type', 'title', 'traceId', 'success', 'reference'].includes(key));

  for (const key of fieldKeys) {
    const value = errors[key];
    if (Array.isArray(value) && value.length > 0) {
      return value[0];
    }
    if (typeof value === 'string') {
      return value;
    }
  }

  // Fallback to message
  return serverError.message || errors.message || 'An unknown error occurred';
};

/**
 * Gets a specific field error from server response.
 *
 * @param {Object} serverError - The error response from the server
 * @param {string} fieldName - The field name to get error for
 * @returns {string|null} The error message for the field, or null
 */
export const getServerFieldError = (serverError, fieldName) => {
  if (!serverError || !fieldName) {
    return null;
  }

  // Check wrapped errors first
  const errors = serverError.errors || serverError;

  const fieldValue = errors[fieldName];

  if (Array.isArray(fieldValue) && fieldValue.length > 0) {
    return fieldValue[0];
  }

  if (typeof fieldValue === 'string') {
    return fieldValue;
  }

  return null;
};

/**
 * Checks if a server error contains field-level validation errors.
 *
 * @param {Object} serverError - The error response from the server
 * @returns {boolean} True if field-level errors exist
 */
export const hasFieldErrors = serverError => {
  if (!serverError) {
    return false;
  }

  const normalizedErrors = normalizeServerErrors(serverError);
  return Object.keys(normalizedErrors).some(key => key !== '_general');
};

const APPLICATION_STATUS_LABELS = {
  draft: 'Draft',
  payment_pending: 'Payment Pending',
  payment_failed: 'Payment Failed',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const humanizeStatus = raw => {
  if (!raw) {
    return '';
  }
  const key = String(raw).trim().toLowerCase();
  if (APPLICATION_STATUS_LABELS[key]) {
    return APPLICATION_STATUS_LABELS[key];
  }
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

/**
 * Rewrites the backend "unit already has an application in progress" message
 * into user-friendly copy. Returns the original message unchanged if it
 * doesn't match the expected pattern.
 */
export const humanizeApplicationInProgressError = message => {
  if (!message || typeof message !== 'string') {
    return message;
  }
  if (!/already has an application in progress/i.test(message)) {
    return message;
  }

  const appIdMatch = message.match(/Application\s*#\s*([A-Z0-9-]+)/i);
  const statusMatch = message.match(/Status:\s*([A-Za-z_\s-]+)/i);
  const appId = appIdMatch ? appIdMatch[1] : null;
  const status = statusMatch ? humanizeStatus(statusMatch[1]) : null;

  const idPart = appId ? ` — ${appId}` : '';
  const statusPart = status ? ` (${status})` : '';
  return `You already have an application in progress${idPart}${statusPart}. Please complete it before starting a new one.`;
};

export default {
  normalizeServerErrors,
  mapServerErrorsToFormik,
  getFirstServerError,
  getServerFieldError,
  hasFieldErrors,
  humanizeApplicationInProgressError,
};
