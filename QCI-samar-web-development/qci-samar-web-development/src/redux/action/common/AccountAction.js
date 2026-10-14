import { createAsyncThunk } from '@reduxjs/toolkit';
import AccountService from '../../../services/api/common/AccountService';
import { clearAllListCaches } from '../../../services/api/utils/listCache';
import { clearAllUserData, getToken, getUser, storeToken, storeUser } from '../../../services/storage/authStore';
import { getDeviceInfo } from '../../../utils/deviceInfo';
import { clearAuthenticatedImageCache } from '../../../utils/FileUtils';
import { Logger } from '../../../utils/logger';

const service = AccountService();

export const loginUserAction = createAsyncThunk('commonAuth/login', async (data, { rejectWithValue }) => {
  try {
    const val = {
      ...data,
      ...getDeviceInfo(),
    };
    Logger.info('Login attempt');
    const response = await AccountService().getloginUser(val);
    // Extract tokens and user info from response
    if (response?.data?.requiresOtp) {
      Logger.info('Login requires OTP');
      return response?.data;
    }
    const { accessToken, refreshToken, user, refreshTokenExpiration, accessTokenExpiration } = response?.data || {};
    // Store tokens in localStorage
    if (accessToken) {
      storeToken('accessToken', accessToken, accessTokenExpiration);
    }
    if (refreshToken) {
      storeToken('refreshToken', refreshToken, refreshTokenExpiration);
    }
    if (user) {
      storeUser(user);
    }

    Logger.info('Login successful', { userId: user?.id, roles: user?.roles?.map(r => r.slug) });
    return response?.data;
  } catch (error) {
    Logger.error('Login failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const checkActiveSessionAction = createAsyncThunk('commonAuth/checkActiveSession', async (data, { rejectWithValue }) => {
  try {
    const response = await service.checkActiveSession({ ...data, ...getDeviceInfo() });
    return response?.data;
  } catch (error) {
    Logger.error('Check active session failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const loginVerifyOTPUserAction = createAsyncThunk('commonAuth/verify-login-otp', async (data, { rejectWithValue }) => {
  try {
    const val = {
      ...data,
      ...getDeviceInfo(),
    };
    Logger.info('Login OTP verify attempt');
    const response = await AccountService().getLoginVerifyUser(val);
    // Extract tokens and user info from response
    const { accessToken, refreshToken, accessTokenExpiration, user, refreshTokenExpiration } = response?.data || {};
    // Store tokens in localStorage
    if (accessToken) {
      storeToken('accessToken', accessToken, accessTokenExpiration);
    }
    if (refreshToken) {
      storeToken('refreshToken', refreshToken, refreshTokenExpiration);
    }
    if (user) {
      storeUser(user);
    }

    Logger.info('Login successful', { userId: user?.id, roles: user?.roles?.map(r => r.slug) });
    return response?.data;
  } catch (error) {
    Logger.error('Login failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const logoutUserAction = createAsyncThunk('commonAuth/logout', async () => {
  // Only call logout API if we have a token (otherwise we're already logged out)
  const accessToken = await getToken('accessToken');
  if (accessToken?.token) {
    try {
      await service.logoutUser();
    } catch (error) {
      Logger.error('Logout API failed:', error);
      // Don't throw - we still want to clear local data
    }
  }

  // Always clear local data (clearAllUserData also removes encrypted user data)
  await clearAllUserData();
  // In-memory caches must not carry one user's data into the next session.
  clearAuthenticatedImageCache();
  clearAllListCaches();

  return { success: true };
});

export const refreshTokenAction = createAsyncThunk('commonAuth/refreshToken', async (_, { rejectWithValue }) => {
  try {
    // Get refresh token from localStorage
    const refreshTokenData = await getToken('refreshToken');

    if (!refreshTokenData?.token) {
      Logger.error('No refresh token available');
      return rejectWithValue('No refresh token available');
    }

    // Prepare payload for refresh token API
    const payload = {
      refreshToken: refreshTokenData.token,
    };

    const response = await AccountService().refreshToken(payload);

    // Extract new tokens and expiration (camelCase from backend transformer)
    const data = response?.data;
    const newAccessToken = data?.accessToken;
    const newRefreshToken = data?.refreshToken;
    const accessTokenExpiration = data?.accessTokenExpiration;
    const refreshTokenExpiration = data?.refreshTokenExpiration;

    if (!newAccessToken) {
      Logger.error('No access token in refresh response');
      return rejectWithValue('Failed to refresh token');
    }

    // Store new tokens
    await storeToken('accessToken', newAccessToken, accessTokenExpiration);
    if (newRefreshToken) {
      await storeToken('refreshToken', newRefreshToken, refreshTokenExpiration);
    }

    Logger.info('Refresh token successful, tokens updated');
    return data;
  } catch (error) {
    Logger.error('Refresh token failed:', error);
    return rejectWithValue(error.response?.data || 'An unknown error occurred');
  }
});

export const getAuthenticatedUserAction = createAsyncThunk('commonAuth/getAuthenticatedUser', async (_, { rejectWithValue }) => {
  try {
    return await service.getAuthenticatedUser();
  } catch (error) {
    Logger.error('Get authenticated user failed:', error);
    return rejectWithValue(error.response?.data || 'An unknown error occurred');
  }
});

export const changePasswordAction = createAsyncThunk('commonAuth/changePassword', async (data, { rejectWithValue }) => {
  try {
    return await service.changePassword(data);
  } catch (error) {
    Logger.error('Change password failed:', error);
    return rejectWithValue(error.response?.data || 'An unknown error occurred');
  }
});

export const forgotPasswordStartAction = createAsyncThunk('commonAuth/forgotPasswordStart', async (data, { rejectWithValue }) => {
  try {
    return await service.forgotPasswordStart(data);
  } catch (error) {
    Logger.error('Forgot password start failed:', error);
    return rejectWithValue(error.response?.data.errors || 'An unknown error occurred');
  }
});

export const resendPasswordOtpAction = createAsyncThunk('commonAuth/resendPasswordOtp', async (data, { rejectWithValue }) => {
  try {
    return await service.resendPasswordOtp(data);
  } catch (error) {
    Logger.error('Resend password OTP failed:', error);
    return rejectWithValue(error.response?.data?.errors || error.response?.data || 'An unknown error occurred');
  }
});

export const resetPasswordAction = createAsyncThunk('commonAuth/resetPassword', async (data, { rejectWithValue }) => {
  try {
    return await service.resetPassword(data);
  } catch (error) {
    Logger.error('Reset password failed:', error);
    return rejectWithValue(error.response?.data || 'An unknown error occurred');
  }
});

export const registerAction = createAsyncThunk('commonAuth/register', async (data, { rejectWithValue }) => {
  try {
    return await service.register(data);
  } catch (error) {
    Logger.error('Register failed:', error);
    return rejectWithValue(error.response?.data || 'An unknown error occurred');
  }
});

export const verifyOtpAction = createAsyncThunk('commonAuth/verifyOtp', async (data, { rejectWithValue }) => {
  try {
    return await service.verifyOtp(data);
  } catch (error) {
    Logger.error('Verify OTP failed:', error);
    return rejectWithValue(error.response?.data || 'An unknown error occurred');
  }
});

export const resendOtpAction = createAsyncThunk('commonAuth/resendOtp', async (data, { rejectWithValue }) => {
  try {
    return await service.resendOtp(data);
  } catch (error) {
    Logger.error('Resend OTP failed:', error);
    return rejectWithValue(error.response?.data || 'An unknown error occurred');
  }
});

export const resendLoginOtpAction = createAsyncThunk('commonAuth/resendLoginOtp', async (data, { rejectWithValue }) => {
  try {
    return await service.resendLoginOtp(data);
  } catch (error) {
    Logger.error('Resend Login OTP failed:', error);
    return rejectWithValue(error.response?.data || 'An unknown error occurred');
  }
});

export const checkLoginStatus = createAsyncThunk('account/checkLoginStatus', async (_, { dispatch }) => {
  Logger.info('Checking login status');

  const accessTokenData = await getToken('accessToken');
  const parsedUserData = getUser();
  if (!accessTokenData) {
    Logger.info('Access token does not exist');
    return { isLoggedIn: false, user: null };
  }

  const currentTime = Date.now();
  const accessTokenExpiry = new Date(accessTokenData.expiry).getTime();
  if (accessTokenExpiry > currentTime) {
    Logger.info('Access token is valid');
    return { isLoggedIn: true, user: parsedUserData };
  }

  Logger.info('Access token is expired, checking refresh token');

  const refreshTokenData = await getToken('refreshToken');
  if (!refreshTokenData) {
    Logger.info('Refresh token does not exist');
    return { isLoggedIn: false, user: null };
  }
  Logger.info('RefreshTokenData present, checking expiry');

  const refreshTokenExpiry = new Date(refreshTokenData.expiry).getTime();
  if (refreshTokenExpiry <= currentTime) {
    Logger.info('Refresh token is expired');
    await dispatch(logoutUserAction());
    return { isLoggedIn: false, user: null };
  }

  Logger.info('Refresh token is valid, attempting to refresh access token');

  try {
    const result = await dispatch(refreshTokenAction());
    if (result.error) {
      Logger.error('Refresh token action failed:', result.error);
      await dispatch(logoutUserAction());
      return { isLoggedIn: false, user: null };
    }
    Logger.info('Access token refreshed successfully');
    return { isLoggedIn: true, user: parsedUserData };
  } catch (refreshError) {
    Logger.error('Failed to refresh access token:', refreshError);
    await dispatch(logoutUserAction());
    return { isLoggedIn: false, user: null };
  }
});
