import axios from 'axios';
import axiosRetry, { exponentialDelay, isNetworkOrIdempotentRequestError, retryAfter } from 'axios-retry';
import AppSettings from '../../../appsettings';
import { Logger } from '../../../utils/logger';
import { getToken } from '../../storage/authStore';

// Define timeout for requests
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Safely parse a token expiry value that may be an ISO string, Unix seconds,
 * or Unix milliseconds into a millisecond timestamp.
 * Returns null if the value cannot be parsed, which callers should treat as
 * already-expired (safest default).
 */
const parseExpiry = expiry => {
  if (!expiry) {
    return null;
  }
  if (typeof expiry === 'number') {
    // Unix seconds (10 digits) vs milliseconds (13 digits)
    return expiry < 1e12 ? expiry * 1000 : expiry;
  }
  const parsed = Date.parse(expiry);
  return isNaN(parsed) ? null : parsed;
};

const userClient = axios.create({
  baseURL: AppSettings.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: REQUEST_TIMEOUT,
});

const IDEMPOTENT_METHODS = ['get', 'head', 'options', 'put', 'delete'];
const isIdempotentRequest = config => IDEMPOTENT_METHODS.includes((config?.method || 'get').toLowerCase());

// A 429 is retried only when the server says when (Retry-After), and only if that wait is
// short enough to be worth holding the screen for; anything longer fails fast.
const MAX_RETRY_AFTER_MS = 15000;

const isMaintenanceResponse = error => error.response?.data?.errorCode === 'MAINTENANCE_MODE' || error.response?.data?.error_code === 'MAINTENANCE_MODE' || error.response?.data?.maintenance === true;

// Exponential backoff from 1s (1s, 2s, 4s) with axios-retry's 0-20% jitter, so clients that
// failed together do not retry in lockstep, and never sooner than a Retry-After header asks.
axiosRetry(userClient, {
  retries: 3,
  retryDelay: (retryCount, error) => Math.max(retryAfter(error), exponentialDelay(retryCount, error, 500)),
  retryCondition: error => {
    const status = error.response?.status;
    // Don't retry on 503 if it's maintenance mode
    if (status === 503 && isMaintenanceResponse(error)) {
      return false;
    }
    if (status === 429) {
      // Auth endpoints are rate limited on purpose; never replay them.
      if ((error.config?.url || '').includes('/auth/')) {
        return false;
      }
      const wait = retryAfter(error);
      return isIdempotentRequest(error.config) && wait > 0 && wait <= MAX_RETRY_AFTER_MS;
    }
    // 503 is only replayed for idempotent methods. A POST that hit a 503
    // from a proxy may already have been processed (payment initiation, an
    // application submit); resending it would create a duplicate.
    return isNetworkOrIdempotentRequestError(error) || (status === 503 && isIdempotentRequest(error.config));
  },
});

let store;
export const injectStore = _store => {
  store = _store;
};

let logoutUserAction;
let refreshTokenAction;
let setMaintenanceMode;
export const injectAuthActions = actions => {
  logoutUserAction = actions.logoutUserAction;
  refreshTokenAction = actions.refreshTokenAction;
  setMaintenanceMode = actions.setMaintenanceMode;
};

// Single promise to track token refresh
let refreshTokenPromise = null;

// Queue for failed requests
let failedQueue = [];

/**
 * Processes the queue of failed requests.
 */
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

/**
 * Refreshes the access token. Shared by the request interceptor (proactive
 * refresh before expiry) and the response interceptor (refresh on 401), so a
 * request queued in failedQueue is settled by whichever refresh is in flight.
 * Before this was shared, a request that queued behind a proactive refresh
 * never settled and its screen hung on a spinner.
 */
const startTokenRefresh = () => {
  // Assigned synchronously so concurrent callers join this refresh.
  refreshTokenPromise = (async () => {
    try {
      Logger.info('User Client: Refreshing token...');
      const refreshToken = await getToken('refreshToken');
      if (!refreshToken?.token) {
        throw new Error('No refresh token available');
      }

      const refreshTokenExpiry = parseExpiry(refreshToken.expiry);
      if (refreshTokenExpiry === null || refreshTokenExpiry <= Date.now()) {
        throw new Error('Refresh token expired');
      }

      if (!store) {
        throw new Error('Store not available for token refresh');
      }

      const refreshResult = await store.dispatch(refreshTokenAction());
      if (refreshResult.error) {
        throw new Error(`Token refresh failed: ${refreshResult.error.message || 'Unknown error'}`);
      }

      const newAccessToken = await getToken('accessToken');
      if (!newAccessToken?.token) {
        throw new Error('Failed to retrieve new access token after refresh');
      }

      Logger.info('Token refreshed successfully');
      processQueue(null, newAccessToken.token);
      return newAccessToken.token;
    } catch (refreshError) {
      Logger.error('Token refresh failed:', refreshError.response?.data || refreshError.message);
      processQueue(refreshError, null);
      if (store) {
        try {
          sessionStorage.setItem('logout_reason', 'Your session has expired. Please log in again.');
        } catch {
          // sessionStorage may not be available
        }
        await store.dispatch(logoutUserAction());
      }
      throw refreshError;
    } finally {
      refreshTokenPromise = null;
    }
  })();
  return refreshTokenPromise;
};

/**
 * Attach Authorization Token Before Requests
 */
userClient.interceptors.request.use(
  async config => {
    try {
      const token = await getToken('accessToken');

      // Check if token exists
      if (!token?.token) {
        Logger.error('No access token available');
        if (store) {
          await store.dispatch(logoutUserAction());
        }
        throw new Error('No access token available');
      }

      // Check if token is expired
      const currentTime = Date.now();
      const tokenExpiry = parseExpiry(token.expiry);
      const bufferTime = 30 * 1000; // 30 seconds buffer

      // If token expiry cannot be parsed, treat as expired (safest default)
      if (tokenExpiry === null || tokenExpiry <= currentTime + bufferTime) {
        Logger.info('Access token expired or about to expire, refreshing before request');

        // If we already have a refresh in progress, wait for it
        if (refreshTokenPromise) {
          Logger.info('Token refresh already in progress, waiting for completion');
          try {
            const newToken = await refreshTokenPromise;
            config.headers.Authorization = `Bearer ${newToken}`;
            return config;
          } catch (err) {
            Logger.error('Failed to use refreshed token:', err.message);
            throw err;
          }
        }

        try {
          const newToken = await startTokenRefresh();
          config.headers.Authorization = `Bearer ${newToken}`;
          return config;
        } catch (err) {
          return Promise.reject(err);
        }
      }

      // Token is valid, proceed with request
      config.headers.Authorization = `Bearer ${token.token}`;
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
 * Handle Response & Token Refresh
 */
userClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (!error.response) {
      Logger.error(`Network error or no response from server: ${error.message}, URL: ${originalRequest?.url}`);
      return Promise.reject(error);
    }

    // Handle maintenance mode (503 Service Unavailable)
    if (error.response.status === 503) {
      if (isMaintenanceResponse(error)) {
        // Check if the user is a system_admin - they should bypass maintenance mode
        const user = store?.getState()?.Account?.user;
        const userRole = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles[0].slug : null;

        if (userRole === 'system_admin') {
          Logger.info('System admin detected, bypassing maintenance mode');
          return Promise.reject(error);
        }

        Logger.warn('System is under maintenance, gating app to maintenance screen');
        if (store && setMaintenanceMode) {
          store.dispatch(setMaintenanceMode(true));
        }
        return Promise.reject(error);
      }
    }

    // Skip 401 handling for logout endpoint - just let it fail silently
    if (originalRequest.url?.includes('/auth/logout')) {
      return Promise.reject(error);
    }

    // Handle session terminated by server (concurrent login detection)
    if (error.response.status === 401) {
      const errorCode = error.response?.data?.errorCode || error.response?.data?.error_code;
      if (errorCode === 'SESSION_TERMINATED' || errorCode === 'SESSION_EXPIRED') {
        Logger.warn(`Session terminated: ${error.response?.data?.message}`);
        try {
          sessionStorage.setItem('session_terminated_message', error.response?.data?.message || 'Your session has been terminated.');
        } catch {
          // sessionStorage may not be available
        }
        if (store) {
          await store.dispatch(logoutUserAction());
        }
        return Promise.reject(error);
      }
    }

    if (error.response.status === 401 && !originalRequest._retry && !originalRequest._tokenReplay && !refreshTokenPromise) {
      // The request went out with an access token that has since been replaced (another
      // request's refresh finished while this one was in flight). Replay it with the
      // current token instead of starting a second refresh, which would rotate the
      // refresh token again and can log the user out. Done at most once per request.
      const currentToken = await getToken('accessToken');
      const sentAuthorization = originalRequest.headers?.Authorization;
      if (currentToken?.token && sentAuthorization && sentAuthorization !== `Bearer ${currentToken.token}`) {
        // Not marked _retry: if the current token is rejected too, the normal refresh still runs.
        originalRequest._tokenReplay = true;
        Logger.info('Replaying request sent with a superseded access token:', originalRequest.url);
        originalRequest.headers.Authorization = `Bearer ${currentToken.token}`;
        return userClient(originalRequest);
      }
    }

    if (error.response.status === 401 && !originalRequest._retry) {
      Logger.warn(`Unauthorized URL: ${originalRequest.url}`);
      originalRequest._retry = true;

      // If we already have a refresh in progress, queue this request
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
        await store.dispatch(logoutUserAction());
      }
      return Promise.reject(error);
    }

    Logger.error(`Response error: ${error.response?.data || error.message}, URL: ${originalRequest.url}, Status: ${error.response.status}`);
    return Promise.reject(error);
  },
);

export default userClient;
