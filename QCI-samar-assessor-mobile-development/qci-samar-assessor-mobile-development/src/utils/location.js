import { Alert, Linking, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Geolocation from 'react-native-geolocation-service';
import {
  LOCATION_CAPTURE_MAX_AGE_MS,
  LOCATION_LAST_KNOWN_MAX_AGE_MS,
  LOCATION_TIMEOUT_MS,
  LOCATION_TIMEOUT_OFFLINE_MS
} from '../constants/Config';
import { checkInternetConnection } from './checkInternetConnection';
import { Logger } from './logger';
import { checkAppPermissions, ensurePermission, waitForReturnFromSettings } from './permissions';

// Whether the device's location services (the OS GPS master switch) are ON.
// Distinct from the app's location PERMISSION: a user can grant the app
// permission yet leave the device toggle off, and then every getCurrentPosition
// call can only burn its full timeout before failing. Never throws — a failed
// probe resolves true so a driver-reporting quirk can't wrongly block a capture.
export const isLocationEnabled = async () => {
  try {
    return await DeviceInfo.isLocationEnabled();
  } catch (error) {
    Logger.warn('Could not read location-services state:', error?.message || error);
    return true;
  }
};

const openLocationSettings = async () => {
  try {
    if (Platform.OS === 'android') {
      // Opens the device Location settings screen (the master toggle) directly.
      // iOS has no public API to reach the global Location Services switch, so
      // it falls through to the app's own settings page below.
      await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      return;
    }
    await Linking.openSettings();
  } catch (error) {
    Logger.warn('Could not open location settings:', error?.message || error);
    try {
      await Linking.openSettings();
    } catch (fallbackError) {
      Logger.error('Falling back to app settings failed:', fallbackError?.message || fallbackError);
    }
  }
};

/**
 * Ensure the device's location services are switched on before any fix is
 * attempted. Returns true when they are; otherwise shows one actionable alert
 * offering to open the location settings and returns false — the caller then
 * bails out at once instead of sitting on a spinner while getCurrentPosition
 * burns its timeout (BUG: capture/punch stuck on the loading screen with
 * location off). When the user returns from settings the toggle is re-read, so
 * enabling it there lets the same attempt resolve true.
 */
export const ensureLocationServicesEnabled = async (
  message = 'Location is required to continue. Please turn on Location to proceed.'
) => {
  if (await isLocationEnabled()) {
    return true;
  }
  return new Promise((resolve) => {
    Alert.alert(
      'Location is Off',
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Enable Location',
          onPress: () => {
            waitForReturnFromSettings().then(async () => {
              resolve(await isLocationEnabled());
            });
            openLocationSettings();
          }
        }
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
};

const positionOnce = (options) =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, options);
  });

// Latest GPS fix this session has seen, from the warm-up watcher or a
// successful one-shot. Offline, this is what lets a capture proceed when the
// chip cannot produce a fresh fix inside the timeout.
let lastFix = null;
let watchId = null;
let warmupUsers = 0;
const fixWaiters = new Set();

const recordFix = (position) => {
  lastFix = { coords: position.coords, at: Date.now() };
  for (const notify of fixWaiters) {
    notify(position.coords);
  }
  fixWaiters.clear();
};

// Resolves with the next fix the warm-up watcher delivers, or rejects after
// `timeout`. Lets a one-shot request and the watcher race for the same fix.
const waitForNextFix = (timeout) =>
  new Promise((resolve, reject) => {
    let timer = null;
    const notify = (coords) => {
      clearTimeout(timer);
      resolve(coords);
    };
    timer = setTimeout(() => {
      fixWaiters.delete(notify);
      reject(new Error('warm-up fix timeout'));
    }, timeout);
    fixWaiters.add(notify);
  });

// Single in-flight arm attempt: two callers racing past the permission check
// would otherwise both call watchPosition and the first watcher's id would be
// overwritten, leaking a native GPS watcher nobody can clear.
let armingPromise = null;

const armWatch = () => {
  if (watchId != null) {
    return Promise.resolve();
  }
  if (!armingPromise) {
    armingPromise = (async () => {
      try {
        const { permissions } = await checkAppPermissions();
        // Never prompt from here: the capture and punch flows own the permission
        // dialog; the next getCurrentCoords after the grant arms the watch.
        if (permissions.location !== 'granted' || watchId != null || warmupUsers === 0) {
          return;
        }
        watchId = Geolocation.watchPosition(
          recordFix,
          (error) => Logger.warn('Location warm-up error:', error?.message || error),
          {
            enableHighAccuracy: true,
            distanceFilter: 0,
            interval: 5000,
            fastestInterval: 2000,
            showLocationDialog: false,
            forceRequestLocation: true
          }
        );
        Logger.info('Location warm-up started');
      } finally {
        armingPromise = null;
      }
    })();
  }
  return armingPromise;
};

/**
 * Keep the GPS chip running for as long as an assessment screen is open, so a
 * fix is usually already in hand when a capture asks for one. A one-shot
 * request lets the chip power down between calls; offline, with no assisted-GPS
 * data, every such cold start needs 30-60s and the old 10s gate blocked every
 * photo (BUG-08895). Reference-counted: several screens may hold it at once.
 */
export const startLocationWarmup = async () => {
  warmupUsers += 1;
  await armWatch();
};

export const stopLocationWarmup = () => {
  warmupUsers = Math.max(0, warmupUsers - 1);
  if (warmupUsers === 0 && watchId != null) {
    Geolocation.clearWatch(watchId);
    watchId = null;
    Logger.info('Location warm-up stopped');
  }
};

/**
 * Fetch current coordinates. Never rejects — resolves null on failure.
 *
 * Order: a warm-up fix no older than `maximumAge` is returned at once. Otherwise
 * a high-accuracy (GPS) request and the warm-up watcher race for the next fix,
 * with a longer window offline (no assisted GPS, so a cold start is slow).
 * Online, a failed GPS attempt falls back to the network provider (coarse but
 * fast, e.g. indoors). Offline that provider has nothing to answer with, so the
 * fallbacks are the session's last GPS fix if it is recent enough, then the
 * device's own cached position (up to 5 minutes old) — which covers a fresh app
 * start on site where this session has no fix of its own yet.
 *
 * Only the GPS attempt surfaces the system "Enable Location Accuracy" dialog;
 * the fallbacks run with showLocationDialog:false so a user's "No Thanks"
 * sticks and the dialog appears at most once per call.
 */
export const getCurrentCoords = async ({ timeout, maximumAge = 10000 } = {}) => {
  if (lastFix && Date.now() - lastFix.at <= maximumAge) {
    return lastFix.coords;
  }
  // Device location switched off: every getCurrentPosition below can only burn
  // its timeout (offline: 45s) before failing, which is what leaves capture and
  // punch screens frozen on a spinner. Fail fast instead — fall back to the most
  // recent fix this session still holds, or null. The capture/punch gates raise
  // the "turn on location" alert before ever reaching here.
  if (!(await isLocationEnabled())) {
    if (lastFix && Date.now() - lastFix.at <= LOCATION_LAST_KNOWN_MAX_AGE_MS) {
      Logger.warn("Location services off — using this session's last GPS fix");
      return lastFix.coords;
    }
    Logger.warn('Location services off and no cached fix — cannot geotag');
    return null;
  }
  // A screen may have asked for the warm-up before the location permission was
  // granted (the grant happens in-context, on the first punch or capture). Arm
  // it here so every caller, punch-in included, benefits from then on.
  if (warmupUsers > 0 && watchId == null) {
    await armWatch();
  }
  const online = await checkInternetConnection();
  // Offline fast path: a fresh high-accuracy fix is a slow cold start with no
  // A-GPS / network assist, but the OS often still holds a recent position (an
  // earlier fix, or another app's). Take that at once and skip the wait; only a
  // device with nothing cached falls through to the slow acquisition below (a
  // short 2s probe, so the "nothing cached" penalty is tiny). The assessor is on
  // one site through the visit, so a few-minute-old fix is the same location.
  // Online keeps the fresh-fix path — its network assist is already fast.
  if (!online) {
    try {
      const cached = await positionOnce({
        showLocationDialog: false,
        forceRequestLocation: false,
        enableHighAccuracy: false,
        timeout: 2000,
        maximumAge: LOCATION_LAST_KNOWN_MAX_AGE_MS
      });
      recordFix(cached);
      return cached.coords;
    } catch (error) {
      Logger.info('No cached offline fix — acquiring a fresh one:', error?.message || error);
    }
  }
  const gpsTimeout = timeout ?? (online ? LOCATION_TIMEOUT_MS : LOCATION_TIMEOUT_OFFLINE_MS);
  const base = {
    timeout: gpsTimeout,
    maximumAge,
    showLocationDialog: true,
    forceRequestLocation: true
  };
  try {
    const attempts = [
      positionOnce({ ...base, enableHighAccuracy: true }).then((position) => {
        recordFix(position);
        return position.coords;
      })
    ];
    if (watchId != null) {
      attempts.push(waitForNextFix(gpsTimeout));
    }
    return await Promise.any(attempts);
  } catch (error) {
    const reason = error?.errors?.[0]?.message || error?.message || error;
    Logger.warn(
      `High-accuracy location failed after ${gpsTimeout}ms (${online ? 'online' : 'offline'}):`,
      reason
    );
  }
  if (online) {
    try {
      const position = await positionOnce({
        ...base,
        showLocationDialog: false,
        enableHighAccuracy: false,
        maximumAge: 60000
      });
      return position.coords;
    } catch (error) {
      Logger.warn('Network location failed, trying a cached fix:', error?.message || error);
    }
  }
  if (lastFix && Date.now() - lastFix.at <= LOCATION_LAST_KNOWN_MAX_AGE_MS) {
    Logger.warn(
      `No fresh fix — using this session's last GPS fix from ${Math.round(
        (Date.now() - lastFix.at) / 1000
      )}s ago`
    );
    return lastFix.coords;
  }
  // Last resort: the device's own cached position. A slightly stale coordinate
  // is far better than none for geo-verification evidence, and this returns at
  // once when the OS holds any recent fix rather than waiting on an acquisition
  // that offline cannot complete.
  try {
    const position = await positionOnce({
      ...base,
      showLocationDialog: false,
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: LOCATION_LAST_KNOWN_MAX_AGE_MS
    });
    return position.coords;
  } catch (error) {
    Logger.error('Location fetch failed (all attempts):', error?.message || error);
    return null;
  }
};

/**
 * Acquire a valid GPS fix for a capture, or block with a single message.
 * Geo-tagged photos are verification evidence, so a capture with no
 * coordinates must never proceed — this is the gate every capture screen
 * calls before opening the camera (or gallery). Returns the coords object, or
 * null when the capture should be blocked.
 *
 * Shows at most one alert per attempt: permission prompts come from
 * ensurePermission (denied/blocked), and a granted-but-no-fix (location
 * services off, or the enable dialog declined) shows one "Location Required".
 */
export const acquireCaptureCoords = async () => {
  const granted = await ensurePermission('location');
  if (!granted) {
    return null;
  }
  // Device toggle off? Bail out at once with an actionable "Enable Location"
  // alert rather than letting getCurrentCoords sit through its timeout.
  const servicesOn = await ensureLocationServicesEnabled(
    'Location is required to capture a photo. Please turn on Location to continue.'
  );
  if (!servicesOn) {
    return null;
  }
  // Reuse a warm fix up to a minute old so the camera opens at once when the
  // watcher already has one; only a genuinely stale/absent fix falls through to
  // a fresh (offline: slow) acquisition. Same site throughout the capture step,
  // so a fix this recent is the same location.
  const coords = await getCurrentCoords({ maximumAge: LOCATION_CAPTURE_MAX_AGE_MS });
  if (!coords) {
    Alert.alert(
      'Location Required',
      'We could not get a location fix, so this photo cannot be captured yet — photos must be ' +
        'geotagged. Check that location is switched on, move near a window or step outside if ' +
        'you can, then try again. With no network connection a first fix can take up to a ' +
        'minute; keep the assessment screen open so the GPS stays warm.'
    );
    return null;
  }
  return coords;
};
