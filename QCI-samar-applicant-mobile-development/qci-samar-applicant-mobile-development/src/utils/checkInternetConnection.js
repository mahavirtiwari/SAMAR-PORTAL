import NetInfo from '@react-native-community/netinfo';
import { Logger } from './logger';

// NetInfo's `isInternetReachable` is tri-state: true | false | null. It is
// `null` until the reachability probe completes — which recurs on app start,
// after any network change, on foreground, and persists on some
// corporate/Android networks. Requiring it to be strictly `true` made the app
// report OFFLINE while it actually had internet, so requests were skipped.
// Treat the connection as usable unless connectivity is EXPLICITLY false: only
// `isConnected === false` or `isInternetReachable === false` count as offline;
// `null` (unknown) is optimistically online and the real request succeeds or
// fails on its own.
const isUsableConnection = state =>
  state?.isConnected !== false && state?.isInternetReachable !== false;

// Latest state pushed by the NetInfo listener. Stays `null` until the first
// event arrives. A bare `NetInfo.fetch()` is unreliable on a cold start (fresh
// install): before any listener has run the native module isn't initialised, so
// the first fetch resolves with a default/stale `isConnected: false` and falsely
// reported the device offline — which silently failed the very first login. The
// listener pattern (started once at app launch via initConnectivity) keeps this
// value correct; the gate reads it instead of fetching per request.
let latestState = null;
let unsubscribeConnectivity = null;

/**
 * Start the single app-wide NetInfo listener that keeps connectivity state
 * fresh. Call once at app launch (before any auth request can fire). Idempotent.
 * @returns {Function} Unsubscribe function.
 */
export const initConnectivity = () => {
  if (unsubscribeConnectivity) {
    return unsubscribeConnectivity;
  }
  unsubscribeConnectivity = NetInfo.addEventListener(state => {
    latestState = state;
    Logger.info('Network state changed:', isUsableConnection(state));
  });
  return unsubscribeConnectivity;
};

/**
 * Check if device is connected to the internet.
 * Reads the listener-maintained state. Until the first event has arrived
 * (cold start) it is optimistically online — the real request then succeeds or
 * fails on its own rather than being pre-emptively skipped.
 * @returns {Promise<boolean>} Returns true if connected, false otherwise
 */
export const checkInternetConnection = async () => {
  if (latestState !== null) {
    return isUsableConnection(latestState);
  }
  return true;
};

/**
 * Subscribe to network state changes
 * @param {Function} callback - Callback function that receives connection status (boolean)
 * @returns {Function} Unsubscribe function
 */
export const subscribeToNetworkChanges = callback => {
  const unsubscribe = NetInfo.addEventListener(state => {
    latestState = state;
    const isConnected = isUsableConnection(state);
    Logger.info('Network state changed:', isConnected);
    callback(isConnected);
  });

  return unsubscribe;
};

/**
 * Get detailed network information
 * @returns {Promise<Object>} Returns network state details
 */
export const getNetworkInfo = async () => {
  try {
    const state = await NetInfo.fetch();
    Logger.info('Network info:', state);
    return {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      details: state.details,
    };
  } catch (error) {
    Logger.error('Error getting network info:', error);
    return {
      isConnected: false,
      isInternetReachable: false,
      type: 'unknown',
      details: null,
    };
  }
};

export default {
  initConnectivity,
  checkInternetConnection,
  subscribeToNetworkChanges,
  getNetworkInfo,
};
