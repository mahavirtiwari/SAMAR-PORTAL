/**
 * Locks the sync circuit breaker: consecutive 5xx / timeouts stop the drain and
 * pause every non-forced trigger with exponential backoff + jitter, a 5xx never
 * burns the retry cap (an outage must not retire good rows), and any synced row
 * resets the count.
 */

const mockOutbox = [];
const mockRow = (id) => mockOutbox.find((r) => r.id === id);

jest.mock('../src/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock('../src/utils/checkInternetConnection', () => ({
  checkInternetConnection: jest.fn().mockResolvedValue(true)
}));
jest.mock('../src/services/storage/authStore', () => ({
  getToken: jest.fn().mockResolvedValue({ token: 'access' })
}));
jest.mock('../src/services/database/migrations/runner', () => ({
  migrationsReady: Promise.resolve()
}));
jest.mock('../src/services/database/ids', () => ({
  idFromServer: (serverId) => `srv-${serverId}`
}));
jest.mock('../src/services/offline/requeueUnconfirmed', () => ({
  requeueUnconfirmedSiteMedia: jest.fn().mockResolvedValue(0)
}));
jest.mock('../src/services/offline/photoStorage', () => ({
  isUploadableFile: jest.fn().mockResolvedValue(true),
  resolvePhotoPath: (p) => p
}));
jest.mock('../src/services/offline/recordMeeting', () => ({
  submitMeetingFully: jest.fn()
}));
jest.mock('../src/services/offline/syncHelpers', () => ({
  resolveSourceSiteTourPictureId: jest.fn()
}));
jest.mock('../src/services/database/repositories/basicInformationRepo', () => ({
  markBasicInformationSynced: jest.fn()
}));
jest.mock('../src/services/database/repositories/meetingsRepo', () => ({
  hardDeleteParticipant: jest.fn(),
  markMeetingCommentSynced: jest.fn(),
  markMeetingParticipantSynced: jest.fn()
}));
jest.mock('../src/services/database/repositories/responsesRepo', () => ({
  hardDeleteEvidence: jest.fn(),
  markResponseEvidenceSynced: jest.fn(),
  markResponseSynced: jest.fn()
}));
jest.mock('../src/services/database/repositories/sitePicturesRepo', () => ({
  hardDeleteSitePicture: jest.fn(),
  hardDeleteSiteTourPicture: jest.fn(),
  markSitePictureSynced: jest.fn(),
  markSiteTourPictureSynced: jest.fn()
}));
jest.mock('../src/services/database/repositories/attendanceRepo', () => ({
  markAttendanceSynced: jest.fn(),
  hasLaterPunchIn: jest.fn()
}));
jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    AssessmentApi: {
      punchIn: jest.fn(),
      punchOut: jest.fn(),
      startAssessment: jest.fn()
    }
  }
}));
jest.mock('../src/services/database/repositories/outboxRepo', () => ({
  MAX_RETRIES: 5,
  peekPending: jest.fn(async () =>
    mockOutbox.filter(
      (r) => ['pending', 'failed', 'syncing'].includes(r.status) && r.retry_count < 5
    )
  ),
  markSyncing: jest.fn(async (id) => {
    mockRow(id).status = 'syncing';
  }),
  markSynced: jest.fn(async (id) => {
    const r = mockRow(id);
    if (r.status === 'syncing') {
      r.status = 'synced';
    }
  }),
  markPending: jest.fn(async (id) => {
    const r = mockRow(id);
    if (r.status === 'syncing') {
      r.status = 'pending';
    }
  }),
  markFailed: jest.fn(async (id, message, { terminal = false, countRetry = true } = {}) => {
    const r = mockRow(id);
    if (r.status === 'synced') {
      return false;
    }
    r.status = 'failed';
    r.terminal = terminal;
    r.last_error = message;
    r.retry_count = terminal ? 5 : countRetry ? r.retry_count + 1 : r.retry_count;
    return true;
  }),
  countUnsyncedForAssessmentBefore: jest.fn(
    async (assessmentId, beforeId) =>
      mockOutbox.filter(
        (r) => r.assessment_id === assessmentId && r.id < beforeId && r.status !== 'synced'
      ).length
  ),
  hasEarlierUnsyncedMeeting: jest.fn().mockResolvedValue(false),
  listStuckForLog: jest.fn().mockResolvedValue([])
}));

const Api = require('../src/services/api').default;
const {
  drainOutbox,
  resetSyncThrottle,
  serverOutageBackoffMs
} = require('../src/services/offline/syncEngine');

const serverError = (status, headers = {}) => {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, headers, data: { message: 'Server Error' } };
  return error;
};

const timeoutError = () => {
  const error = new Error('timeout of 120000ms exceeded');
  error.code = 'ECONNABORTED';
  return error;
};

const queue = (id) => {
  mockOutbox.push({
    id,
    op_type: 'startAssessment',
    assessment_id: `srv-${id}`,
    payload: { serverAssessmentId: id },
    status: 'pending',
    retry_count: 0,
    terminal: false,
    last_error: null
  });
};

beforeEach(() => {
  mockOutbox.length = 0;
  jest.clearAllMocks();
  resetSyncThrottle();
});

describe('circuit breaker', () => {
  test('two consecutive 5xx stop the drain and pause it without burning retries', async () => {
    Api.AssessmentApi.startAssessment.mockRejectedValue(serverError(500));
    [1, 2, 3, 4].forEach(queue);

    const before = Date.now();
    const result = await drainOutbox();

    expect(Api.AssessmentApi.startAssessment).toHaveBeenCalledTimes(2);
    expect(result.aborted).toBe(true);
    expect(result.abortReason).toBe('serverUnavailable');
    // n=2: 15s * 2 = 30s, plus up to 15s of jitter.
    expect(result.pausedUntil - before).toBeGreaterThanOrEqual(30000);
    expect(result.pausedUntil - before).toBeLessThanOrEqual(45000 + 1000);
    expect(mockRow(1).retry_count).toBe(0);
    expect(mockRow(2).retry_count).toBe(0);
    expect(mockRow(3).status).toBe('pending');
  });

  test('timeouts count toward the breaker like 5xx', async () => {
    Api.AssessmentApi.startAssessment.mockRejectedValue(timeoutError());
    [1, 2, 3].forEach(queue);

    const result = await drainOutbox();

    expect(Api.AssessmentApi.startAssessment).toHaveBeenCalledTimes(2);
    expect(result.abortReason).toBe('serverUnavailable');
  });

  test('every non-forced trigger honours the pause; only a forced drain bypasses it', async () => {
    Api.AssessmentApi.startAssessment.mockRejectedValue(serverError(502));
    [1, 2, 3].forEach(queue);
    await drainOutbox();
    Api.AssessmentApi.startAssessment.mockClear();

    const paused = await drainOutbox();
    expect(paused.aborted).toBe(true);
    expect(paused.abortReason).toBe('serverUnavailable');
    expect(paused.pausedUntil).toBeGreaterThan(Date.now());
    expect(Api.AssessmentApi.startAssessment).not.toHaveBeenCalled();

    // The forced pre-wipe flush still tries, and with the count already open a
    // single further 5xx re-trips the breaker at once (n=3).
    const forced = await drainOutbox({ force: true });
    expect(Api.AssessmentApi.startAssessment).toHaveBeenCalledTimes(1);
    expect(forced.abortReason).toBe('serverUnavailable');
  });

  test('a synced row resets the consecutive count', async () => {
    Api.AssessmentApi.startAssessment
      .mockRejectedValueOnce(serverError(500))
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(serverError(500))
      .mockResolvedValueOnce({});
    [1, 2, 3, 4].forEach(queue);

    const result = await drainOutbox();

    expect(result.aborted).toBe(false);
    expect(result.succeeded).toBe(2);
    expect(Api.AssessmentApi.startAssessment).toHaveBeenCalledTimes(4);
  });

  test('a 429 pauses with the rate-limit reason and Retry-After', async () => {
    Api.AssessmentApi.startAssessment.mockRejectedValue(serverError(429, { 'retry-after': '45' }));
    [1, 2].forEach(queue);

    const before = Date.now();
    const result = await drainOutbox();

    expect(Api.AssessmentApi.startAssessment).toHaveBeenCalledTimes(1);
    expect(result.abortReason).toBe('rateLimited');
    expect(result.pausedUntil - before).toBeGreaterThanOrEqual(45000);
    expect((await drainOutbox()).abortReason).toBe('rateLimited');
  });
});

describe('serverOutageBackoffMs', () => {
  test('doubles from 15s and caps at 10 minutes', () => {
    const noJitter = () => 0;
    expect(serverOutageBackoffMs(1, null, noJitter)).toBe(15000);
    expect(serverOutageBackoffMs(2, null, noJitter)).toBe(30000);
    expect(serverOutageBackoffMs(3, null, noJitter)).toBe(60000);
    expect(serverOutageBackoffMs(20, null, noJitter)).toBe(600000);
  });

  test('adds up to 15s of jitter', () => {
    expect(serverOutageBackoffMs(2, null, () => 0.9999)).toBe(30000 + 14998);
  });

  test('honours Retry-After on a 503, capped at 10 minutes', () => {
    const noJitter = () => 0;
    expect(serverOutageBackoffMs(2, serverError(503, { 'retry-after': '120' }), noJitter)).toBe(
      120000
    );
    expect(serverOutageBackoffMs(2, serverError(503, { 'retry-after': '3600' }), noJitter)).toBe(
      600000
    );
    // Retry-After is only honoured on 503.
    expect(serverOutageBackoffMs(2, serverError(500, { 'retry-after': '120' }), noJitter)).toBe(
      30000
    );
  });
});
