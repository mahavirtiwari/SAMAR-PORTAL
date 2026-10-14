/**
 * Locks the outbox drain's server-trouble handling: a 429 pauses drains for
 * Retry-After (default 30s, cap 5 min); consecutive 5xx / timeouts trip a
 * circuit breaker with exponential backoff; a 5xx never burns the retry cap, so
 * a server outage cannot permanently retire good photos.
 */

const mockOutbox = [];
const mockRow = id => mockOutbox.find(r => r.id === id);

jest.mock('../src/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../src/services/database/migrations/runner', () => ({
  migrationsReady: Promise.resolve(),
}));
jest.mock('../src/services/offline/photoStorage', () => ({
  isUploadableFile: jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/services/offline/sitePictureCache', () => ({
  cacheLocalCapture: jest.fn(),
}));
jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    SiteApi: {
      addSitePicture: jest.fn(),
      addSiteTourPicture: jest.fn(),
      deleteSitePicture: jest.fn(),
      deleteSiteTourPicture: jest.fn(),
    },
  },
}));
jest.mock('../src/services/database/repositories/outboxRepo', () => ({
  MAX_RETRIES: 5,
  peekPending: jest.fn(async () =>
    mockOutbox.filter(
      r => ['pending', 'failed', 'syncing'].includes(r.status) && r.retry_count < 5,
    ),
  ),
  markSyncing: jest.fn(async id => {
    mockRow(id).status = 'syncing';
  }),
  markSynced: jest.fn(async id => {
    mockRow(id).status = 'synced';
  }),
  markFailed: jest.fn(async (id, message, { terminal = false, countRetry = true } = {}) => {
    const r = mockRow(id);
    r.status = 'failed';
    r.last_error = message;
    r.retry_count = terminal ? 5 : countRetry ? r.retry_count + 1 : r.retry_count;
  }),
}));

const Api = require('../src/services/api').default;
const {
  drainOutbox,
  resetSyncThrottle,
  serverOutageBackoffMs,
} = require('../src/services/offline/syncEngine');

const httpError = (status, headers = {}) => {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, headers, data: { message: 'Server Error' } };
  return error;
};

const queue = id => {
  mockOutbox.push({
    id,
    op_type: 'sitePicture',
    assessment_id: 7,
    payload: {
      serverAssessmentId: 7,
      type: 'exterior',
      filePath: `/p/${id}.jpg`,
      localId: `l${id}`,
    },
    status: 'pending',
    retry_count: 0,
  });
};

beforeEach(() => {
  mockOutbox.length = 0;
  jest.clearAllMocks();
  resetSyncThrottle();
});

test('a 429 stops the drain and pauses later drains for Retry-After', async () => {
  Api.SiteApi.addSitePicture.mockRejectedValue(httpError(429, { 'retry-after': '20' }));
  [1, 2, 3].forEach(queue);

  const before = Date.now();
  const result = await drainOutbox();

  expect(Api.SiteApi.addSitePicture).toHaveBeenCalledTimes(1);
  expect(result.aborted).toBe(true);
  expect(result.abortReason).toBe('rateLimited');
  expect(result.pausedUntil - before).toBeGreaterThanOrEqual(20000);
  expect(mockRow(1).retry_count).toBe(0);

  Api.SiteApi.addSitePicture.mockClear();
  const again = await drainOutbox();
  expect(again.abortReason).toBe('rateLimited');
  expect(Api.SiteApi.addSitePicture).not.toHaveBeenCalled();
});

test('a 429 without Retry-After pauses 30s; a huge one is capped at 5 minutes', async () => {
  Api.SiteApi.addSitePicture.mockRejectedValueOnce(httpError(429));
  queue(1);
  let before = Date.now();
  let result = await drainOutbox();
  expect(result.pausedUntil - before).toBeGreaterThanOrEqual(30000);
  expect(result.pausedUntil - before).toBeLessThan(31000);

  resetSyncThrottle();
  Api.SiteApi.addSitePicture.mockRejectedValueOnce(httpError(429, { 'retry-after': '86400' }));
  before = Date.now();
  result = await drainOutbox();
  expect(result.pausedUntil - before).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);
});

test('two consecutive 5xx trip the breaker without counting toward retries', async () => {
  Api.SiteApi.addSitePicture.mockRejectedValue(httpError(503));
  [1, 2, 3, 4].forEach(queue);

  const result = await drainOutbox();

  expect(Api.SiteApi.addSitePicture).toHaveBeenCalledTimes(2);
  expect(result.abortReason).toBe('serverUnavailable');
  expect(result.pausedUntil).toBeGreaterThan(Date.now());
  expect(mockRow(1).retry_count).toBe(0);
  expect(mockRow(2).retry_count).toBe(0);
  expect(mockRow(3).status).toBe('pending');
});

test('repeated outage drains never retire a row', async () => {
  Api.SiteApi.addSitePicture.mockRejectedValue(httpError(500));
  queue(1);
  for (let i = 0; i < 10; i++) {
    resetSyncThrottle();
    await drainOutbox();
  }
  expect(mockRow(1).retry_count).toBe(0);
  expect(mockRow(1).status).toBe('failed');
});

test('a synced row resets the consecutive count', async () => {
  Api.SiteApi.addSitePicture
    .mockRejectedValueOnce(httpError(500))
    .mockResolvedValueOnce({ data: {} })
    .mockRejectedValueOnce(httpError(500))
    .mockResolvedValueOnce({ data: {} });
  [1, 2, 3, 4].forEach(queue);

  const result = await drainOutbox();

  expect(result.aborted).toBe(false);
  expect(result.succeeded).toBe(2);
});

test('timeouts count toward the breaker; a 4xx still counts a retry', async () => {
  const timeout = new Error('timeout of 120000ms exceeded');
  timeout.code = 'ECONNABORTED';
  Api.SiteApi.addSitePicture.mockRejectedValue(timeout);
  [1, 2, 3].forEach(queue);
  expect((await drainOutbox()).abortReason).toBe('serverUnavailable');

  resetSyncThrottle();
  mockOutbox.length = 0;
  Api.SiteApi.addSitePicture.mockReset();
  Api.SiteApi.addSitePicture.mockRejectedValue(httpError(403));
  queue(9);
  await drainOutbox();
  expect(mockRow(9).retry_count).toBe(1);
});

test('backoff doubles from 15s, caps at 10 min, honours Retry-After on 503', () => {
  const noJitter = () => 0;
  expect(serverOutageBackoffMs(2, null, noJitter)).toBe(30000);
  expect(serverOutageBackoffMs(4, null, noJitter)).toBe(120000);
  expect(serverOutageBackoffMs(30, null, noJitter)).toBe(600000);
  expect(serverOutageBackoffMs(2, null, () => 0.5)).toBe(37500);
  expect(serverOutageBackoffMs(2, httpError(503, { 'retry-after': '300' }), noJitter)).toBe(300000);
});
