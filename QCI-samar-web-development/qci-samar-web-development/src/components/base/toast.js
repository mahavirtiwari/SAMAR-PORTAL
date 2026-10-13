import { useSyncExternalStore } from 'react';

const DEFAULT_DURATION = 3000;

const DEFAULT_TITLES = {
  error: 'Error',
  success: 'Success',
  warning: 'Warning',
  info: 'Info',
};

const DEFAULT_ANCHOR_ORIGIN = { vertical: 'bottom', horizontal: 'right' };

let state = {
  open: false,
  variant: 'info',
  title: '',
  message: '',
  duration: DEFAULT_DURATION,
  anchorOrigin: DEFAULT_ANCHOR_ORIGIN,
  key: 0,
};

const listeners = new Set();

const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => state;

const setState = next => {
  state = { ...state, ...next };
  listeners.forEach(fn => fn());
};

const show = (variant, message, options = {}) => {
  setState({
    open: true,
    variant,
    message: message ?? '',
    title: options.title ?? DEFAULT_TITLES[variant],
    duration: options.duration ?? DEFAULT_DURATION,
    // Callers whose action buttons sit at the default bottom-right anchor (e.g. a
    // full-height right-edge panel) can pass their own anchorOrigin so the toast
    // doesn't land on top of them.
    anchorOrigin: options.anchorOrigin ?? DEFAULT_ANCHOR_ORIGIN,
    key: state.key + 1,
  });
};

export const toastError = (message, options) => show('error', message, options);
export const toastSuccess = (message, options) => show('success', message, options);
export const toastWarning = (message, options) => show('warning', message, options);
export const toastInfo = (message, options) => show('info', message, options);
export const toastDismiss = () => setState({ open: false });

export const useToast = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
