import axios from 'axios';
import axiosRetry from 'axios-retry';
import { Alert } from 'react-native';
import AppSettings from '../../../../appsettings';
import {
  logoutAction,
  refreshToken as refreshTokenAction,
} from '../../../redux/action/accountAction';
import { setMaintenanceMode } from '../../../redux/slices/accountSlice';
import { checkInternetConnection } from '../../../utils/checkInternetConnection';
import { Logger } from '../../../utils/logger';
import { parseExpiry } from '../../../utils/tokenUtils';
import { getToken } from '../../storage/authStore';

function generateCurlCommand(config) {
  let curl = `curl -X ${config.method?.toUpperCase() || 'GET'} '${config.baseURL || ''}${
    config.url
  }'`;
  if (config.headers) {
    Object.entries(config.headers).forEach(([key, value]) => {
      curl += ` -H '${key}: ${value}'`;
    });
  }
  if (config.data) {
    const dataString = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
    curl += ` --data '${dataString}'`;
  }
  return curl;
}

// Define timeout for requests
const REQUEST_TIMEOUT = 30000; // 30 seconds

// Multipart photo uploads (site pictures, site-tour photos) run ~0.4–1.5MB
// each; on weak field networks 30s is not enough and the upload aborts
// mid-transfer, so file-upload endpoints pass this instead. 2 minutes covers a
// 1.5MB photo at ~13KB/s; the old 5 minutes let a stalled upload hold a server
// worker that long, and the outbox retries a timed-out row anyway.
export const UPLOAD_TIMEOUT = 120000;

const userClient = axios.create({
  baseURL: AppSettings.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Build': `${AppSettings.VERSION_DISPLAY}+${AppSettings.COMMIT || 'unknown'}`,
  },
  timeout: REQUEST_TIMEOUT,
});

// Configure axios-retry with exponential backoff. exponentialDelay (axios-retry
// 4.x) gives 2s/4s/8s plus 0-20% random jitter, so devices retrying the same
// failure do not land in lockstep, and waits at least as long as a Retry-After
// header asks.
axiosRetry(userClient, {
  retries: 3,
  retryDelay: (retryCount, error) => axiosRetry.exponentialDelay(retryCount, error, 1000),
  retryCondition: error => {
    // Don't retry on 503 if it's maintenance mode
    if (error.response?.status === 503) {
      const isMaintenanceMode =
        error.response?.data?.errorCode === 'MAINTENANCE_MODE' ||
        error.response?.data?.error_code === 'MAINTENANCE_MODE' ||
        error.response?.data?.maintenance === true;
      if (isMaintenanceMode) {
        return false;
      }
    }
    // Don't retry 429 on auth endpoints (rate limited)
    if (error.response?.status === 429) {
      const url = error.config?.url || '';
      if (url.includes('/auth/')) {
        return false;
      }
    }
    // Retry only transient SERVER responses — never a bare network error. With
    // no connectivity there's no response, so retrying just burns the backoff
    // before the caller's fallback runs. Fail the request fast.
    const status = error.response?.status;
    // Replay only idempotent methods: a POST that hit a 5xx/429 may already
    // have been processed server-side, and resending it would duplicate it.
    // (Outbox uploads are retried by the sync engine, deduped on clientUuid.)
    const method = (error.config?.method || "get").toLowerCase();
    const idempotent = ["get", "head", "options", "put", "delete"].includes(method);
    return idempotent && (status === 429 || (status >= 500 && status <= 599));
  },
});

// When the server terminates a session, every in-flight request fails with
// SESSION_TERMINATED at once; without this guard each one stacks its own
// native Alert (flicker, OK needs N taps) and dispatches logout N times.
let sessionTerminationHandled = false;

function handleSessionTerminated(message) {
  if (sessionTerminationHandled) {
    return;
  }
  sessionTerminationHandled = true;
  Logger.warn(`Session terminated: ${message}`);
  if (store) {
    store.dispatch(logoutAction());
  }
}

let store;
export const injectStore = _store => {
  store = _store;
};

// Single promise to track token refresh
let refreshTokenPromise = null;
let sessionExpiredHandled = false;

// Queue for failed requests during token refresh
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

// A refresh started here must drain failedQueue exactly like the response
// interceptor's own refresh: requests queued while a refresh is in flight are
// settled by whichever refresh wins, so both paths share this helper. Without
// the shared processQueue, a request that queues behind a proactive
// (request-interceptor) refresh never settles and its screen hangs on a
// spinner forever.
function startTokenRefresh() {
  refreshTokenPromise = (async () => {
    try {
      Logger.info('Refreshing token...');
      const refreshTokenData = await getToken('refreshToken');
      if (!refreshTokenData?.token) {
        throw new Error('No refresh token available');
      }

      const refreshExpiry = parseExpiry(refreshTokenData.expiry);
      if (refreshExpiry === null || refreshExpiry <= Date.now()) {
        throw new Error('Refresh token expired');
      }

      if (!store) {
        throw new Error('Store not available for token refresh');
      }

      const refreshResult = await store.dispatch(refreshTokenAction());
      if (refreshResult.error) {
        throw new Error(
          `Token refresh failed: ${refreshResult.error.message || 'Unknown error'}`,
        );
      }

      const newAccessToken = await getToken('accessToken');
      if (!newAccessToken?.token) {
        throw new Error('Failed to retrieve new access token');
      }

      Logger.info('Token refreshed successfully');
      processQueue(null, newAccessToken.token);
      return newAccessToken.token;
    } catch (refreshError) {
      Logger.error('Token refresh failed:', refreshError.message);
      processQueue(refreshError, null);
      if (!sessionExpiredHandled) {
        sessionExpiredHandled = true;
        Alert.alert('Session Expired', 'Your session has expired. Please log in again.', [
          { text: 'OK', onPress: () => store && store.dispatch(logoutAction()) },
        ]);
      }
      throw refreshError;
    } finally {
      refreshTokenPromise = null;
    }
  })();
  return refreshTokenPromise;
}

/**
 * Attach Authorization Token Before Requests
 * Proactively refreshes token if expired or about to expire
 */
userClient.interceptors.request.use(
  async config => {
    // Fail fast when offline so the caller doesn't wait out the 30s timeout
    // and retry backoff. The error carries no `response`, so the response
    // interceptor and axios-retry both pass it straight through to the caller.
    if (!(await checkInternetConnection())) {
      const offlineError = new Error('offline: request skipped, serving local data');
      offlineError.isOffline = true;
      offlineError.config = config;
      return Promise.reject(offlineError);
    }
    try {
      const token = await getToken('accessToken');

      if (!token?.token) {
        Logger.error('No access token available');
        if (store && (await checkInternetConnection())) {
          await store.dispatch(logoutAction());
        }
        throw new Error('No access token available');
      }

      // Check if token is expired or about to expire
      const currentTime = Date.now();
      const tokenExpiry = parseExpiry(token.expiry);
      const bufferTime = 30 * 1000; // 30 seconds buffer

      if (tokenExpiry && tokenExpiry <= currentTime + bufferTime) {
        // A token refresh requires the server. While offline, attach the
        // existing token and let the request fail at the network layer.
        if (!(await checkInternetConnection())) {
          Logger.info('Token near expiry but offline — skipping refresh, request will queue');
          config.headers.Authorization = `Bearer ${token.token}`;
          return config;
        }
        Logger.info('Access token expired or about to expire, refreshing before request');

        try {
          const newToken = refreshTokenPromise
            ? await refreshTokenPromise
            : await startTokenRefresh();
          config.headers.Authorization = `Bearer ${newToken}`;
          return config;
        } catch (err) {
          return Promise.reject(err);
        }
      }

      // Token is valid, proceed with request. A successful attach means a
      // live session (e.g. after re-login), so re-arm termination handling.
      sessionTerminationHandled = false;
      sessionExpiredHandled = false;
      config.headers.Authorization = `Bearer ${token.token}`;

      // Log cURL command
      const curl = generateCurlCommand(config);
      Logger.info('cURL:', curl);
      return config;
    } catch (error) {
      Logger.error('Failed to attach token:', error.message);
      return Promise.reject(error);
    }
  },
  error => {
    Logger.error('Request error:', error.message);
    return Promise.reject(error);
  },
);

/**
 * Handle Response & Token Refresh on 401
 */
userClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (!error.response) {
      Logger.error(
        `Network error or no response from server: ${error.message}, URL: ${originalRequest?.url}`,
      );
      return Promise.reject(error);
    }

    // Handle maintenance mode (503 Service Unavailable)
    if (error.response.status === 503) {
      const isMaintenanceMode =
        error.response?.data?.errorCode === 'MAINTENANCE_MODE' ||
        error.response?.data?.error_code === 'MAINTENANCE_MODE' ||
        error.response?.data?.maintenance === true;
      if (isMaintenanceMode && store) {
        Logger.warn('System is under maintenance');
        store.dispatch(
          setMaintenanceMode({
            isUnderMaintenance: true,
            message:
              error.response?.data?.message ||
              'System is currently under maintenance. Please try again later.',
          }),
        );
      }
      return Promise.reject(error);
    }

    // Skip 401 handling for logout endpoint
    if (originalRequest.url?.includes('/auth/logout')) {
      return Promise.reject(error);
    }

    // Handle session terminated by server (concurrent login detection)
    if (error.response.status === 401) {
      const errorCode = error.response?.data?.errorCode || error.response?.data?.error_code;
      if (errorCode === 'SESSION_TERMINATED' || errorCode === 'SESSION_EXPIRED') {
        handleSessionTerminated(
          error.response?.data?.message || 'Your session has been terminated.',
        );
        return Promise.reject(error);
      }
    }

    // Handle 401 with token refresh retry
    if (error.response.status === 401 && !originalRequest._retry) {
      Logger.warn(`Unauthorized URL: ${originalRequest.url}`);
      originalRequest._retry = true;

      // If refresh already in progress, queue this request
      if (refreshTokenPromise) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            Logger.info('Retrying request after token refresh:', originalRequest.url);
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return userClient(originalRequest);
          })
          .catch(err => {
            Logger.error('Failed to retry request after token refresh:', err.message);
            return Promise.reject(err);
          });
      }

      try {
        const newToken = await startTokenRefresh();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return userClient(originalRequest);
      } catch (err) {
        return Promise.reject(err);
      }
    }

    // For any 401 that wasn't handled above (e.g., after retry failed), logout
    if (error.response.status === 401) {
      Logger.error('Unhandled 401 error, logging out');
      if (store) {
        await store.dispatch(logoutAction());
      }
      return Promise.reject(error);
    }

    Logger.error(
      `Response error: ${error.response?.data || error.message}, URL: ${
        originalRequest.url
      }, Status: ${error.response.status}`,
    );
    return Promise.reject(error);
  },
);

export default userClient;
