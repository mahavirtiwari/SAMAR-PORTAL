/**
 * Lightweight no-op haptic helper.
 *
 * The assessor app wires this to react-native-haptic-feedback. Here it is a
 * UI-only stub so shared components (e.g. AppButton) keep the same API without
 * pulling in the native haptics dependency.
 */
export const Haptic = {
  light: () => undefined,
  medium: () => undefined,
  heavy: () => undefined,
  success: () => undefined,
  warning: () => undefined,
  error: () => undefined,
  selection: () => undefined,
};

export default Haptic;
