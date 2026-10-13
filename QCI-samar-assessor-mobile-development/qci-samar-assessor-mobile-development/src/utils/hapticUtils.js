import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const DEFAULT_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false
};

export function triggerHaptic(type = 'impactLight') {
  try {
    ReactNativeHapticFeedback.trigger(type, DEFAULT_OPTIONS);
  } catch (_e) {
    // Haptics are best-effort; swallow on unsupported devices
  }
}

export const Haptic = {
  light: () => triggerHaptic('impactLight'),
  medium: () => triggerHaptic('impactMedium'),
  heavy: () => triggerHaptic('impactHeavy'),
  success: () => triggerHaptic('notificationSuccess'),
  warning: () => triggerHaptic('notificationWarning'),
  error: () => triggerHaptic('notificationError'),
  selection: () => triggerHaptic('selection')
};

export function getTabPressListener() {
  return undefined;
}
