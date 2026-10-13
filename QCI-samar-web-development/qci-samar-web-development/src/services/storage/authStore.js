import CryptoJS from 'crypto-js';
import AppSettings from '../../appsettings';
import { Logger } from '../../utils/logger';

// Encryption key from environment-specific configuration
const ENCRYPTION_KEY = AppSettings.ENCRYPTION_KEY;

// Validate encryption key is configured - fail fast if missing
if (!ENCRYPTION_KEY) {
  const errorMsg = 'ENCRYPTION_KEY is not configured. Check appsettings configuration.';
  Logger.error(errorMsg);
  throw new Error(errorMsg);
}

// Keys for storage
const AUTH_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const PROFILE_STORAGE_KEY = '@profile_data';
const AUTH_DATA_KEY = '@auth_data';
const USER_DATA_KEY = '@user_data';

// Auth now lives in sessionStorage so the session ends when the browser closes.
// Purge any auth data left in localStorage by earlier builds so it can't auto-login.
try {
  [AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, PROFILE_STORAGE_KEY, AUTH_DATA_KEY, USER_DATA_KEY, 'user'].forEach(key => localStorage.removeItem(key));
} catch {
  // localStorage unavailable (private mode / SSR) — nothing to migrate.
}

// Encryption helpers
const encrypt = data => {
  try {
    return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
  } catch (error) {
    Logger.error('Encryption failed', error);
    return null;
  }
};

const decrypt = encryptedData => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  } catch (error) {
    Logger.error('Decryption failed', error);
    return null;
  }
};

// Token management with encrypted sessionStorage — session clears when the browser is closed
/**
 * Store token with expiry.
 */
export const storeToken = async (key, token, expiry) => {
  try {
    const data = { token, expiry };
    const encryptedData = encrypt(data);
    if (encryptedData) {
      sessionStorage.setItem(key, encryptedData);
      Logger.info(`Token stored successfully for key: ${key}`);
    }
  } catch (error) {
    Logger.error(`Error storing token for key: ${key}`, error);
  }
};

/**
 * Retrieve token and check if expired.
 */
export const getToken = async key => {
  try {
    const encryptedData = sessionStorage.getItem(key);
    if (!encryptedData) {
      Logger.warn(`No token data found for key: ${key}`);
      return null;
    }

    const parsedData = decrypt(encryptedData);
    if (!parsedData) {
      Logger.warn(`Invalid or no token data found for key: ${key}`);
      return null;
    }

    const { token, expiry } = parsedData;
    return { token, expiry };
  } catch (error) {
    Logger.error(`Error retrieving token for key: ${key}`, error);
    return null;
  }
};

/**
 * Remove token by key.
 */
export const removeToken = async key => {
  try {
    sessionStorage.removeItem(key);
    Logger.info(`Token removed successfully for key: ${key}`);
  } catch (error) {
    Logger.error(`Failed to remove token for key: ${key}`, error);
  }
};

// Convenience methods for auth tokens
/**
 * Store authentication token
 */
export const storeAuthToken = async (token, expiry) => {
  return storeToken(AUTH_TOKEN_KEY, token, expiry);
};

/**
 * Get authentication token
 */
export const getAuthToken = async () => {
  return getToken(AUTH_TOKEN_KEY);
};

/**
 * Store refresh token
 */
export const storeRefreshToken = async (token, expiry) => {
  return storeToken(REFRESH_TOKEN_KEY, token, expiry);
};

/**
 * Get refresh token
 */
export const getRefreshToken = async () => {
  return getToken(REFRESH_TOKEN_KEY);
};

// User authentication data management with sessionStorage
/**
 * Store complete user authentication data
 * @param {Object} authData - User authentication data object
 */
export const storeAuthData = async authData => {
  try {
    // Store main auth data in sessionStorage (encrypted)
    const dataToStore = {
      userId: authData.userId,
      userName: authData.userName,
      lastAccessToken: authData.lastAccessToken || new Date().toISOString(),
    };

    const encryptedData = encrypt(dataToStore);
    if (encryptedData) {
      sessionStorage.setItem(AUTH_DATA_KEY, encryptedData);
    }

    // Store tokens securely
    if (authData.token) {
      await storeAuthToken(authData.token, authData.tokenExpiry);
    }
    if (authData.refreshToken) {
      await storeRefreshToken(authData.refreshToken, authData.refreshTokenExpiry);
    }

    Logger.info('Authentication data stored successfully');
    return true;
  } catch (error) {
    Logger.error('Error storing authentication data:', error);
    return false;
  }
};

/**
 * Retrieve user authentication data
 * @returns {Object|null} User authentication data or null if not found
 */
export const getAuthData = async () => {
  try {
    // Get basic auth data from sessionStorage
    const encryptedValue = sessionStorage.getItem(AUTH_DATA_KEY);
    if (!encryptedValue) {
      return null;
    }

    const authData = decrypt(encryptedValue);
    if (!authData) {
      return null;
    }

    // Get tokens
    const authToken = await getAuthToken();
    const refreshToken = await getRefreshToken();

    return {
      ...authData,
      token: authToken?.token,
      tokenExpiry: authToken?.expiry,
      refreshToken: refreshToken?.token,
      refreshTokenExpiry: refreshToken?.expiry,
    };
  } catch (error) {
    Logger.error('Error retrieving authentication data:', error);
    return null;
  }
};

/**
 * Remove all user authentication data
 */
export const removeAuthData = async () => {
  try {
    sessionStorage.removeItem(AUTH_DATA_KEY);
    await removeToken(AUTH_TOKEN_KEY);
    await removeToken(REFRESH_TOKEN_KEY);

    Logger.info('Authentication data removed successfully');
    return true;
  } catch (error) {
    Logger.error('Error removing authentication data:', error);
    return false;
  }
};

// Profile data management with sessionStorage (encrypted for security)
/**
 * Store user profile data (encrypted)
 * @param {Object} profileData - User profile data object
 */
export const storeProfileData = async profileData => {
  try {
    const encryptedData = encrypt(profileData);
    if (encryptedData) {
      sessionStorage.setItem(PROFILE_STORAGE_KEY, encryptedData);
      Logger.info('Profile data stored successfully');
      return true;
    }
    Logger.error('Failed to encrypt profile data');
    return false;
  } catch (error) {
    Logger.error('Error storing profile data:', error);
    return false;
  }
};

/**
 * Retrieve user profile data (decrypted)
 * @returns {Object|null} User profile data or null if not found
 */
export const getProfileData = async () => {
  try {
    const encryptedValue = sessionStorage.getItem(PROFILE_STORAGE_KEY);
    if (!encryptedValue) {
      return null;
    }
    return decrypt(encryptedValue);
  } catch (error) {
    Logger.error('Error retrieving profile data:', error);
    return null;
  }
};

/**
 * Remove user profile data
 */
export const removeProfileData = async () => {
  try {
    sessionStorage.removeItem(PROFILE_STORAGE_KEY);
    Logger.info('Profile data removed successfully');
    return true;
  } catch (error) {
    Logger.error('Error removing profile data:', error);
    return false;
  }
};

// User object management with encrypted sessionStorage
/**
 * Store user object (encrypted)
 * @param {Object} userData - User data object from login response
 */
export const storeUser = userData => {
  try {
    const encryptedData = encrypt(userData);
    if (encryptedData) {
      sessionStorage.setItem(USER_DATA_KEY, encryptedData);
      Logger.info('User data stored successfully');
      return true;
    }
    Logger.error('Failed to encrypt user data');
    return false;
  } catch (error) {
    Logger.error('Error storing user data:', error);
    return false;
  }
};

/**
 * Retrieve user object (decrypted)
 * @returns {Object|null} User data or null if not found
 */
export const getUser = () => {
  try {
    const encryptedValue = sessionStorage.getItem(USER_DATA_KEY);
    if (!encryptedValue) {
      return null;
    }
    return decrypt(encryptedValue);
  } catch (error) {
    Logger.error('Error retrieving user data:', error);
    return null;
  }
};

/**
 * Remove user object
 */
export const removeUser = () => {
  try {
    sessionStorage.removeItem(USER_DATA_KEY);
    // Clean up legacy unencrypted user data if present
    sessionStorage.removeItem('user');
    Logger.info('User data removed successfully');
    return true;
  } catch (error) {
    Logger.error('Error removing user data:', error);
    return false;
  }
};

/**
 * Clear all user data (auth, profile, and user)
 * Used during logout/account deletion
 */
export const clearAllUserData = async () => {
  try {
    await removeAuthData();
    await removeProfileData();
    removeUser();

    Logger.info('All user data cleared successfully');
    return true;
  } catch (error) {
    Logger.error('Error clearing all user data:', error);
    return false;
  }
};
