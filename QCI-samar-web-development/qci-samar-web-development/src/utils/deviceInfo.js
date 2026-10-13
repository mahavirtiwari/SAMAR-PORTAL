/**
 * Utility functions for detecting device and browser information
 */

import AppSettings from '../appsettings';

/**
 * Detects the device type based on user agent
 * @returns {'mobile' | 'tablet' | 'web'} The device type
 */
export const getDeviceType = () => {
  const userAgent = navigator.userAgent.toLowerCase();

  // Check for mobile devices
  const mobileKeywords = ['iphone', 'ipod', 'android', 'blackberry', 'windows phone', 'opera mini', 'iemobile'];
  const isMobile = mobileKeywords.some(keyword => userAgent.includes(keyword));

  // Check for tablets
  const isTablet = userAgent.includes('ipad') || (userAgent.includes('android') && !userAgent.includes('mobile'));

  if (isTablet) {
    return 'tablet';
  }

  if (isMobile) {
    return 'mobile';
  }

  return 'web';
};

/**
 * Detects the browser name based on user agent
 * @returns {string} The browser name (e.g., 'Chrome', 'Firefox', 'Safari')
 */
const getBrowserName = () => {
  const userAgent = navigator.userAgent;

  // Order matters - check more specific browsers first
  if (userAgent.includes('Edg/')) {
    return 'Edge';
  }

  if (userAgent.includes('OPR/') || userAgent.includes('Opera')) {
    return 'Opera';
  }

  if (userAgent.includes('Chrome') && !userAgent.includes('Chromium')) {
    return 'Chrome';
  }

  if (userAgent.includes('Firefox')) {
    return 'Firefox';
  }

  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    return 'Safari';
  }

  if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
    return 'Internet Explorer';
  }

  return 'Unknown Browser';
};

/**
 * Detects the operating system based on user agent
 * @returns {string} The OS name (e.g., 'Windows', 'macOS', 'Linux', 'iOS', 'Android')
 */
const getOperatingSystem = () => {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform?.toLowerCase() || '';

  if (userAgent.includes('Win')) {
    return 'Windows';
  }

  if (userAgent.includes('Mac')) {
    // Check if it's iOS (iPhone/iPad) or macOS
    if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('iPod')) {
      return 'iOS';
    }
    return 'macOS';
  }

  if (userAgent.includes('Android')) {
    return 'Android';
  }

  if (userAgent.includes('Linux')) {
    return 'Linux';
  }

  if (userAgent.includes('CrOS')) {
    return 'Chrome OS';
  }

  if (platform.includes('win')) {
    return 'Windows';
  }

  if (platform.includes('mac')) {
    return 'macOS';
  }

  if (platform.includes('linux')) {
    return 'Linux';
  }

  return 'Unknown OS';
};

/**
 * Gets a formatted device name string combining browser and OS
 * @returns {string} Device name in format "Browser on OS" (e.g., "Chrome on Windows")
 */
export const getDeviceName = () => {
  const browser = getBrowserName();
  const os = getOperatingSystem();

  return `${browser} on ${os}`;
};

const DEVICE_ID_KEY = 'deviceInstallId';

/**
 * Stable per-browser id, persisted in localStorage. Lets single-session
 * enforcement tell this browser re-authenticating from a genuinely different
 * device, so a re-login never terminates its own session (BUG-06042).
 * @returns {string}
 */
export const getDeviceId = () => {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto?.randomUUID ? crypto.randomUUID() : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

/**
 * Gets complete device info for login requests
 * @returns {{ deviceType: string, deviceName: string, deviceId: string }} Device information object
 */
export const getDeviceInfo = () => ({
  deviceType: getDeviceType(),
  deviceName: getDeviceName(),
  deviceId: getDeviceId(),
});

/**
 * Device metadata for assessment audit records (punch, completion).
 * @returns {{ deviceModel: string, osVersion: string, appVersion: string }}
 */
export const getDeviceMetadata = () => ({
  deviceModel: getDeviceName(),
  osVersion: getOperatingSystem(),
  appVersion: AppSettings?.VERSION || 'web',
});
