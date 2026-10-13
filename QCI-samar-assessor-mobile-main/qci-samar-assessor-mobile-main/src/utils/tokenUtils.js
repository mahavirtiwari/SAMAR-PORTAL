/**
 * Shared token utility helpers.
 * Centralises expiry parsing so all callers handle ISO strings,
 * Unix seconds, and Unix milliseconds consistently.
 */

/**
 * Parse a token expiry value into a Unix-millisecond timestamp.
 * Returns null when the value is absent or unparseable — treat null as expired.
 *
 * @param {string|number|null|undefined} expiry
 * @returns {number|null}
 */
export const parseExpiry = (expiry) => {
  if (!expiry) {
    return null;
  }
  if (typeof expiry === 'number') {
    // Distinguish Unix seconds (< 1e12) from milliseconds
    return expiry < 1e12 ? expiry * 1000 : expiry;
  }
  const parsed = Date.parse(expiry);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Returns true when the token expiry has passed (or is within bufferMs of passing).
 * An unreadable / missing expiry is treated as already expired.
 *
 * @param {string|number|null|undefined} expiry
 * @param {number} [bufferMs=0]   Extra milliseconds to treat as expired early (e.g. 30 000 for a 30 s buffer)
 * @returns {boolean}
 */
export const isTokenExpired = (expiry, bufferMs = 0) => {
  const expiryMs = parseExpiry(expiry);
  if (expiryMs === null) {
    return true;
  }
  return expiryMs <= Date.now() + bufferMs;
};
