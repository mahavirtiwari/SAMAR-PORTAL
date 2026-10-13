import axios from 'axios';
import axiosRetry from 'axios-retry';
import AppSettings from '../../../../appsettings';
import { checkInternetConnection } from '../../../utils/checkInternetConnection';

const PublicClient = axios.create({
  baseURL: AppSettings.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Source: 'App',
    'X-Client-Build': `${AppSettings.VERSION_DISPLAY}+${AppSettings.COMMIT || 'unknown'}`
  },
  timeout: 30000
});

// Interceptor to log cURL command for every request
PublicClient.interceptors.request.use(
  async (config) => {
    // Fail fast when offline rather than burning the retry backoff (these are
    // auth endpoints that can't work offline anyway).
    if (!(await checkInternetConnection())) {
      const offlineError = new Error('offline: request skipped');
      offlineError.isOffline = true;
      offlineError.config = config;
      return Promise.reject(offlineError);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Configure axios-retry with modified exponential backoff
axiosRetry(PublicClient, {
  retries: 3,
  retryDelay: (retryCount) => (retryCount === 0 ? 0 : Math.pow(2, retryCount) * 1000), // Immediate retry for the first attempt
  retryCondition: (error) => {
    // Never retry session-creating auth POSTs — a replay can spawn a duplicate
    // session server-side. Refresh is in the same class: the server rotates the
    // refresh token on first use, so a replay presents a retired token and can
    // end the session the first attempt just renewed.
    const url = error.config?.url || '';
    if (
      url.includes('auth/login') ||
      url.includes('auth/check-active-session') ||
      url.includes('auth/verify-login-otp') ||
      url.includes('auth/refresh')
    ) {
      return false;
    }
    // Retry only transient server responses — never bare network errors (which
    // offline just stall the UI through the backoff before failing).
    const status = error.response?.status;
    return status === 429 || (status >= 500 && status <= 599);
  }
});

export default PublicClient;
