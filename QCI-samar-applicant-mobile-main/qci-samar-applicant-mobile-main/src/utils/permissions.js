import { Alert, AppState, Linking, Platform } from 'react-native';
import { check, PERMISSIONS, RESULTS, request } from 'react-native-permissions';
import { Logger } from './logger';

// Resolves once the app returns to the foreground after being sent to the
// background — used to re-check a setting the user went to the system Settings
// screen to change (e.g. the Location master toggle), so the same attempt can
// reflect the change on their return instead of failing.
export const waitForReturnFromSettings = () =>
  new Promise(resolve => {
    let wentBackground = false;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') {
        wentBackground = true;
      } else if (state === 'active' && wentBackground) {
        subscription.remove();
        resolve();
      }
    });
  });

const CAMERA_PERMISSION =
  Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;
const LOCATION_PERMISSION =
  Platform.OS === 'ios'
    ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
    : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

const mapRNPermissionResult = result => {
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

const requestRNPermission = async (permission, name) => {
  try {
    const current = await check(permission);
    if (current === RESULTS.GRANTED || current === RESULTS.LIMITED) {
      return RESULTS.GRANTED;
    }
    return await request(permission);
  } catch (error) {
    Logger.error(`Error requesting ${name} permission:`, error);
    return RESULTS.DENIED;
  }
};

// Camera permission request
export const requestCameraPermission = async () => {
  const result = await requestRNPermission(CAMERA_PERMISSION, 'Camera');
  const status = mapRNPermissionResult(result);
  Logger.info(`Camera permission: ${status}`);
  return status;
};

// Location permission request
export const requestLocationPermission = async () => {
  const result = await requestRNPermission(LOCATION_PERMISSION, 'Location');
  const status = mapRNPermissionResult(result);
  Logger.info(`Location permission: ${status}`);
  return status;
};

// Photo library / storage permission for picking site images
export const requestStoragePermission = async () => {
  let permission;
  if (Platform.OS === 'ios') {
    permission = PERMISSIONS.IOS.PHOTO_LIBRARY;
  } else if (Platform.Version >= 33) {
    permission = PERMISSIONS.ANDROID.READ_MEDIA_IMAGES;
  } else {
    permission = PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
  }
  const result = await requestRNPermission(permission, 'Storage');
  const status = mapRNPermissionResult(result);
  Logger.info(`Storage permission: ${status}`);
  return status;
};

const PERMISSION_REQUESTERS = {
  camera: { request: requestCameraPermission, label: 'Camera' },
  location: { request: requestLocationPermission, label: 'Location' },
  storage: { request: requestStoragePermission, label: 'Storage' },
};

const PERMISSION_RATIONALES = {
  camera: 'Camera access is needed to capture site photos.',
  location: 'Location access is needed to geotag site photos.',
  storage: 'Photo library access is needed to attach site images.',
};

/**
 * Ensure a permission is granted, re-prompting if denied and guiding to
 * Settings if blocked. Returns a boolean — true only if granted.
 * @param {'camera'|'location'|'storage'} type
 */
export const ensurePermission = async type => {
  const entry = PERMISSION_REQUESTERS[type];
  if (!entry) {
    Logger.error(`ensurePermission called with unknown type: ${type}`);
    return false;
  }
  const status = await entry.request();
  if (status === 'granted') {
    return true;
  }

  return new Promise(resolve => {
    if (status === 'blocked') {
      Alert.alert(
        `${entry.label} Permission Required`,
        `${PERMISSION_RATIONALES[type]} Please enable it in app settings.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Open Settings',
            onPress: () => {
              Linking.openSettings();
              resolve(false);
            },
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    } else {
      Alert.alert(
        `${entry.label} Permission Denied`,
        PERMISSION_RATIONALES[type],
        [{ text: 'OK', onPress: () => resolve(false) }],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    }
  });
};

// Backwards-compatible alias used by capture flows
export const checkAndRequestLocationPermission = () => ensurePermission('location');

// Read current camera + location status WITHOUT requesting. Used to refresh the
// UI when the app returns to the foreground: a user who was blocked may have
// granted the permission in device settings, and re-requesting on resume would
// wrongly re-pop the system dialog for a merely-denied (not blocked) permission.
export const checkAppPermissionsStatus = async () => {
  const readStatus = async (permission, name) => {
    try {
      return mapRNPermissionResult(await check(permission));
    } catch (error) {
      Logger.error(`Error checking ${name} permission:`, error);
      return 'denied';
    }
  };
  const permissions = {
    camera: await readStatus(CAMERA_PERMISSION, 'Camera'),
    location: await readStatus(LOCATION_PERMISSION, 'Location'),
  };

  return {
    allGranted: Object.values(permissions).every(status => status === 'granted'),
    permissions,
  };
};

export const requestAppPermissionsOnStartup = async () => {
  const permissions = {
    camera: await requestCameraPermission(),
    location: await requestLocationPermission(),
  };

  return {
    allGranted: Object.values(permissions).every(status => status === 'granted'),
    permissions,
  };
};

// Open device settings for permission management
export const openAppSettings = () => {
  try {
    Linking.openSettings();
  } catch (error) {
    Logger.error('Error opening app settings:', error);
    Alert.alert(
      'Settings Error',
      'Unable to open settings. Please manually enable permissions in your device settings.',
    );
  }
};
