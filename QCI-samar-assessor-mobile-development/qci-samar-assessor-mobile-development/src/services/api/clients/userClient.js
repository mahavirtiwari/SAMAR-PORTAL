import axios from 'axios';
import axiosRetry from 'axios-retry';
import AppSettings from '../../../../appsettings';
import {
  logoutAction,
  refreshToken as refreshTokenAction
} from '../../../redux/action/accountAction';
import { setMaintenanceMode } from '../../../redux/slices/accountSlice';
import { checkInternetConnection } from '../../../utils/checkInternetConnection';
import { Logger } from '../../../utils/logger';
import { parseExpiry } from '../../../utils/tokenUtils';
import { getToken } from '../../storage/authStore';

// Define timeout for requests
const REQUEST_TIMEOUT = 30000; // 30 seconds

// Multipart photo uploads (selfies, site pictures, evidence, meeting images)
// run ~0.4–1.5MB each; on weak field networks 30s is not enough and the upload
// aborts mid-transfer, so file-upload endpoints pass this instead. 5 minutes
// matches the BRRF/BEE sibling apps and covers ~2KB/s worst-case field links.
export const UPLOAD_TIMEOUT = 300000;

const userClient = axios.create({
  baseURL: AppSettings.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Build': `${AppSettings.VERSION_DISPLAY}+${AppSettings.COMMIT || 'unknown'}`
  },
  timeout: REQUEST_TIMEOUT
});

// Configure axios-retry with modified exponential backoff
axiosRetry(userClient, {
  retries: 3,
  retryDelay: (retryCount) => (retryCount === 0 ? 0 : Math.pow(2, retryCount) * 1000),
  retryCondition: (error) => {
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
    // (~14s of 2+4+8s delays) before the screen's local SQLite fallback runs,
    // which is the offline slowness the field team hit. Offline-first: fail the
    // request fast and let the catch hydrate from local immediately.
    const status = error.response?.status;
    // Replay only idempotent methods: a POST that hit a 5xx/429 may already
    // have been processed server-side, and resending it would duplicate it.
    // (Outbox uploads are retried by the sync engine, deduped on clientUuid.)
    const method = (error.config?.method || "get").toLowerCase();
    const idempotent = ["get", "head", "options", "put", "delete"].includes(method);
    return idempotent && (status === 429 || (status >= 500 && status <= 599));
  }
});

let store;
export const injectStore = (_store) => {
  store = _store;
};

// Single promise to track token refresh
let refreshTokenPromise = null;

// Android can keep the process alive when the app is swiped from recents and
// then re-mount into the same JavaScript context. A refresh that never settled
// leaves this promise in place, so every later request waits on a promise that
// will never resolve. Only the app's own startup may call this: nothing can be
// refreshing before the first mount. [BUG-08890]
export const resetRefreshLatchOnStartup = () => {
  refreshTokenPromise = null;
};

/**
 * Refresh the access token for a download that cannot go through this client.
 *
 * Image downloads read the stored token and call fetch directly, so the interceptors
 * above never run for them and an expired token simply produced a broken image.
 * [BUG-08859]
 *
 * Joins the refresh already in flight when there is one, so a screen full of images
 * hitting 401 together triggers a single refresh rather than one per image. Returns the
 * new token, or null when the refresh fails.
 *
 * Deliberately does NOT log the user out on failure, unlike the interceptors: a photo
 * that will not load is not reason enough to end a session and discard an assessor's
 * offline work. The next real API call decides that.
 */
export const refreshAccessTokenForDownload = async () => {
  try {
    if (refreshTokenPromise) {
      return await refreshTokenPromise;
    }

    if (!store) {
      Logger.error('Store not injected into userClient for download token refresh');
      return null;
    }

    const refreshResult = await store.dispatch(refreshTokenAction());
    if (refreshResult.error) {
      Logger.info('Download token refresh failed, leaving the session alone');
      return null;
    }

    const newAccessToken = await getToken('accessToken');
    return newAccessToken?.token ?? null;
  } catch (error) {
    Logger.info('Download token refresh did not complete:', error?.message);
    return null;
  }
};

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

/**
 * Attach Authorization Token Before Requests
 * Proactively refreshes token if expired or about to expire
 */
userClient.interceptors.request.use(
  async (config) => {
    // Offline-first: the local DB is the source of truth; the API is a
    // background refresh. When there's no connectivity, reject the request
    // immediately so the caller's local fallback runs with ZERO wait — no
    // 30s timeout, no retry backoff. This is what keeps every screen instant
    // offline (the field team saw multi-second loaders because reads waited
    // for the network to time out before hitting SQLite). The error carries no
    // `response`, so the response interceptor and axios-retry both pass it
    // straight through to the caller. Writes already gate on this same check
    // and queue to the outbox, so nothing real is lost.
    if (!(await checkInternetConnection())) {
      const offlineError = new Error('offline: request skipped, serving local data');
      offlineError.isOffline = true;
      offlineError.config = config;
      return Promise.reject(offlineError);
    }
    // The logout call must never go through the refresh-and-logout machinery
    // below. performLogout awaits this very request, so when the token has
    // expired the refresh fails, its catch awaits logoutAction(), that joins the
    // logout already waiting on this request, and nothing ever resolves: the app
    // sits on the launch spinner until it is reinstalled. Attach whatever token
    // exists and let the server decide. The response interceptor already exempts
    // this URL for the same reason. [BUG-08890]
    if (config.url?.includes('/auth/logout')) {
      const logoutToken = await getToken('accessToken');
      if (logoutToken?.token) {
        config.headers.Authorization = `Bearer ${logoutToken.token}`;
      }
      return config;
    }

    try {
      const token = await getToken('accessToken');

      if (!token?.token) {
        Logger.error('No access token available');
        // Offline-first: a refresh/logout both need the network. Logging out
        // offline would tear down a session the assessor needs for the rest
        // of a multi-hour offline shift. Let the request fail at the network
        // layer instead — offline writes are queued and retried.
        if (store && (await checkInternetConnection())) {
          await store.dispatch(logoutAction());
        }
        const noToken = new Error('No access token available');
        noToken.sessionLost = true;
        throw noToken;
      }

      // Check if token is expired or about to expire
      const currentTime = Date.now();
      const tokenExpiry = parseExpiry(token.expiry);
      const bufferTime = 30 * 1000; // 30 seconds buffer

      if (tokenExpiry && tokenExpiry <= currentTime + bufferTime) {
        // A token refresh requires the server. While offline, attach the
        // existing token and let the request fail at the network layer — the
        // caller queues the write for later sync. Attempting a refresh here
        // would fail and trigger logout, breaking long offline sessions.
        if (!(await checkInternetConnection())) {
          Logger.info('Token near expiry but offline — skipping refresh, request will queue');
          config.headers.Authorization = `Bearer ${token.token}`;
          return config;
        }
        Logger.info('Access token expired or about to expire, refreshing before request');

        // If refresh already in progress, wait for it
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

        // Start new token refresh
        refreshTokenPromise = (async () => {
          try {
            const refreshTokenData = await getToken('refreshToken');

            if (!refreshTokenData?.token) {
              Logger.error('No refresh token available');
              throw new Error('No refresh token available');
            }

            const refreshExpiry = parseExpiry(refreshTokenData.expiry);
            if (refreshExpiry === null || refreshExpiry <= currentTime) {
              Logger.error('Refresh token expired');
              // logoutAction shows the "Session Expired" alert itself (folded
              // with the unsynced-data warning when there's pending work), so
              // there's no separate Alert.alert here.
              store &&
                store.dispatch(
                  logoutAction({
                    sessionTitle: 'Session Expired',
                    sessionMessage: 'Your session has expired. Please log in again.'
                  })
                );
              const expired = new Error('Refresh token expired');
              expired.sessionLost = true;
              throw expired;
            }

            if (!store) {
              Logger.error('Store not injected into userClient');
              throw new Error('Store not available for token refresh');
            }

            Logger.info('Dispatching refresh token action');
            const refreshResult = await store.dispatch(refreshTokenAction());

            if (refreshResult.error) {
              const failure = new Error(
                `Token refresh failed: ${refreshResult.error.message || 'Unknown error'}`
              );
              // Carried through the throw so the catch below can tell a server
              // rejection from a network that was simply not there.
              failure.networkFailure = refreshResult.payload?.networkFailure === true;
              throw failure;
            }

            const newAccessToken = await getToken('accessToken');

            if (!newAccessToken?.token) {
              throw new Error('Failed to retrieve new access token after refresh');
            }

            Logger.info('Token refreshed successfully before request');
            return newAccessToken.token;
          } catch (error) {
            if (error?.networkFailure) {
              // The refresh could not reach the server, which says nothing about
              // the session. Keep it: the caller's request fails at the network
              // layer, writes queue to the outbox, and the next attempt retries.
              Logger.info('Token refresh could not reach the server — keeping session');
              throw error;
            }
            Logger.error('Token refresh failed before request:', error.message);
            if (store) {
              await store.dispatch(logoutAction());
            }
            // Session-loss marker: the outbox drain stops on this instead of
            // letting every remaining row re-trigger the same forced logout.
            error.sessionLost = true;
            throw error;
          } finally {
            refreshTokenPromise = null;
          }
        })();

        try {
          const newToken = await refreshTokenPromise;
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
  (error) => {
    Logger.error('Request error:', error.message);
    return Promise.reject(error);
  }
);

/**
 * Handle Response & Token Refresh on 401
 */
userClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      if (error.isOffline) {
        Logger.info(`Offline, request skipped: ${originalRequest?.url}`);
      } else {
        Logger.error(
          `Network error or no response from server: ${error.message}, URL: ${originalRequest?.url}`
        );
      }
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
              'System is currently under maintenance. Please try again later.'
          })
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
        const message = error.response?.data?.message || 'Your session has been terminated.';
        Logger.warn(`Session terminated: ${message}`);
        // logoutAction shows a single "Session Ended" alert itself (folded
        // with the unsynced-data warning when there's pending work) instead
        // of a separate Alert.alert here.
        if (store) {
          await store.dispatch(
            logoutAction({ sessionTitle: 'Session Ended', sessionMessage: message })
          );
        }
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
          .then((token) => {
            Logger.info('Retrying request after token refresh:', originalRequest.url);
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return userClient(originalRequest);
          })
          .catch((err) => {
            Logger.error('Failed to retry request after token refresh:', err.message);
            return Promise.reject(err);
          });
      }

      // Start new token refresh
      refreshTokenPromise = (async () => {
        try {
          Logger.info('User Client: Refreshing token...');
          const oldRefreshToken = await getToken('refreshToken');
          if (!oldRefreshToken || !oldRefreshToken.token) {
            Logger.error('No refresh token available or token is invalid');
            throw new Error('No refresh token available');
          }

          if (!store) {
            Logger.error('Store not injected into userClient for token refresh');
            throw new Error('Store not available for token refresh');
          }

          Logger.info('Dispatching refresh token action');
          const refreshResult = await store.dispatch(refreshTokenAction());

          if (refreshResult.error) {
            Logger.error('Token refresh action failed:', refreshResult.error);
            const failure = new Error(
              `Token refresh failed: ${refreshResult.error.message || 'Unknown error'}`
            );
            failure.networkFailure = refreshResult.payload?.networkFailure === true;
            throw failure;
          }

          Logger.info('Getting new access token after refresh');
          const newAccessToken = await getToken('accessToken');

          if (!newAccessToken?.token) {
            throw new Error('Failed to retrieve new access token');
          }

          Logger.info('Token refreshed successfully');
          processQueue(null, newAccessToken.token);
          return newAccessToken.token;
        } catch (refreshError) {
          processQueue(refreshError, null);
          if (refreshError?.networkFailure) {
            Logger.info('Token refresh could not reach the server — keeping session');
            throw refreshError;
          }
          Logger.error('Token refresh failed:', refreshError.message);
          // logoutAction shows the "Session Expired" alert itself (folded
          // with the unsynced-data warning when there's pending work), so
          // there's no separate Alert.alert here.
          store &&
            store.dispatch(
              logoutAction({
                sessionTitle: 'Session Expired',
                sessionMessage: 'Your session has expired. Please log in again.'
              })
            );
          refreshError.sessionLost = true;
          throw refreshError;
        } finally {
          refreshTokenPromise = null;
        }
      })();

      try {
        const newToken = await refreshTokenPromise;
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
      }, Status: ${error.response.status}`
    );
    return Promise.reject(error);
  }
);

export default userClient;
