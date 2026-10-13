const AUTH_ERROR_MAP = [
  {
    match: /invalid (credentials|samar id or password|password)/i,
    message: 'The SAMAR ID or password you entered is incorrect. Please try again.'
  },
  {
    match: /(user|account) not found|no (user|account)/i,
    message: 'No account found with this SAMAR ID. Please check your SAMAR ID or sign up.'
  },
  {
    match: /(account|user).*lock/i,
    message: 'Your account has been temporarily locked. Please try again later or contact support.'
  },
  {
    match: /email.*(not.*verified|unverified)|verify.*email/i,
    message: 'Please verify your email address before logging in.'
  },
  {
    match: /too many (login )?attempts|rate.?limit/i,
    message: 'Too many login attempts. Please wait a few minutes and try again.'
  },
  {
    match: /(network|connection).*(error|fail)|failed to fetch/i,
    message: 'Network error. Please check your connection and try again.'
  }
];

const GENERIC_FALLBACK = 'Something went wrong. Please try again.';

export function mapAuthError(error) {
  const raw = extractMessage(error);
  if (!raw) {
    return GENERIC_FALLBACK;
  }
  for (const entry of AUTH_ERROR_MAP) {
    if (entry.match.test(raw)) {
      return entry.message;
    }
  }
  return raw;
}

const FIELD_LABELS = {
  selfie: 'Selfie',
  latitude: 'Latitude',
  longitude: 'Longitude'
};

const humanizeFieldName = (field) => {
  if (FIELD_LABELS[field]) {
    return FIELD_LABELS[field];
  }
  return field
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
};

const humanizeValidationMessage = (field, message) => {
  if (typeof message !== 'string') {
    return message;
  }
  const label = humanizeFieldName(field);
  // Replace any reference to the raw field name with the friendly label.
  return message
    .replace(new RegExp(`\\b${field}\\b`, 'g'), label.toLowerCase())
    .replace(/^./, (c) => c.toUpperCase());
};

// Two different situations, deliberately two different messages. The first is a
// dead end — signing in genuinely cannot happen without a connection. The second
// is not a failure at all, and must never be worded as one.
const OFFLINE_MESSAGE = 'Please check your internet connection and try again.';
const OFFLINE_QUEUED_MESSAGE =
  'You are offline. This is saved on your device and will sync automatically when you are back online.';

export function mapApiError(error) {
  // An offline skip is the app working as designed: the request was never sent,
  // the write is in the outbox, and the sync engine will push it on reconnect.
  // Without this branch the raw internal string ("offline: request skipped,
  // serving local data") reached the assessor in a toast titled "Save Failed",
  // telling them their work was lost when it was safely queued. That is a large
  // part of why the field team read normal offline behaviour as a fault.
  if (error?.isOffline) {
    return OFFLINE_QUEUED_MESSAGE;
  }
  const errors = error?.errors || error?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const flattened = Object.entries(errors)
      .flatMap(([field, messages]) =>
        (Array.isArray(messages) ? messages : [messages]).map((m) =>
          humanizeValidationMessage(field, m)
        )
      )
      .filter(Boolean);
    if (flattened.length) {
      return flattened.join('\n');
    }
  }
  const raw = extractMessage(error);
  return raw || GENERIC_FALLBACK;
}

/**
 * True when a request never reached the server — no connectivity, a timeout, a
 * DNS or TLS failure. The discriminator is the absence of a `response`: an
 * axios error that carries one was answered by the server, however badly.
 *
 * This is the difference between "the server refused you" and "the network was
 * not there", and for the token refresh it decides whether the session ends. A
 * refresh that times out on a weak site link must NOT be read as a rejected
 * session: the assessor is mid-shift, often with no signal to log back in with.
 */
export const isNetworkFailure = (error) =>
  !!error?.isOffline || (!!error && error.response === undefined);

/**
 * Map a thrown API/axios error to a user-facing message for the auth thunks.
 * Offline rejections (from the request interceptor) and bare network errors
 * carry no `response`, so without this they collapsed to "An unknown error
 * occurred".
 * @param {*} error - The caught error.
 * @param {string} fallback - Message when nothing more specific applies.
 * @returns {string}
 */
export function getApiErrorMessage(error, fallback = 'An unknown error occurred') {
  if (error?.isOffline) {
    return OFFLINE_MESSAGE;
  }
  const serverMessage = error?.response?.data?.message;
  if (serverMessage) {
    return serverMessage;
  }
  // No response at all means the request never reached the server (network
  // error / timeout / DNS) — treat as a connectivity problem, not "unknown".
  if (error && error.response === undefined) {
    return OFFLINE_MESSAGE;
  }
  return fallback;
}

function extractMessage(error) {
  if (!error) {
    return '';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error.message === 'string') {
    return error.message;
  }
  if (typeof error.error === 'string') {
    return error.error;
  }
  return '';
}
