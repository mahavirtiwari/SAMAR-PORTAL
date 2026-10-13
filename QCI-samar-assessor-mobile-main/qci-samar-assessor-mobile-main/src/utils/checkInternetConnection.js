import NetInfo from '@react-native-community/netinfo';
import AppSettings from '../../appsettings';
import { Logger } from './logger';

// The public health endpoint sits beside the versioned api, not inside it:
// BASE_URL ends ".../api/v1/", the health check is ".../api/health". Derived rather
// than hard-coded so it follows BASE_URL across environments. [BUG-08861]
const REACHABILITY_URL = `${AppSettings.BASE_URL.replace(/v1\/?$/, '')}health`;

// NetInfo's `isInternetReachable` is tri-state: true | false | null. It is
// `null` until the reachability probe completes — which recurs on app start,
// after any network change, on foreground, and persists on some
// corporate/Android networks. Requiring it to be strictly `true` made the app
// report OFFLINE while it actually had internet, so writes (e.g. response
// evidence) were skipped and queued but never flushed. Treat the connection as
// usable unless connectivity is EXPLICITLY false: only `isConnected === false`
// or `isInternetReachable === false` count as offline; `null` (unknown) is
// optimistically online and the real request succeeds or fails on its own.
const isUsableConnection = (state) =>
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
// Callers that asked before the first NetInfo event arrived. NetInfo replays the
// current state to a new listener almost immediately, so the wait is normally a
// few milliseconds; the bound only matters if the native module is slow to answer.
const FIRST_STATE_WAIT_MS = 1500;
let firstStateWaiters = [];
// Screen/hook callbacks fed by the ONE native listener below. Each subscriber
// used to register its own NetInfo listener, so a single network change fired
// once per mounted screen (8× measured) and each one re-ran the reconnect sync.
const subscribers = new Set();

const onNativeChange = (state) => {
  const wasConnected = latestState === null ? null : isUsableConnection(latestState);
  latestState = state;
  if (firstStateWaiters.length > 0) {
    const waiters = firstStateWaiters;
    firstStateWaiters = [];
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
  }
  const isConnected = isUsableConnection(state);
  // NetInfo emits several events per transition (connecting, validated, ...);
  // only the usable/unusable flip is worth a line.
  if (isConnected !== wasConnected) {
    Logger.info('Network state changed:', isConnected);
  }
  for (const callback of subscribers) {
    try {
      callback(isConnected);
    } catch (error) {
      Logger.warn('Network change subscriber threw:', error?.message || error);
    }
  }
};

/**
 * Start the single app-wide NetInfo listener that keeps connectivity state
 * fresh. Call once at app launch (before any auth request can fire). Idempotent.
 * @returns {Function} Unsubscribe function.
 */
export const initConnectivity = () => {
  if (unsubscribeConnectivity) {
    return unsubscribeConnectivity;
  }

  // Judge connectivity against OUR api, not the library's default probe, which is a
  // Google address. On a locked-down factory or defence-site network that reaches our
  // server but blocks Google, the default probe answers "no internet", every request is
  // refused before it is attempted, and the app sits in offline mode until the network
  // changes. Asking the server we actually need makes an explicit false mean what the
  // app treats it as meaning. [BUG-08861]
  //
  // Configured before the listener is added, since NetInfo applies configuration to
  // subsequently created listeners.
  NetInfo.configure({
    reachabilityUrl: REACHABILITY_URL,
    // A reachability probe answers "did we reach our server", not "is /api/health
    // returning 200". Any HTTP response proves the server was reached — including a
    // 400/405 when the endpoint rejects NetInfo's default HEAD probe. Requiring
    // exactly 200 marked the device OFFLINE whenever /api/health answered non-200
    // (staging returns 400 to HEAD), and publicClient then skipped login entirely
    // with no network error — login worked on one platform only by probe-timing
    // luck. A genuine network failure never reaches this test: the fetch rejects
    // and NetInfo marks the device unreachable on its own. [BUG-08861]
    reachabilityTest: async (response) => response.status >= 200 && response.status < 600,
    reachabilityMethod: 'GET',
    // Unauthenticated and cheap, so a site network that is merely slow is not called
    // offline; the app stays usable while the request itself decides.
    reachabilityRequestTimeout: 15 * 1000,
    reachabilityLongTimeout: 60 * 1000,
    reachabilityShortTimeout: 5 * 1000
  });

  unsubscribeConnectivity = NetInfo.addEventListener(onNativeChange);
  return unsubscribeConnectivity;
};

const waitForFirstState = () =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      firstStateWaiters = firstStateWaiters.filter((waiter) => waiter.resolve !== resolve);
      resolve();
    }, FIRST_STATE_WAIT_MS);
    firstStateWaiters.push({ resolve, timer });
  });

/**
 * Check if device is connected to the internet.
 * Reads the listener-maintained state. A call made before the first event has
 * arrived (cold start) waits, bounded, for that event: the first requests after
 * launch used to run in that window and, offline, waited out the whole request
 * timeout before the local fallback ran. If no event arrives within the bound it
 * is optimistically online and the real request succeeds or fails on its own.
 * @returns {Promise<boolean>} Returns true if connected, false otherwise
 */
export const checkInternetConnection = async () => {
  if (latestState === null) {
    initConnectivity();
    await waitForFirstState();
  }
  if (latestState !== null) {
    return isUsableConnection(latestState);
  }
  return true;
};

/**
 * Stricter connectivity check for TEARDOWN decisions (forced logout, token
 * refresh at cold start). Unlike checkInternetConnection, unknown connectivity
 * (latestState still null before NetInfo's first event) counts as NOT online.
 *
 * The asymmetry is deliberate: attempting a request while maybe-online is safe
 * (it fails gracefully and the caller falls back to local), but tearing down a
 * session while maybe-online is destructive — a cold start offline would refresh,
 * fail, and force a logout with the "unsynced items" alert over the Login screen.
 * Logout must require CERTAINTY of connectivity; requests stay optimistic.
 * @returns {boolean} true only when connectivity is known and usable.
 */
export const isConfirmedOnline = () => latestState !== null && isUsableConnection(latestState);

/**
 * Subscribe to network state changes
 * @param {Function} callback - Callback function that receives connection status (boolean)
 * @returns {Function} Unsubscribe function
 */
export const subscribeToNetworkChanges = (callback) => {
  initConnectivity();
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
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
      details: state.details
    };
  } catch (error) {
    Logger.error('Error getting network info:', error);
    return {
      isConnected: false,
      isInternetReachable: false,
      type: 'unknown',
      details: null
    };
  }
};

export default {
  initConnectivity,
  checkInternetConnection,
  isConfirmedOnline,
  subscribeToNetworkChanges,
  getNetworkInfo
};
