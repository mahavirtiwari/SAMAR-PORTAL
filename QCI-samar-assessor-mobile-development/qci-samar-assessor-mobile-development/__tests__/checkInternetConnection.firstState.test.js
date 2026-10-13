/**
 * Locks the cold-start contract of checkInternetConnection: a call made before
 * NetInfo's first event waits for that event (bounded) instead of answering
 * "online" blindly, so an offline launch refuses its first requests at once.
 */

let listener = null;

jest.mock('@react-native-community/netinfo', () => ({
  configure: jest.fn(),
  addEventListener: jest.fn((cb) => {
    listener = cb;
    return () => {
      listener = null;
    };
  }),
  fetch: jest.fn()
}));
jest.mock('../appsettings', () => ({ BASE_URL: 'https://example.test/api/v1/' }));
jest.mock('../src/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const load = () => {
  let mod;
  jest.isolateModules(() => {
    mod = require('../src/utils/checkInternetConnection');
  });
  return mod;
};

describe('checkInternetConnection before the first NetInfo event', () => {
  beforeEach(() => {
    listener = null;
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('answers offline as soon as the first event says disconnected', async () => {
    const { checkInternetConnection } = load();
    const pending = checkInternetConnection();
    expect(listener).toBeInstanceOf(Function);
    listener({ isConnected: false, isInternetReachable: false });
    await expect(pending).resolves.toBe(false);
  });

  it('answers online as soon as the first event says connected', async () => {
    const { checkInternetConnection } = load();
    const pending = checkInternetConnection();
    listener({ isConnected: true, isInternetReachable: null });
    await expect(pending).resolves.toBe(true);
  });

  it('falls back to optimistic online when no event arrives within the bound', async () => {
    const { checkInternetConnection } = load();
    const pending = checkInternetConnection();
    jest.advanceTimersByTime(1500);
    await expect(pending).resolves.toBe(true);
  });

  it('does not wait once a state is known', async () => {
    const { checkInternetConnection } = load();
    const first = checkInternetConnection();
    listener({ isConnected: false, isInternetReachable: false });
    await first;
    await expect(checkInternetConnection()).resolves.toBe(false);
  });
});
