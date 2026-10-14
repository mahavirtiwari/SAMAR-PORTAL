import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../services/api';
import { resetSyncThrottle } from '../../services/offline/syncEngine';
import { getToken, removeToken, storeToken } from '../../services/storage/authStore';
import { getApiErrorMessage } from '../../utils/apiError';
import { Logger } from '../../utils/logger';
import { isTokenExpired } from '../../utils/tokenUtils';
import { resetStore } from './resetStore';

const USER_DETAILS_CACHE_KEY = 'cachedUserDetails';

// Roles permitted to use the applicant app. Anyone outside this set (e.g. an
// assessor) is rejected at login.
const ALLOWED_ROLE_SLUGS = ['unit_admin', 'enterprise_admin'];

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

    // Only unit_admin / enterprise_admin may use this app.
    const userRoles = response?.data?.user?.roles || [];
    const isAuthorised = userRoles.some(role => ALLOWED_ROLE_SLUGS.includes(role.slug));

    if (!isAuthorised) {
      Logger.error('User is not authorised to login on this app.');
      return rejectWithValue('You are not authorised to login on this app.');
    }

    const { accessToken, accessTokenExpiration } = response.data;
    const { refreshToken, refreshTokenExpiration } = response.data;
    Logger.info('Storing tokens', { accessTokenExpiration, refreshTokenExpiration });
    await storeToken('accessToken', accessToken, accessTokenExpiration);
    await storeToken('refreshToken', refreshToken, refreshTokenExpiration);
    // Seed the user-details cache from the login payload so the profile name is
    // available from the very first session, before getUserDetails has ever
    // succeeded. Shape matches getUserDetails' { user } payload.
    if (response?.data?.user) {
      AsyncStorage.setItem(
        USER_DETAILS_CACHE_KEY,
        JSON.stringify({ user: response.data.user }),
      ).catch(cacheError => Logger.warn('Seeding user details cache failed:', cacheError?.message));
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
    try {
      const response = await Api.CommonApi.checkActiveSession(data);
      return response?.data;
    } catch (error) {
      const message = getApiErrorMessage(error);
      Logger.error('Check active session failed:', message);
      return rejectWithValue(message);
    }
  },
);

const verifyLoginOtpAction = createAsyncThunk(
  'Account/VerifyLoginOtp',
  async (data, { rejectWithValue }) => {
    // data: { sessionToken, otp }
    try {
      const response = await Api.CommonApi.verifyLoginOtp(data);

      // Only unit_admin / enterprise_admin may use this app.
      const userRoles = response?.data?.user?.roles || [];
      const isAuthorised = userRoles.some(role => ALLOWED_ROLE_SLUGS.includes(role.slug));
      if (!isAuthorised) {
        Logger.error('User is not authorised to login on this app.');
        return rejectWithValue('You are not authorised to login on this app.');
      }

      const { accessToken, accessTokenExpiration } = response.data;
      const { refreshToken: newRefreshToken, refreshTokenExpiration } = response.data;
      await storeToken('accessToken', accessToken, accessTokenExpiration);
      await storeToken('refreshToken', newRefreshToken, refreshTokenExpiration);

      if (response?.data?.user) {
        AsyncStorage.setItem(
          USER_DETAILS_CACHE_KEY,
          JSON.stringify({ user: response.data.user }),
        ).catch(cacheError =>
          Logger.warn('Seeding user details cache failed:', cacheError?.message),
        );
      }
      return response;
    } catch (error) {
      const message = getApiErrorMessage(error);
      Logger.error('Verify login OTP failed:', message);
      return rejectWithValue(message);
    }
  },
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
  },
);

const refreshToken = createAsyncThunk('account/refreshToken', async (_, { rejectWithValue }) => {
  try {
    const oldRefreshToken = await getToken('refreshToken');

    if (!oldRefreshToken?.token) {
      Logger.error('No refresh token available');
      return rejectWithValue('No refresh token available');
    }

    const val = {
      refreshToken: oldRefreshToken.token,
    };

    const response = await Api.CommonApi.refreshToken(val);

    const {
      accessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiration,
      refreshTokenExpiration,
    } = response.data;

    if (!accessToken) {
      Logger.error('No access token in refresh response');
      return rejectWithValue('Failed to refresh token');
    }

    await storeToken('accessToken', accessToken, accessTokenExpiration);
    if (newRefreshToken) {
      await storeToken('refreshToken', newRefreshToken, refreshTokenExpiration);
    }

    return response;
  } catch (error) {
    Logger.error('Refresh token failed:', error);
    return rejectWithValue(error.response?.data || 'An unknown error occurred');
  }
});

const changePasswordAction = createAsyncThunk(
  'Account/ChangePassword',
  async (data, { rejectWithValue }) => {
    try {
      // camelCase keys — the backend request middleware rejects snake_case.
      const response = await Api.CommonApi.changePassword({
        currentPassword: data.oldPassword,
        newPassword: data.newPassword,
        newPasswordConfirmation: data.newPassword,
      });
      return response;
    } catch (error) {
      Logger.error('Change password failed:', error);
      return rejectWithValue(error.response?.data?.message || 'An unknown error occurred');
    }
  },
);

const getUserDetails = createAsyncThunk(
  'Account/GetUserDetails',
  async (_, { rejectWithValue }) => {
    // Online: fetch and cache the profile to AsyncStorage. Offline: fall back to
    // the last cached copy so the Home header still renders.
    try {
      const response = await Api.CommonApi.getuserDetails();
      Logger.info('User details retrieved successfully');
      AsyncStorage.setItem(USER_DETAILS_CACHE_KEY, JSON.stringify(response)).catch(cacheError =>
        Logger.warn('Caching user details failed:', cacheError?.message),
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
  },
);

const logoutAction = createAsyncThunk(
  'Account/Logout',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      Logger.info('Starting logout process');

      // Call backend to invalidate session
      const accessToken = await getToken('accessToken');
      if (accessToken?.token) {
        try {
          await Api.CommonApi.logout();
          Logger.info('Backend session invalidated');
        } catch (apiError) {
          Logger.error('Backend logout failed (continuing local cleanup):', apiError);
        }
      }

      try {
        await removeToken('accessToken');
        await removeToken('refreshToken');
        Logger.info('Tokens removed successfully during logout');
      } catch (tokenError) {
        Logger.error('Failed to remove tokens during logout:', tokenError);
      }

      AsyncStorage.removeItem(USER_DETAILS_CACHE_KEY).catch(cacheError =>
        Logger.warn('Clearing cached user details failed:', cacheError?.message),
      );

      // A sync pause opened under this session must not hold back the next
      // user's drains.
      resetSyncThrottle();
      dispatch(resetStore());
      Logger.info('Logout completed successfully');
      return true;
    } catch (error) {
      Logger.error('Logout failed:', error);
      return rejectWithValue(error.response?.data || 'An unknown error occurred');
    }
  },
);

const checkLoginStatus = createAsyncThunk('account/checkLoginStatus', async (_, { dispatch }) => {
  Logger.info('Checking login status');

  const accessTokenData = await getToken('accessToken');
  if (!accessTokenData) {
    Logger.info('Access token does not exist');
    return false;
  }

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

  if (isTokenExpired(refreshTokenData.expiry)) {
    Logger.info('Refresh token is expired');
    await dispatch(logoutAction());
    return false;
  }

  Logger.info('Refresh token is valid, attempting to refresh access token');

  try {
    const response = await dispatch(refreshToken());

    if (refreshToken.fulfilled.match(response)) {
      Logger.info('Access token refreshed successfully');
      return true;
    } else {
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
  verifyLoginOtpAction,
};
