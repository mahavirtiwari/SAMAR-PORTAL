import { useEffect, useState } from 'react';
import AppSettings from '../../appsettings';
import { Logger } from './logger';
import { VersionCheck } from './versionCheck';

const GATE_TIMEOUT_MS = 10000;

/**
 * Custom hook to check for required app updates
 *
 * @param {boolean} isAppReady - Whether the app is ready to perform the check
 * @param {string} environment - The app environment (defaults to the one in AppSettings)
 * @returns {Object} Update information
 * @returns {boolean} isUpdateRequired - Whether an update is required
 * @returns {string|null} updateUrl - The URL to download the update, if available
 */
export const useVersionCheck = (environment = AppSettings.ENVIRONMENT) => {
  const [updateInfo, setUpdateInfo] = useState({
    isChecking: environment === 'Production',
    isUpdateRequired: false,
    updateUrl: null,
  });

  useEffect(() => {
    let isMounted = true;

    // Hard ceiling on how long the gate may hold the UI. The retry loop's own
    // bound is the sum of its timeouts and delays, which is long enough to look
    // like a hang, and a future change to either constant would silently
    // lengthen startup. Past this point the app renders and the check is
    // treated as inconclusive. Cleared as soon as the check settles, so a real
    // "update required" result is never overwritten by a late firing.
    let deadline = null;
    const releaseGate = () => {
      if (isMounted) {
        Logger.warn('Version check did not settle in time, releasing the UI');
        setUpdateInfo({ isChecking: false, isUpdateRequired: false, updateUrl: null });
      }
    };
    const settled = () => {
      if (deadline) {
        clearTimeout(deadline);
        deadline = null;
      }
    };

    const checkVersion = async () => {
      try {
        // All retry logic is handled in the VersionCheck module

        const { isNewVersionAvailable, url } = await VersionCheck.isNewVersionAvailable();

        settled();
        if (isNewVersionAvailable && isMounted) {
          Logger.info('Update required. URL:', url || 'Not available yet');
          setUpdateInfo({
            isChecking: false,
            isUpdateRequired: true,
            updateUrl: url,
          });
        } else if (isMounted) {
          Logger.info('App is up to date');
          setUpdateInfo({
            isChecking: false,
            isUpdateRequired: false,
            updateUrl: null,
          });
        }
      } catch (error) {
        settled();
        Logger.error('Error checking app version:', error);
        if (isMounted) {
          setUpdateInfo({
            isChecking: false,
            isUpdateRequired: false,
            updateUrl: null,
          });
        }
      }
    };

    // Only run version check in Production environment when app is ready
    if (environment === 'Production') {
      deadline = setTimeout(releaseGate, GATE_TIMEOUT_MS);
      checkVersion();
    }

    return () => {
      isMounted = false;
      settled();
    };
  }, [environment]);

  return updateInfo;
};
