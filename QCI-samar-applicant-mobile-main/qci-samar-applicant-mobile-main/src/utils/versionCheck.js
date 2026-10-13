import { getBundleId, getSystemName, getVersion } from 'react-native-device-info';
import { Logger } from './logger';

const country = 'IN';

// The UI is gated on this lookup, so a request that never settles freezes the
// app on the splash with no way past it. fetch() imposes no timeout of its own.
const LOOKUP_TIMEOUT_MS = 8000;

const fetchWithTimeout = async (url, options) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

// "No such listing" is a settled answer, not a transient fault. Retrying it
// costs every launch MAX_RETRIES * RETRY_DELAY and cannot change the outcome,
// so these errors skip the retry loop.
const permanentError = message => Object.assign(new Error(message), { isPermanent: true });

// Utility function to parse and coerce version to a valid format
const parseVersion = version => {
  Logger.info(`Parsing version: ${version}`);
  const coercedVersion = version.replace(/[^0-9.]/g, '');
  const versionParts = coercedVersion.split('.').map(Number);
  return {
    major: versionParts[0] || 0,
    minor: versionParts[1] || 0,
    patch: versionParts[2] || 0,
    prerelease: version.includes('-') ? version.split('-')[1] : '',
  };
};

// Utility function to compare two versions loosely
const diffLoose = (version1, version2) => {
  Logger.info(`Comparing versions: ${version1} and ${version2}`);
  if (version1 === version2) {
    return null;
  }

  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  if (v1.major < v2.major) {
    return 'major';
  }
  if (v1.major > v2.major) {
    return null;
  }
  if (v1.minor < v2.minor) {
    return 'minor';
  }
  if (v1.minor > v2.minor) {
    return null;
  }
  if (v1.patch < v2.patch) {
    return 'patch';
  }
  if (v1.patch > v2.patch) {
    return null;
  }

  if (v1.prerelease && !v2.prerelease) {
    return 'prerelease';
  }
  if (!v1.prerelease && v2.prerelease) {
    return null;
  }
  if (v1.prerelease < v2.prerelease) {
    return 'prerelease';
  }
  if (v1.prerelease > v2.prerelease) {
    return null;
  }

  return null;
};

// Function to compare current version with the latest version
const versionCompare = (currentVersion, latestVersion) => {
  Logger.info(`Comparing current version: ${currentVersion} with latest version: ${latestVersion}`);
  if (!latestVersion) {
    return {
      needsUpdate: false,
      updateType: null,
      notice: 'Error: could not get latest version',
    };
  }

  try {
    const updateType = diffLoose(currentVersion, latestVersion);
    return {
      needsUpdate: !!updateType,
      updateType,
    };
  } catch (e) {
    Logger.error(`Error comparing versions: ${e.message}`);
    const needsUpdate = currentVersion !== latestVersion && latestVersion > currentVersion;
    const updateType = needsUpdate ? 'minor' : null;
    return {
      needsUpdate,
      updateType,
      notice: e.message.replace(/^Invalid Version:/, 'Not a valid version:'),
    };
  }
};

// Function to fetch version details from Google Play Store
const fetchAndroidVersion = async url => {
  Logger.info(`Fetching Android version from URL: ${url}`);
  let response;
  try {
    response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.96 Mobile Safari/537.36',
        'sec-fetch-site': 'same-origin',
      },
    });
  } catch (error) {
    Logger.error(`Error fetching data from Google Play Store: ${error.message}`);
    throw new Error('Error fetching data from Google Play Store.');
  }

  if (!response.ok) {
    if (response.status === 404) {
      Logger.warn('App with app ID is not listed on Google Play.');
      throw permanentError('App with app ID not found in Google Play.');
    }
    Logger.error(`Error fetching data: ${response.statusText}`);
    throw new Error(response.statusText);
  }

  const text = await response.text();

  // Primary regex pattern for current Play Store format
  let versionMatch = text.match(/\[\[\[['"]((\d+\.)+\d+)['"]\]\],/);

  // Alternate patterns as fallbacks
  if (!versionMatch) {
    // Fallback 1: Look for version in "current version" text
    versionMatch = text.match(/Current Version[^\d]+((\d+\.)+\d+)/i);
  }

  if (!versionMatch) {
    // Fallback 2: Look for itemprop="softwareVersion"
    versionMatch = text.match(/itemprop="softwareVersion"[^>]*>((\d+\.)+\d+)</i);
  }

  if (!versionMatch) {
    // Fallback 3: Try a more generic pattern for version numbers
    const allVersions = text.match(/(\d+\.\d+(\.\d+)?)/g);
    // If we found multiple version-like strings, use the first one
    versionMatch = allVersions && allVersions.length > 0 ? [null, allVersions[0]] : null;
  }

  const version = versionMatch ? versionMatch[1] : null;

  if (!version) {
    Logger.warn('Could not extract version from Play Store. Using fallback method.');
  }

  const notesMatch = text.match(/<div itemprop="description">(.*?)<\/div>/);
  const notes = notesMatch ? notesMatch[1] : '';

  return {
    version,
    releasedAt: new Date().toISOString(),
    notes,
    url,
    lastChecked: new Date().toISOString(),
  };
};

// Function to fetch version details from Apple App Store
const fetchIosVersion = async url => {
  Logger.info(`Fetching iOS version from URL: ${url}`);
  let response;
  try {
    response = await fetchWithTimeout(url);
  } catch (error) {
    Logger.warn('Error connecting to iTunes:', error.message);
    throw new Error('Error connecting to iTunes.');
  }

  const data = await response.json();

  if (!data || !('results' in data)) {
    Logger.error('Unknown error connecting to iTunes.');
    throw new Error('Unknown error connecting to iTunes.');
  }
  if (!data.results.length) {
    Logger.warn('App for this bundle ID is not listed on the App Store.');
    throw permanentError('App for this bundle ID not found.');
  }

  const result = data.results[0];

  return {
    version: result.version || null,
    released: result.currentVersionReleaseDate || result.releaseDate || null,
    notes: result.releaseNotes || '',
    url: result.trackViewUrl || result.artistViewUrl || result.sellerUrl || null,
    country,
    lastChecked: new Date().toISOString(),
  };
};

// Function to lookup version based on platform
const lookupVersion = async (platform, identifier) => {
  Logger.info(`Looking up version for platform: ${platform}, identifier: ${identifier}`);
  const url =
    platform === 'ios'
      ? `https://itunes.apple.com/lookup?bundleId=${identifier}&country=${country}&_=${Date.now()}`
      : `https://play.google.com/store/apps/details?id=${identifier}&hl=${country}`;

  return platform === 'ios' ? fetchIosVersion(url) : fetchAndroidVersion(url);
};

// Constants for retry mechanism
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000; // 3 seconds

/**
 * Check for new version with retry logic
 * @returns {Promise<{isNewVersionAvailable: boolean, updateType: string, url: string}>}
 */
const checkForUpdates = async () => {
  const platform = getSystemName().toLowerCase();
  const identifier = getBundleId();
  const currentVersion = getVersion();

  // Implement retry mechanism
  let retryCount = 0;
  let lastError = null;

  while (retryCount <= MAX_RETRIES) {
    try {
      Logger.info(
        `Checking if new version is available (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`,
      );
      Logger.info(
        `Platform: ${platform}, identifier: ${identifier}, current version: ${currentVersion}`,
      );

      const latestVersionInfo = await lookupVersion(platform, identifier);
      const comparison = versionCompare(currentVersion, latestVersionInfo.version);
      return {
        isNewVersionAvailable: comparison.needsUpdate,
        updateType: comparison.updateType,
        url: latestVersionInfo.url,
      };
    } catch (error) {
      lastError = error;

      if (error?.isPermanent) {
        Logger.warn(`Version check gave a settled answer, not retrying: ${error.message}`);
        throw error;
      }

      // If we've reached max retries, log as error and throw
      if (retryCount === MAX_RETRIES) {
        Logger.error(`Version check failed after ${MAX_RETRIES + 1} attempts: ${error.message}`);
        throw error;
      }

      // Log intermediate retries as warnings to avoid Crashlytics noise
      Logger.warn(
        `Version check attempt ${retryCount + 1}/${MAX_RETRIES + 1} failed: ${error.message}`,
      );

      // Otherwise, wait and retry
      retryCount++;
      Logger.info(`Retrying version check in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }

  // This should never be reached due to the throw above, but just in case
  throw lastError || new Error('Failed to check for updates after multiple attempts');
};

/**
 * Get fallback store URL based on platform
 * @returns {string} The appropriate app store URL
 */
const getFallbackStoreUrl = () => {
  const platform = getSystemName().toLowerCase();
  const bundleId = getBundleId();

  return platform === 'ios'
    ? `https://apps.apple.com/in/app/${bundleId}`
    : `https://play.google.com/store/apps/details?id=${bundleId}&hl=${country}`;
};

// Main export
const VersionCheck = {
  /**
   * Check if a new version is available
   * Includes retry logic and proper error handling
   */
  isNewVersionAvailable: async () => {
    return checkForUpdates();
  },

  /**
   * Opens the appropriate store URL to update the app
   * Uses the provided URL or falls back to direct store URLs
   * @param {string} url - Optional URL to open
   */
  openUpdateUrl: async url => {
    const { Linking } = require('react-native');

    try {
      if (url) {
        Logger.info(`Opening app store URL: ${url}`);
        await Linking.openURL(url);
      } else {
        const fallbackUrl = getFallbackStoreUrl();
        Logger.info(`Opening fallback store URL: ${fallbackUrl}`);
        await Linking.openURL(fallbackUrl);
      }
      return true;
    } catch (error) {
      Logger.error(`Failed to open store URL: ${error.message}`);

      // Try with fallback URL if the original failed
      try {
        if (url) {
          // Only try fallback if we were using a specific URL before
          const fallbackUrl = getFallbackStoreUrl();
          Logger.info(`Trying fallback store URL: ${fallbackUrl}`);
          await Linking.openURL(fallbackUrl);
          return true;
        }
      } catch (fallbackError) {
        Logger.error(`Failed to open fallback URL: ${fallbackError.message}`);
      }

      return false;
    }
  },

  /**
   * Get the fallback store URL
   * Useful when URL from version check fails
   */
  getFallbackStoreUrl,
};

export { VersionCheck };
