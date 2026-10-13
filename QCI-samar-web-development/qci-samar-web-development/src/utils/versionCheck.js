import AppSettings from '../appsettings';
import { clearAllUserData } from '../services/storage/authStore';
import { Logger } from './logger';

const APP_BUILD_KEY = 'app_build_time';
// Survives forceLogoutAndReload (clearAllUserData only removes auth keys) and the reload
// itself (sessionStorage is per-tab), so it can gate the reload to run at most once.
const RELOAD_GUARD_KEY = 'version_reload_attempted';
const VERSION_CHECK_CACHE_BUST = () => `?_t=${Date.now()}`;

const forceLogoutAndReload = async serverBuildTime => {
  await clearAllUserData();
  localStorage.setItem(APP_BUILD_KEY, serverBuildTime);
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }
  window.location.reload();
};

/**
 * Reload once to pick up a genuinely new deployment. If we have already reloaded and the
 * mismatch is still there, the server is serving skewed artifacts (bundle BUILD_TIME !=
 * version.json buildTime) — a reload can never reconcile that, so stop looping and render
 * the current bundle instead of bricking the app.
 */
const reloadOnceForVersion = async (serverBuildTime, reason) => {
  if (sessionStorage.getItem(RELOAD_GUARD_KEY)) {
    Logger.error(
      `${reason} still present after one reload (bundle=${AppSettings.BUILD_TIME}, server=${serverBuildTime}). ` + 'Server artifacts look skewed; serving current bundle instead of reloading again.',
    );
    return true;
  }
  Logger.info(`${reason} (bundle=${AppSettings.BUILD_TIME}, server=${serverBuildTime}). Clearing session and reloading once.`);
  sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
  await forceLogoutAndReload(serverBuildTime);
  return false;
};

/**
 * Two-layer deployment detection:
 *
 * 1. STALE BUNDLE CHECK — compares BUILD_TIME baked into the JS bundle
 *    against the server's version.json. Catches the case where the browser
 *    is still running old cached JS after a new deployment.
 *
 * 2. NEW DEPLOYMENT CHECK — compares the server's buildTime against the
 *    value stored in localStorage from the last visit. Catches the case
 *    where the browser loaded the new JS (bundle matches server) but a
 *    deployment happened since the user's last session.
 *
 * Returns true to continue normally, false if a reload was triggered.
 */
export const checkAppVersion = async () => {
  try {
    const response = await fetch(`/version.json${VERSION_CHECK_CACHE_BUST()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      Logger.warn('Version check: could not fetch version.json');
      return true;
    }

    const { buildTime: serverBuildTime } = await response.json();

    // Layer 1: Stale bundle — old JS still cached in browser
    const bundleBuildTime = AppSettings.BUILD_TIME;
    if (bundleBuildTime && bundleBuildTime !== serverBuildTime) {
      return await reloadOnceForVersion(serverBuildTime, 'Stale bundle detected');
    }

    // Layer 2: New deployment since last visit — browser has new JS but session is from old deployment
    const storedBuildTime = localStorage.getItem(APP_BUILD_KEY);
    if (storedBuildTime && storedBuildTime !== serverBuildTime) {
      return await reloadOnceForVersion(serverBuildTime, 'New deployment detected');
    }

    // First visit or same build — clear the reload guard and continue
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
    localStorage.setItem(APP_BUILD_KEY, serverBuildTime);
    return true;
  } catch (error) {
    Logger.warn('Version check failed:', error);
    return true;
  }
};

/**
 * Global handler for chunk/script load failures.
 * When a new deployment changes chunk hashes, old cached HTML
 * references chunks that no longer exist. This catches those
 * errors and forces a single reload.
 */
export const setupChunkErrorHandler = () => {
  const RELOAD_KEY = 'chunk_error_reload';

  window.addEventListener(
    'error',
    event => {
      const target = event.target;
      // Detect <script> or <link> load failures
      if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
        const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);
        if (!alreadyReloaded) {
          Logger.warn('Chunk load error detected, reloading page...');
          sessionStorage.setItem(RELOAD_KEY, 'true');
          window.location.reload();
        }
      }
    },
    true,
  ); // Use capture phase to catch resource load errors

  // Handle dynamic import() failures (React.lazy, code splitting)
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (error && (error.name === 'ChunkLoadError' || /loading chunk/i.test(message) || /loading css chunk/i.test(message))) {
      const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);
      if (!alreadyReloaded) {
        Logger.warn('ChunkLoadError detected, reloading page...');
        sessionStorage.setItem(RELOAD_KEY, 'true');
        window.location.reload();
        return true;
      }
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  // Also handle unhandled promise rejections (dynamic import returns promises)
  window.addEventListener('unhandledrejection', event => {
    const error = event.reason;
    if (error && (error.name === 'ChunkLoadError' || /loading chunk/i.test(String(error)) || /loading css chunk/i.test(String(error)))) {
      const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);
      if (!alreadyReloaded) {
        Logger.warn('ChunkLoadError (promise) detected, reloading page...');
        sessionStorage.setItem(RELOAD_KEY, 'true');
        window.location.reload();
      }
    }
  });

  // Clear the reload flag on successful page load so future errors can trigger reload again
  window.addEventListener('load', () => {
    sessionStorage.removeItem(RELOAD_KEY);
  });
};
