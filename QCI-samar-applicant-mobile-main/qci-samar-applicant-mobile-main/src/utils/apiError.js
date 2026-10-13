const OFFLINE_MESSAGE = 'Please check your internet connection and try again.';

/**
 * Map a thrown API/axios error to a user-facing message.
 * Offline rejections (from the request interceptor) and bare network errors
 * carry no `response`, so without this they collapsed to the generic fallback.
 * @param {*} error - The caught error.
 * @param {string} fallback - Message when nothing more specific applies.
 * @returns {string}
 */
export const getApiErrorMessage = (error, fallback = 'An unknown error occurred') => {
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
};
