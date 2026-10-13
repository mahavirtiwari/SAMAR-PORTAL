import { Alert, Linking, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Geolocation from 'react-native-geolocation-service';
import { LOCATION_TIMEOUT_MS } from '../constants/Config';
import { Logger } from './logger';
import { ensurePermission, waitForReturnFromSettings } from './permissions';

const positionOnce = options =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, options);
  });

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
 * burns its timeout (the "stuck on loading" report with location off). When the
 * user returns from settings the toggle is re-read, so enabling it there lets
 * the same attempt resolve true.
 */
export const ensureLocationServicesEnabled = async (
  message = 'Location is required to continue. Please turn on Location to proceed.',
) => {
  if (await isLocationEnabled()) {
    return true;
  }
  return new Promise(resolve => {
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
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
};

/**
 * Fetch current coordinates. Never rejects — resolves null on failure.
 * Tries a high-accuracy (GPS) fix first, then falls back to a network
 * fix: the GPS cold start right after a fresh permission grant, or
 * indoors, routinely exceeds the timeout while the network provider
 * still returns a usable coarse fix.
 *
 * Only the first (GPS) attempt surfaces the system "Enable Location Accuracy"
 * dialog; the network fallback runs with showLocationDialog:false so a user's
 * "No Thanks" sticks and the dialog appears at most once per call.
 */
export const getCurrentCoords = async ({
  timeout = LOCATION_TIMEOUT_MS,
  maximumAge = 10000,
} = {}) => {
  // Device location switched off: every getCurrentPosition below can only burn
  // its timeout before failing, which is what leaves the capture screen frozen
  // on a spinner. Fail fast — the capture gate raises the actionable "turn on
  // location" alert before ever reaching here.
  if (!(await isLocationEnabled())) {
    Logger.warn('Location services off — cannot geotag');
    return null;
  }
  // 1) High-accuracy (GPS) fix — the only attempt allowed to show the enable
  // dialog.
  try {
    const position = await positionOnce({
      showLocationDialog: true,
      forceRequestLocation: true,
      enableHighAccuracy: true,
      timeout,
      maximumAge,
    });
    return position.coords;
  } catch (error) {
    Logger.warn(
      'High-accuracy location failed, falling back to network fix:',
      error?.message || error,
    );
  }
  // 2) Network (coarse) fix — a cold GPS start (right after a fresh grant, or
  // indoors) routinely exceeds the high-accuracy timeout, so give the coarse
  // provider more time AND accept a cached fix up to 5 min old. Never re-show
  // the enable dialog here: if the user already declined it on attempt 1,
  // re-prompting is the repeating-popup bug.
  try {
    const position = await positionOnce({
      showLocationDialog: false,
      forceRequestLocation: true,
      enableHighAccuracy: false,
      timeout: timeout + 5000,
      maximumAge: 300000,
    });
    return position.coords;
  } catch (error) {
    Logger.error('Location fetch failed:', error?.message || error);
    return null;
  }
};

/**
 * Acquire a valid GPS fix for a photo capture, or block with a single message.
 * Site photos are geo-verification evidence, so a capture with no coordinates
 * must never proceed. Returns the coords object, or null when the capture
 * should be blocked.
 *
 * Shows at most one alert per attempt: the permission prompts come from
 * ensurePermission (denied/blocked), and a granted-but-no-fix (location
 * services off, or the enable dialog declined) shows one "Location Required".
 */
export const acquireCaptureCoords = async () => {
  const granted = await ensurePermission('location');
  if (!granted) {
    return null;
  }
  // Device toggle off? Bail out at once with an actionable "Enable Location"
  // alert rather than letting getCurrentCoords sit through its timeout on a
  // spinner. Tapping Enable Location opens the system location settings and the
  // toggle is re-read on return, so the same attempt can proceed once it's on.
  const servicesOn = await ensureLocationServicesEnabled(
    'Location is required to capture a photo. Please turn on Location to continue.',
  );
  if (!servicesOn) {
    return null;
  }
  const coords = await getCurrentCoords();
  if (!coords) {
    Alert.alert(
      'Location Required',
      'Turn on location to capture a site photo. Site photos must be geotagged, so capture is blocked until a location fix is available.',
    );
    return null;
  }
  return coords;
};
