import axios from 'axios';
import axiosRetry, { isNetworkOrIdempotentRequestError, retryAfter } from 'axios-retry';
import AppSettings from '../../../appsettings';
import { Logger } from '../../../utils/logger';

/**
 * Public Axios Client
 * - Base URL: Set your public API base URL.
 * - No Authorization header is attached.
 * - Handles specific HTTP status codes.
 */
const publicClient = axios.create({
  baseURL: AppSettings.BASE_URL,
  timeout: AppSettings.DEFAULT_TIMEOUT || 300000, // 5 minutes timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// A 429 is retried only when the server says when (Retry-After), and only for a short wait.
const MAX_RETRY_AFTER_MS = 15000;

const isMaintenanceResponse = error => error.response?.data?.errorCode === 'MAINTENANCE_MODE' || error.response?.data?.error_code === 'MAINTENANCE_MODE' || error.response?.data?.maintenance === true;

// Configure axios-retry with backoff. Each delay gets +/-20% jitter so clients that failed
// together do not retry in lockstep, and is never shorter than a Retry-After header asks.
axiosRetry(publicClient, {
  retries: AppSettings.MAX_RETRY_ATTEMPTS || 5,
  retryDelay: (retryCount, error) => {
    const delays = AppSettings.RETRY_DELAYS || [0, 1000, 2000, 5000, 10000, 15000];
    const base = delays[retryCount] || 15000;
    return Math.max(retryAfter(error), base * (0.8 + Math.random() * 0.4));
  },
  retryCondition: error => {
    // Never retry non-idempotent requests (POST/PATCH). The server may have already
    // processed the request before the network/timeout error surfaced, so replaying
    // it duplicates side effects — e.g. /auth/register creating a second organization
    // + user for the same email, which later manifests as "PAN already taken".
    const method = (error.config?.method || 'get').toLowerCase();
    if (!['get', 'head', 'options', 'put', 'delete'].includes(method)) {
      return false;
    }

    const status = error.response?.status;
    // Maintenance mode is a deliberate 503: retrying only delays the maintenance screen.
    if (status === 503 && isMaintenanceResponse(error)) {
      return false;
    }
    // A timed-out request may still be running on the server, and replaying it against a
    // struggling API only adds load; surface the timeout instead.
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return false;
    }
    if (status === 429) {
      const wait = retryAfter(error);
      return wait > 0 && wait <= MAX_RETRY_AFTER_MS;
    }

    // Retry on network errors and specific status codes
    const shouldRetry =
      isNetworkOrIdempotentRequestError(error) || // Network errors
      error.code === 'ENOTFOUND' || // DNS errors
      error.code === 'ECONNRESET' || // Connection reset
      error.code === 'ECONNREFUSED' || // Connection refused
      error.message?.includes('Network Error') ||
      [408, 500, 502, 503, 504].includes(status);

    if (shouldRetry) {
      Logger.info(`[PublicClient] Retrying request due to: ${error.code || error.message} (Status: ${error.response?.status || '-'})`);
    }

    return shouldRetry;
  },
});

// Request Interceptor
publicClient.interceptors.request.use(
  config => {
    // Log request for debugging
    Logger.info(`[PublicClient] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  error => {
    Logger.error('Request interceptor error:', error.message);
    return Promise.reject(error);
  },
);

// Response Interceptor
publicClient.interceptors.response.use(
  response => {
    Logger.info(`[PublicClient] Response - Status: ${response.status}`);
    return response;
  },
  error => {
    if (!error.response) {
      Logger.error('[PublicClient] Network Error:', error.message);
    } else {
      Logger.error(`[PublicClient] Error: ${error.response.status} - ${error.response.data?.message || error.message}`);
    }
    return Promise.reject(error);
  },
);

export default publicClient;
