/**
 * Application-wide constants
 * Centralized location for magic numbers and configuration values
 */

// =============================================================================
// TIMING CONSTANTS (milliseconds)
// =============================================================================

/** Debounce delay for search inputs and API calls */
export const DEBOUNCE_DELAY_MS = 300;

/** Short delay for URL cleanup (blob revocation) */
export const URL_REVOKE_DELAY_MS = 1000;

/**
 * Lifetime of a blob URL opened in a new tab. The tab's viewer (PDF Save/Download)
 * re-reads the blob URL, so revoking it early fails the download with a network error.
 */
export const OPENED_BLOB_URL_TTL_MS = 30 * 60 * 1000;

/** Delay before auto-hiding success messages */
export const SUCCESS_MESSAGE_DELAY_MS = 2000;

/** Delay before auto-hiding error/info messages */
export const MESSAGE_DISPLAY_DELAY_MS = 3000;

/** Timer tick interval (1 second) */
export const TIMER_TICK_MS = 1000;

// =============================================================================
// PAGINATION CONSTANTS
// =============================================================================

/** Default page size for tables and lists */
export const DEFAULT_PAGE_SIZE = 10;

/** Page size for modal dropdowns and small lists */
export const MODAL_LIST_PAGE_SIZE = 15;

/** Page size for large lists (processes, members, etc.) */
export const LARGE_LIST_PAGE_SIZE = 100;

/** Page size when fetching all items (use sparingly) */
export const FETCH_ALL_PAGE_SIZE = 1000;

// =============================================================================
// INPUT VALIDATION CONSTANTS
// =============================================================================

/** Maximum length for PIN/postal codes */
export const PIN_CODE_LENGTH = 6;

/** Maximum length for Indian mobile numbers */
export const MOBILE_NUMBER_LENGTH = 10;

/** Maximum length for Indian landline numbers */
export const LANDLINE_NUMBER_LENGTH = 12;

/** Maximum length for name fields */
export const NAME_MAX_LENGTH = 100;

/** Maximum length for email fields */
export const EMAIL_MAX_LENGTH = 254;

/** Maximum length for assessor comment / remark fields */
export const COMMENT_MAX_LENGTH = 5000;

/** Maximum length for the assessor domain name field */
export const DOMAIN_MAX_LENGTH = 1000;

// =============================================================================
// UI CONSTANTS
// =============================================================================

/** Number of recent items to show in attendance lists */
export const RECENT_ITEMS_LIMIT = 2;

/** Default animation duration */
export const ANIMATION_DURATION_MS = 300;
