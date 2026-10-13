import { Alert, AppState, Linking, Platform } from 'react-native';
import { check, openSettings, PERMISSIONS, RESULTS, request } from 'react-native-permissions';
import { Logger } from './logger';

const mapRNPermissionResult = (result) => {
  switch (result) {
    case RESULTS.GRANTED:
    case RESULTS.LIMITED:
      return 'granted';
    case RESULTS.DENIED:
      return 'denied';
    case RESULTS.BLOCKED:
      return 'blocked';
    case RESULTS.UNAVAILABLE:
      return 'unavailable';
    default:
      return 'denied';
  }
};

const CAMERA_PERMISSION =
  Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;
const LOCATION_PERMISSION =
  Platform.OS === 'ios'
    ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
    : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

const requestRNPermission = async (permission, name) => {
  try {
    const current = await check(permission);
    if (current === RESULTS.GRANTED || current === RESULTS.LIMITED) {
      return RESULTS.GRANTED;
    }
    const result = await request(permission);
    return result;
  } catch (error) {
    Logger.error(`Error requesting ${name} permission:`, error);
    return RESULTS.DENIED;
  }
};

// Camera permission request function
export const requestCameraPermission = async () => {
  const result = await requestRNPermission(CAMERA_PERMISSION, 'Camera');
  const status = mapRNPermissionResult(result);
  Logger.info(`Camera permission: ${status}`);
  return status;
};

// Location permission request function
export const requestLocationPermission = async () => {
  const result = await requestRNPermission(LOCATION_PERMISSION, 'Location');
  const status = mapRNPermissionResult(result);
  Logger.info(`Location permission: ${status}`);
  return status;
};

const PERMISSION_REQUESTERS = {
  camera: { request: requestCameraPermission, label: 'Camera' },
  location: { request: requestLocationPermission, label: 'Location' }
};

const PERMISSION_RATIONALES = {
  camera: 'Camera access is needed to capture assessment photos.',
  location: 'Location access is needed to geotag assessment data.'
};

export const waitForReturnFromSettings = () =>
  new Promise((resolve) => {
    let wentBackground = false;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        wentBackground = true;
      } else if (state === 'active' && wentBackground) {
        subscription.remove();
        resolve();
      }
    });
  });

/**
 * Ensure a permission is granted, re-prompting if denied and guiding to
 * Settings if blocked. Returns a boolean — true only if granted. When the
 * user goes to Settings, resolution waits for their return and reflects
 * the grant made there.
 * @param {'camera'|'location'} type
 */
export const ensurePermission = async (type) => {
  const entry = PERMISSION_REQUESTERS[type];
  if (!entry) {
    Logger.error(`ensurePermission called with unknown type: ${type}`);
    return false;
  }
  const status = await entry.request();
  if (status === 'granted') {
    return true;
  }

  return new Promise((resolve) => {
    if (status === 'blocked') {
      Alert.alert(
        `${entry.label} Permission Required`,
        `${PERMISSION_RATIONALES[type]} Please enable it in app settings.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Open Settings',
            onPress: () => {
              // Re-check once the user returns so a grant made in Settings
              // resumes the calling flow. Android keeps the process alive
              // across this round-trip; iOS kills it on a permission change,
              // so the pending promise is moot there.
              waitForReturnFromSettings().then(async () => {
                const after = await entry.request();
                resolve(after === 'granted');
              });
              Linking.openSettings();
            }
          }
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    } else {
      Alert.alert(
        `${entry.label} Permission Denied`,
        PERMISSION_RATIONALES[type],
        [{ text: 'OK', onPress: () => resolve(false) }],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    }
  });
};

/** Ensure all required permissions. Returns boolean. */
export const ensureAllPermissions = async () => {
  const camera = await ensurePermission('camera');
  if (!camera) {
    return false;
  }
  const location = await ensurePermission('location');
  return location;
};

// Backwards-compatible alias for older callers
export const checkAndRequestLocationPermission = () => ensurePermission('location');

// Check if all required permissions are granted
export const checkAllPermissions = async () => {
  try {
    const cameraStatus = await requestCameraPermission();
    const locationStatus = await requestLocationPermission();

    Logger.info('All permissions status:', {
      camera: cameraStatus,
      location: locationStatus
    });

    return {
      camera: cameraStatus,
      location: locationStatus,
      allGranted: cameraStatus === 'granted' && locationStatus === 'granted'
    };
  } catch (error) {
    Logger.error('Error checking all permissions:', error);
    return {
      camera: 'denied',
      location: 'denied',
      allGranted: false
    };
  }
};

// Passive status read via check() only — never prompts. Use on foreground
// return so a grant made in device Settings is reflected without re-firing
// the system dialog.
export const checkAppPermissions = async () => {
  try {
    const camera = mapRNPermissionResult(await check(CAMERA_PERMISSION));
    const location = mapRNPermissionResult(await check(LOCATION_PERMISSION));
    return {
      allGranted: camera === 'granted' && location === 'granted',
      permissions: { camera, location }
    };
  } catch (error) {
    Logger.error('Error checking app permissions:', error);
    return {
      allGranted: false,
      permissions: { camera: 'denied', location: 'denied' }
    };
  }
};

// Request all app permissions on startup
export const requestAppPermissionsOnStartup = async () => {
  try {
    Logger.info('🚀 Requesting app permissions on startup...');

    // Request permissions sequentially to avoid overwhelming the user
    const cameraStatus = await requestCameraPermission();
    const locationStatus = await requestLocationPermission();

    const allGranted = cameraStatus === 'granted' && locationStatus === 'granted';

    Logger.info('✅ Startup permissions result:', {
      camera: cameraStatus,
      location: locationStatus,
      allGranted
    });

    return {
      allGranted,
      permissions: {
        camera: cameraStatus,
        location: locationStatus
      }
    };
  } catch (error) {
    Logger.error('❌ Error requesting app permissions on startup:', error);
    return {
      allGranted: false,
      permissions: {
        camera: 'denied',
        location: 'denied'
      }
    };
  }
};

// Open the app's settings page for permission management. Routes through
// react-native-permissions' native openSettings (reliable across OEM ROMs
// where core Linking.openSettings can silently no-op), falling back to
// Linking only if that rejects.
export const openAppSettings = async () => {
  Logger.info('Opening app settings for permissions');
  try {
    await openSettings('application');
  } catch (error) {
    Logger.warn('openSettings failed, falling back to Linking:', error?.message || error);
    try {
      await Linking.openSettings();
    } catch (linkingError) {
      Logger.error('Error opening app settings:', linkingError);
      Alert.alert(
        'Settings Error',
        'Unable to open settings. Please manually enable permissions in your device settings.'
      );
    }
  }
};

// Helper function to get user-friendly permission status message
export const getPermissionStatusMessage = (status) => {
  switch (status) {
    case 'granted':
      return 'Permission granted';
    case 'denied':
      return 'Permission denied. Please allow access to continue.';
    case 'blocked':
      return 'Permission permanently denied. Please enable in settings.';
    case 'unavailable':
      return 'Feature not available on this device.';
    default:
      return 'Unknown permission status';
  }
};
