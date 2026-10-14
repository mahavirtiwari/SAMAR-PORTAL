import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import Api from '../../services/api';
import { countAllUnsynced } from '../../services/database/repositories/outboxRepo';
import { drainOutbox, resetDrainLatch, resetSyncThrottle } from '../../services/offline/syncEngine';
import { OWNER_USER_ID_KEY, wipeAllLocalData } from '../../services/offline/wipeLocalData';
import { getToken, removeToken, storeToken } from '../../services/storage/authStore';
import { isConfirmedOnline } from '../../utils/checkInternetConnection';
import { getApiErrorMessage, isNetworkFailure } from '../../utils/errorMessages';
import { Logger } from '../../utils/logger';
import { isTokenExpired } from '../../utils/tokenUtils';
import { resetStore } from './resetStore';

const USER_DETAILS_CACHE_KEY = 'cachedUserDetails';

// Confirm dialog shown when a DIFFERENT assessor logs in on a device that still
// holds the previous user's unsynced offline work. Resolves true to wipe and
// continue, false to abort the login and keep the prior user's data. See BUG-06152.
const confirmDifferentUserWipe = (unsyncedCount) =>
  new Promise((resolve) => {
    Alert.alert(
      'Different assessor on this device',
      `This device has ${unsyncedCount} unsynced item${unsyncedCount === 1 ? '' : 's'} from ` +
        "another assessor that haven't reached the server. Logging in as a different user will " +
        `permanently delete ${unsyncedCount === 1 ? 'it' : 'them'}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete & Continue', style: 'destructive', onPress: () => resolve(true) }
      ],
      { cancelable: false }
    );
  });

// Reconcile local data against the user about to log in. Same user -> keep the
// preserved SQLite data + outbox (the sync engine drains it once online). A
// different user -> wipe first (after a warn+confirm when unsynced work exists),
// since their queued work can't be uploaded under the new user's token. Returns
// { proceed } — proceed:false means the user cancelled and the login is aborted.
const reconcileLocalDataForUser = async (incomingUserId) => {
  if (incomingUserId == null) {
    return { proceed: true };
  }

  let ownerId = null;
  try {
    ownerId = await AsyncStorage.getItem(OWNER_USER_ID_KEY);
  } catch (error) {
    Logger.warn('Reading local-data owner id failed:', error?.message);
  }

  if (ownerId != null && String(ownerId) !== String(incomingUserId)) {
    let unsyncedCount = 0;
    try {
      unsyncedCount = await countAllUnsynced();
    } catch (error) {
      Logger.error('Counting unsynced items before different-user wipe failed:', error?.message);
    }

    if (unsyncedCount > 0) {
      const confirmed = await confirmDifferentUserWipe(unsyncedCount);
      if (!confirmed) {
        Logger.info('Different-user login cancelled to preserve prior assessor unsynced data');
        return { proceed: false };
      }
    }

    Logger.info('Different user logging in — wiping prior assessor local data');
    await wipeAllLocalData();
  }

  return { proceed: true };
};

// Persist the owner id + kick a drain after a successful login. On a same-user
// re-login this flushes any outbox preserved through a forced logout.
const finalizeUserSession = async (userId) => {
  if (userId != null) {
    try {
      await AsyncStorage.setItem(OWNER_USER_ID_KEY, String(userId));
    } catch (error) {
      Logger.warn('Persisting local-data owner id failed:', error?.message);
    }
  }
  resetSyncThrottle();
  // Clear a drain latch left stuck by a prior session (Android swipe-remount),
  // BEFORE the kick below — otherwise this login's drain would skip as "already
  // in progress" and sync stays wedged until an app force-kill. [BUG-08890]
  resetDrainLatch();
  drainOutbox().catch((error) =>
    Logger.warn('Post-login outbox drain kick failed:', error?.message)
  );
};

const loginUserAction = createAsyncThunk('Account/LoginUser', async (data, { rejectWithValue }) => {
  Logger.info('Login action initiated with data:', data);
  try {
    const response = await Api.CommonApi.loginUser(data);

    // 2FA-enabled accounts get an OTP challenge instead of tokens. Hand the
    // session token back to the slice; the role check + token storage happen
    // after the OTP is verified.
    if (response?.data?.requiresOtp) {
      Logger.info('Login requires OTP verification');
      return response;
    }

    Logger.info('Login successful', { userId: response?.data?.user?.id });

    // Check if user has 'assessor' role
    const userRoles = response?.data?.user?.roles || [];
    const isAssessor = userRoles.some((role) => role.slug === 'assessor');

    if (!isAssessor) {
      Logger.error('User is not authorised to login on this Mobile App.');
      return rejectWithValue('You are not authorised to login on this Mobile App.');
    }

    // Reconcile local data against the user logging in — keep it for the same
    // user, wipe (after warn+confirm on unsynced work) for a different one.
    const reconciliation = await reconcileLocalDataForUser(response?.data?.user?.id);
    if (!reconciliation.proceed) {
      return rejectWithValue("Login cancelled to keep the previous assessor's unsynced work.");
    }

    const { accessToken, accessTokenExpiration } = response.data;
    const { refreshToken, refreshTokenExpiration } = response.data;
    Logger.info('Storing tokens', { accessTokenExpiration, refreshTokenExpiration });
    await storeToken('accessToken', accessToken, accessTokenExpiration);
    await storeToken('refreshToken', refreshToken, refreshTokenExpiration);
    await finalizeUserSession(response?.data?.user?.id);
    // Seed the user-details cache from the login payload so the profile name
    // is available offline from the very first session, before getUserDetails
    // has ever succeeded. Shape matches getUserDetails' { user } payload.
    if (response?.data?.user) {
      AsyncStorage.setItem(
        USER_DETAILS_CACHE_KEY,
        JSON.stringify({ user: response.data.user })
      ).catch((cacheError) =>
        Logger.warn('Seeding user details cache failed:', cacheError?.message)
      );
    }
    return response;
  } catch (error) {
    const message = getApiErrorMessage(error);
    Logger.error('Login failed:', message);
    return rejectWithValue(message);
  }
});

const checkActiveSessionAction = createAsyncThunk(
  'Account/CheckActiveSession',
  async (data, { rejectWithValue }) => {
    // data: { samarId, password, deviceType }
    try {
      const response = await Api.CommonApi.checkActiveSession(data);
      return response?.data;
    } catch (error) {
      const message = getApiErrorMessage(error);
      Logger.error('Check active session failed:', message);
      return rejectWithValue(message);
    }
  }
);

const verifyLoginOtpAction = createAsyncThunk(
  'Account/VerifyLoginOtp',
  async (data, { rejectWithValue }) => {
    // data: { sessionToken, otp }
    try {
      const response = await Api.CommonApi.verifyLoginOtp(data);

      // Only assessors may use this app.
      const userRoles = response?.data?.user?.roles || [];
      const isAssessor = userRoles.some((role) => role.slug === 'assessor');
      if (!isAssessor) {
        Logger.error('User is not authorised to login on this Mobile App.');
        return rejectWithValue('You are not authorised to login on this Mobile App.');
      }

      // Reconcile local data against the user logging in — keep it for the same
      // user, wipe (after warn+confirm on unsynced work) for a different one.
      const reconciliation = await reconcileLocalDataForUser(response?.data?.user?.id);
      if (!reconciliation.proceed) {
        return rejectWithValue("Login cancelled to keep the previous assessor's unsynced work.");
      }

      const { accessToken, accessTokenExpiration } = response.data;
      const { refreshToken: newRefreshToken, refreshTokenExpiration } = response.data;
      await storeToken('accessToken', accessToken, accessTokenExpiration);
      await storeToken('refreshToken', newRefreshToken, refreshTokenExpiration);
      await finalizeUserSession(response?.data?.user?.id);

      if (response?.data?.user) {
        AsyncStorage.setItem(
          USER_DETAILS_CACHE_KEY,
          JSON.stringify({ user: response.data.user })
        ).catch((cacheError) =>
          Logger.warn('Seeding user details cache failed:', cacheError?.message)
        );
      }
      return response;
    } catch (error) {
      const message = getApiErrorMessage(error);
      Logger.error('Verify login OTP failed:', message);
      return rejectWithValue(message);
    }
  }
);

const resendLoginOtpAction = createAsyncThunk(
  'Account/ResendLoginOtp',
  async (data, { rejectWithValue }) => {
    // data: { sessionToken }
    try {
      const response = await Api.CommonApi.resendLoginOtp(data);
      return response;
    } catch (error) {
      const message = getApiErrorMessage(error);
      Logger.error('Resend login OTP failed:', message);
      return rejectWithValue(message);
    }
  }
);

const performTokenRefresh = async () => {
  const oldRefreshToken = await getToken('refreshToken');

  if (!oldRefreshToken?.token) {
    Logger.error('No refresh token available');
    return { ok: false, reason: 'No refresh token available' };
  }

  try {
    const response = await Api.CommonApi.refreshToken({ refreshToken: oldRefreshToken.token });

    const {
      accessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiration,
      refreshTokenExpiration
    } = response.data;

    if (!accessToken) {
      Logger.error('No access token in refresh response');
      return { ok: false, reason: 'Failed to refresh token' };
    }

    await storeToken('accessToken', accessToken, accessTokenExpiration);
    if (newRefreshToken) {
      await storeToken('refreshToken', newRefreshToken, refreshTokenExpiration);
    }

    return { ok: true, response };
  } catch (error) {
    Logger.error('Refresh token failed:', error);
    // A refresh that never reached the server says nothing about whether the
    // session is still valid, so it must not be allowed to end one. Flag it and
    // let the callers keep the session and retry later; only a real rejection
    // (the server answered) falls through to the logout path.
    if (isNetworkFailure(error)) {
      return {
        ok: false,
        reason: { networkFailure: true, message: 'Refresh could not reach the server' }
      };
    }
    return { ok: false, reason: error.response?.data || 'An unknown error occurred' };
  }
};

// One refresh at a time, process-wide. The launch check, the app-resume check,
// both API-client interceptors and the image-download path each dispatch this
// thunk on their own schedule, and two of them regularly landed in the same
// second. The server rotates the refresh token on first use, so the second call
// presented a retired token, got 401, and ended a session the first call had
// just renewed. Every dispatch now joins the attempt already in flight and
// settles with its outcome.
let inFlightRefresh = null;

const refreshToken = createAsyncThunk('account/refreshToken', async (_, { rejectWithValue }) => {
  if (!inFlightRefresh) {
    inFlightRefresh = performTokenRefresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  const outcome = await inFlightRefresh;
  return outcome.ok ? outcome.response : rejectWithValue(outcome.reason);
});

const changePasswordAction = createAsyncThunk(
  'Account/ChangePassword',
  async (data, { rejectWithValue }) => {
    try {
      const response = await Api.CommonApi.changePassword({
        current_password: data.oldPassword,
        new_password: data.newPassword,
        new_password_confirmation: data.newPassword
      });
      return response;
    } catch (error) {
      Logger.error('Change password failed:', error);
      return rejectWithValue(error.response?.data?.message || 'An unknown error occurred');
    }
  }
);

const getUserDetails = createAsyncThunk(
  'Account/GetUserDetails',
  async (_, { rejectWithValue }) => {
    // Online: fetch and cache the profile to AsyncStorage. Offline: fall back
    // to the last cached copy so the Home header still renders. There is no
    // SQLite user table, so a single AsyncStorage blob is the right store.
    try {
      const response = await Api.CommonApi.getuserDetails();
      Logger.info('User details retrieved successfully');
      AsyncStorage.setItem(USER_DETAILS_CACHE_KEY, JSON.stringify(response)).catch((cacheError) =>
        Logger.warn('Caching user details failed:', cacheError?.message)
      );
      return response;
    } catch (error) {
      Logger.warn('Remote user details fetch failed, attempting cached copy:', error?.message);
      try {
        const cached = await AsyncStorage.getItem(USER_DETAILS_CACHE_KEY);
        if (cached) {
          Logger.info('User details served from AsyncStorage cache');
          return JSON.parse(cached);
        }
      } catch (cacheError) {
        Logger.error('Cached user details lookup also failed:', cacheError?.message);
      }
      return rejectWithValue(error.response?.data || 'Failed to get user details');
    }
  }
);

const showBlockingAlert = (title, message) =>
  new Promise((resolve) => {
    Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }], { cancelable: false });
  });

// Single alert a forced logout shows: the caller's own session message (e.g.
// "Session Ended") if any, plus a reassurance about unsynced work if there is
// any — folded together so a session alert and an unsynced note never stack as
// two popups. Forced logout preserves local data (see performLogout), so the
// note reassures rather than warns. No-op when there's neither a session
// message nor pending data.
const warnBeforeAutoLogout = async ({ sessionTitle, sessionMessage }) => {
  let unsyncedCount = 0;
  try {
    unsyncedCount = await countAllUnsynced();
  } catch (error) {
    Logger.error('Failed to count unsynced items before automatic logout:', error?.message);
  }

  if (unsyncedCount === 0 && !sessionMessage) {
    return;
  }

  const unsyncedSentence =
    unsyncedCount > 0
      ? `You have ${unsyncedCount} unsynced item${unsyncedCount === 1 ? '' : 's'} that ` +
        `${unsyncedCount === 1 ? "hasn't" : "haven't"} reached the server yet. ` +
        `${unsyncedCount === 1 ? 'It is' : 'They are'} saved on this device and will ` +
        'upload automatically the next time you log in.'
      : null;

  const message = [sessionMessage, unsyncedSentence].filter(Boolean).join('\n\n');
  await showBlockingAlert(sessionTitle || 'Log out', message);
};

// Actual logout work, shared by every caller. `skipUnsyncedWarning` is set
// by the manual Profile logout, which already warns via its own confirm
// modal before dispatching — everyone else (token expiry, 401, session
// terminated, app-resume checks) goes through warnBeforeAutoLogout instead.
const performLogout = async (
  { skipUnsyncedWarning, wipeData = false, sessionTitle, sessionMessage },
  dispatch
) => {
  Logger.info('Starting logout process', { wipeData });

  // An already-expired token cannot invalidate anything: the server rejects the
  // call, and on the launch path it is what used to drive the app into a
  // deadlock. Skip straight to the local cleanup. [BUG-08890]
  const accessToken = await getToken('accessToken');
  if (accessToken?.token && !isTokenExpired(accessToken.expiry)) {
    try {
      await Api.CommonApi.logout();
      Logger.info('Backend session invalidated');
    } catch (apiError) {
      Logger.error('Backend logout failed (continuing local cleanup):', apiError);
    }
  } else if (accessToken?.token) {
    Logger.info('Access token already expired, skipping the backend logout call');
  }

  // Only a manual logout (wipeData) destroys local data — the user chose it and
  // was warned by the Profile confirm modal. Every forced logout (session
  // terminated, token/refresh expiry, app-resume) clears only the session and
  // PRESERVES local assessment data + the offline outbox, so unsynced field
  // work survives and uploads on the next same-user login. See BUG-06152.
  if (wipeData) {
    // Best-effort flush while the token is still valid, so a manual logout with
    // connectivity uploads what it can before wiping the rest. Forced past any
    // rate-limit / server-outage pause: a silent no-op right before the wipe
    // would destroy captures without a single upload attempt.
    try {
      await drainOutbox({ force: true });
    } catch (drainError) {
      Logger.warn('Pre-logout outbox drain failed (continuing to wipe):', drainError?.message);
    }
    await wipeAllLocalData();
  } else {
    if (!skipUnsyncedWarning) {
      await warnBeforeAutoLogout({ sessionTitle, sessionMessage });
    }
    Logger.info('Forced logout — preserving local assessment data and outbox');
  }

  resetSyncThrottle();
  resetDrainLatch();
  // A refresh still in flight belongs to the session being ended; the next
  // session must not join it and inherit its tokens.
  inFlightRefresh = null;
  try {
    await removeToken('accessToken');
    await removeToken('refreshToken');
    Logger.info('Tokens removed successfully during logout');
  } catch (tokenError) {
    Logger.error('Failed to remove tokens during logout:', tokenError);
  }

  dispatch(resetStore());
  Logger.info('Logout completed successfully');
  return true;
};

// Guards against concurrent auto-logout triggers (e.g. several queued 401s
// firing at once) each wiping data and popping their own alert — only the
// first call runs the logout; the rest join its promise instead.
let logoutPromise = null;

// Android can keep the process alive when the app is swiped from recents and
// then re-mount into the same JavaScript context. A logout or refresh that
// never settled leaves its promise in place, so the next launch joins a promise
// that will never resolve and the app sits on the spinner with no network
// activity at all. Only the app's own startup may call this: nothing can
// legitimately be logging out or refreshing before the first mount. [BUG-08890]
const resetAccountLatchesOnStartup = () => {
  logoutPromise = null;
  inFlightRefresh = null;
};

const logoutAction = createAsyncThunk(
  'Account/Logout',
  async (
    { skipUnsyncedWarning = false, wipeData = false, sessionTitle, sessionMessage } = {},
    { rejectWithValue, dispatch }
  ) => {
    if (!logoutPromise) {
      logoutPromise = performLogout(
        { skipUnsyncedWarning, wipeData, sessionTitle, sessionMessage },
        dispatch
      ).finally(() => {
        logoutPromise = null;
      });
    } else {
      Logger.info('Logout already in progress, joining existing logout');
    }

    try {
      return await logoutPromise;
    } catch (error) {
      Logger.error('Logout failed:', error);
      return rejectWithValue(error.response?.data || 'An unknown error occurred');
    }
  }
);

const checkLoginStatus = createAsyncThunk('account/checkLoginStatus', async (_, { dispatch }) => {
  Logger.info('Checking login status');

  const accessTokenData = await getToken('accessToken');
  if (!accessTokenData) {
    Logger.info('Access token does not exist');
    return false;
  }

  // Preserve the existing session instead of tearing it down unless we are
  // CERTAIN we are online. Both refreshing and logging out need the network,
  // and an assessor may relaunch mid-shift while offline. This mirrors the
  // app-resume check (BUG-06152).
  //
  // isConfirmedOnline (strict), not checkInternetConnection (optimistic): this
  // runs at cold start, before initConnectivity() has fired NetInfo's first
  // event, so connectivity is ALWAYS unknown here. The optimistic check reads
  // unknown as online, so an offline launch with an expired access token fell
  // through to a refresh POST that could only fail at its 30s timeout — the
  // launch spinner sat there until the navigator's 15s startup fence tripped.
  // Treating unknown as not-online preserves the session immediately; the token
  // re-validates lazily on the first authenticated request (userClient's
  // proactive-refresh interceptor) once connectivity is actually known.
  if (!isConfirmedOnline()) {
    Logger.info('checkLoginStatus: connectivity not confirmed online, preserving session');
    return true;
  }

  Logger.info('AccessTokenData expiry:', accessTokenData.expiry);

  if (!isTokenExpired(accessTokenData.expiry)) {
    Logger.info('Access token is valid');
    return true;
  }

  Logger.info('Access token is expired, checking refresh token');

  const refreshTokenData = await getToken('refreshToken');
  if (!refreshTokenData) {
    Logger.info('Refresh token does not exist');
    return false;
  }
  Logger.info('RefreshTokenData expiry:', refreshTokenData.expiry);

  if (isTokenExpired(refreshTokenData.expiry)) {
    Logger.info('Refresh token is expired');
    await dispatch(logoutAction());
    return false;
  }

  Logger.info('Refresh token is valid, attempting to refresh access token');

  try {
    const response = await dispatch(refreshToken());
    Logger.info('Access token refreshed, Dispatch Response:', response);

    if (refreshToken.fulfilled.match(response)) {
      Logger.info('Access token refreshed successfully');
      return true;
    } else {
      // A refresh that never reached the server says nothing about session
      // validity — keep the session and retry later instead of forcing a
      // logout, matching the app-resume check in ApplicationNavigator. See
      // BUG-08378.
      if (response.payload?.networkFailure) {
        Logger.info('Access token refresh could not reach the server — keeping session');
        return true;
      }
      Logger.error('Failed to refresh access token:', response.payload || response.error);
      await dispatch(logoutAction());
      return false;
    }
  } catch (refreshError) {
    Logger.error('Failed to refresh access token:', refreshError);
    await dispatch(logoutAction());
    return false;
  }
});

export {
  changePasswordAction,
  checkActiveSessionAction,
  checkLoginStatus,
  getUserDetails,
  loginUserAction,
  logoutAction,
  refreshToken,
  resendLoginOtpAction,
  resetAccountLatchesOnStartup,
  verifyLoginOtpAction
};
