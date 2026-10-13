import axios from 'axios';
import axiosRetry, { isNetworkOrIdempotentRequestError } from 'axios-retry';
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

// Configure axios-retry with exponential backoff
axiosRetry(publicClient, {
  retries: AppSettings.MAX_RETRY_ATTEMPTS || 5,
  retryDelay: retryCount => {
    const delays = AppSettings.RETRY_DELAYS || [0, 1000, 2000, 5000, 10000, 15000];
    return delays[retryCount] || 15000;
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

    // Retry on network errors, timeouts, and specific status codes
    const shouldRetry =
      isNetworkOrIdempotentRequestError(error) || // Network errors
      error.code === 'ECONNABORTED' || // Timeout errors
      error.code === 'ENOTFOUND' || // DNS errors
      error.code === 'ECONNRESET' || // Connection reset
      error.code === 'ECONNREFUSED' || // Connection refused
      error.message?.includes('Network Error') ||
      error.message?.includes('timeout') ||
      [408, 429, 500, 502, 503, 504].includes(error.response?.status);

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
