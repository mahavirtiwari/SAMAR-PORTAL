/**
 * Returns the initials for a given name string.
 * e.g. "John Doe" -> "JD", "John" -> "J"
 */
export const getInitials = str => {
  if (!str) {
    return '';
  }

  const words = str
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);

  if (words.length === 0) {
    return '';
  }

  if (words.length === 1) {
    return words[0][0].toUpperCase();
  }

  const firstInitial = words[0][0].toUpperCase();
  const lastInitial = words[words.length - 1][0].toUpperCase();
  return `${firstInitial}${lastInitial}`;
};

/**
 * Converts a string to Title Case, e.g.
 * "TRIDENT AEROSPACE SYSTEMS PVT. LTD." -> "Trident Aerospace Systems Pvt. Ltd."
 * Useful when the backend returns names in all-caps.
 */
export const toTitleCase = str => {
  if (!str) {
    return '';
  }

  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
};

/**
 * Uppercases only the first character of a string, leaving the rest as typed.
 * Used to force-capitalize free-text input fields, since the native
 * `autoCapitalize` prop is only a keyboard hint — some IMEs (and ADB text
 * injection on emulators) don't honor it, leaving the stored value lowercase.
 */
export const capitalizeFirstLetter = text => {
  if (typeof text !== 'string' || text.length === 0) {
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * RFC-4122 v4 UUID. Used as the idempotency key (client_uuid) on uploads so an
 * axios-retry replay of a succeeded-but-unacknowledged request doesn't create a
 * duplicate row server-side. Math.random is sufficient here — this is a dedup
 * token, not a security secret.
 */
export const generateUuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
