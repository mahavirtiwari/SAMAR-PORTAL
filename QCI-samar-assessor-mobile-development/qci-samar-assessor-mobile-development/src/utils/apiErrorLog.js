import { Logger } from './logger';

// One-line, level-appropriate log for a failed API call. Dumping the raw axios
// error prints the whole request config (headers, retry state, token) as an
// ERROR for what is usually just "the phone is offline", which buried the real
// failures in the field logs.
export const describeApiError = (error) => {
  if (error?.isOffline) {
    return 'offline, request skipped';
  }
  const status = error?.response?.status;
  const message =
    error?.response?.data?.message || error?.message || (error ? String(error) : 'unknown error');
  return status ? `HTTP ${status}: ${message}` : `no response: ${message}`;
};

export const logApiError = (context, error) => {
  if (error?.isOffline) {
    Logger.info(`${context}: offline, request skipped`);
    return;
  }
  Logger.error(`${context}: ${describeApiError(error)}`);
};
