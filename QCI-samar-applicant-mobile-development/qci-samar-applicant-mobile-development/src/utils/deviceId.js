import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateUuid } from './stringUtils';

const DEVICE_ID_KEY = 'deviceInstallId';

/**
 * Stable per-install device id. The backend binds a session to this id, so
 * re-authenticating from the same install is never treated as a "new device"
 * that terminates the existing session. Generated once, persisted, and returned
 * unchanged on every subsequent launch.
 */
export const getDeviceId = async () => {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const deviceId = generateUuid();
  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
};
