import * as Keychain from 'react-native-keychain';
import { Logger } from '../../utils/logger';

/**
 * Store token with expiry.
 */
export const storeToken = async (key, token, expiry) => {
  try {
    const data = JSON.stringify({ token, expiry });
    await Keychain.setInternetCredentials(key, 'token', data, { service: key });
    Logger.info(`Token stored successfully for key: ${key}`);
  } catch (error) {
    Logger.error(`Error storing token for key: ${key}`, error);
  }
};

/**
 * Parse token data from credentials.
 */
const parseTokenData = credentials => {
  if (!credentials) {
    return null;
  }

  const { password } = credentials;

  try {
    const parsedData = JSON.parse(password);
    return parsedData;
  } catch (error) {
    Logger.error('Failed to parse token data', error);
    return null;
  }
};

/**
 * Retrieve token and check if expired.
 */

export const getToken = async key => {
  try {
    const credentials = await Keychain.getInternetCredentials(key, { service: key });
    const parsedData = parseTokenData(credentials);

    if (!parsedData) {
      Logger.info(`No valid token data found for key: ${key}`);
      return null;
    }

    const { token, expiry } = parsedData;
    return { token, expiry };
  } catch (error) {
    if (error.message.includes('Key permanently invalidated')) {
      Logger.error(`Key permanently invalidated for key: ${key}. Clearing the invalidated key.`);
      await removeToken(key);
      return null;
    }
    Logger.error(`Error retrieving token for key: ${key}`, error);
    return null;
  }
};

/**
 * Remove token by key.
 */
export const removeToken = async key => {
  try {
    // resetInternetCredentials takes a single options object. Passing the key as a
    // first argument hands native a string where it expects a dictionary, which
    // raises an unrecognised-selector exception on the keychain queue and aborts
    // the process. A JS try/catch cannot intercept that, so it reads as a crash.
    await Keychain.resetInternetCredentials({ server: key, service: key });
    Logger.info(`Token removed successfully for key: ${key}`);
  } catch (error) {
    Logger.error(`Failed to remove token for key: ${key}`, error);
  }
};
