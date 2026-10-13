/**
 * Locks the three "the server already holds what this row wanted" rules and the
 * punch-out fence. Each rule matches the backend's rejection text, so a backend
 * copy change would silently retire good rows as terminal; these tests are what
 * notices.
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
  hasLaterPunchIn,
  markAttendanceSynced
} = require('../src/services/database/repositories/attendanceRepo');
const { drainOutbox } = require('../src/services/offline/syncEngine');

const rejection = (status, message) => {
  const error = new Error(message);
  error.response = { status, data: { message } };
  return error;
};

const queue = (id, opType, payload, assessmentId = 'srv-156') => {
  mockOutbox.push({
    id,
    op_type: opType,
    assessment_id: assessmentId,
    payload,
    status: 'pending',
    retry_count: 0,
    terminal: false,
    last_error: null
  });
};

beforeEach(() => {
  mockOutbox.length = 0;
  jest.clearAllMocks();
});

describe('satisfied-intent rules', () => {
  test('punch-in rejected as "already punched in" is treated as done', async () => {
    Api.AssessmentApi.punchIn.mockRejectedValue(
      rejection(400, 'You have already punched in. Please punch out first.')
    );
    queue(1, 'punchIn', { attendanceId: 'a1', serverAssessmentId: 156 });

    const result = await drainOutbox();

    expect(result.succeeded).toBe(1);
    expect(mockRow(1).status).toBe('synced');
    expect(markAttendanceSynced).toHaveBeenCalledWith('a1', null);
  });

  test('punch-out rejected as "must punch in first" is done only when a later punch-in exists here', async () => {
    Api.AssessmentApi.punchOut.mockRejectedValue(
      rejection(400, 'You must punch in before punching out.')
    );
    hasLaterPunchIn.mockResolvedValue(true);
    queue(1, 'punchOut', {
      attendanceId: 'a2',
      serverAssessmentId: 156,
      recordedAt: '2026-09-08T05:30:00.000Z'
    });

    const result = await drainOutbox();

    expect(result.succeeded).toBe(1);
    expect(mockRow(1).status).toBe('synced');
    expect(hasLaterPunchIn).toHaveBeenCalledWith('srv-156', '2026-09-08T05:30:00.000Z');
  });

  test('punch-out rejected as "must punch in first" stays visible when no later punch-in exists', async () => {
    Api.AssessmentApi.punchOut.mockRejectedValue(
      rejection(400, 'You must punch in before punching out.')
    );
    hasLaterPunchIn.mockResolvedValue(false);
    queue(1, 'punchOut', {
      attendanceId: 'a3',
      serverAssessmentId: 156,
      recordedAt: '2026-09-08T05:30:00.000Z'
    });

    const result = await drainOutbox();

    expect(result.failed).toBe(1);
    expect(mockRow(1).status).toBe('failed');
    expect(mockRow(1).terminal).toBe(true);
    expect(mockRow(1).last_error).toMatch(/punch in before punching out/);
    expect(markAttendanceSynced).not.toHaveBeenCalled();
  });

  test('start rejected because the assessment is no longer scheduled is treated as done', async () => {
    Api.AssessmentApi.startAssessment.mockRejectedValue(
      rejection(400, 'Assessment can only be started from scheduled status')
    );
    queue(1, 'startAssessment', { serverAssessmentId: 156 });

    const result = await drainOutbox();

    expect(result.succeeded).toBe(1);
    expect(mockRow(1).status).toBe('synced');
  });
});

describe('punch-out fence', () => {
  test('a punch-out waits behind an earlier unsynced capture and is not sent', async () => {
    Api.AssessmentApi.punchIn.mockRejectedValue(new Error('Network Error'));
    Api.AssessmentApi.punchOut.mockResolvedValue({ data: { id: 9 } });
    queue(1, 'punchIn', { attendanceId: 'a4', serverAssessmentId: 156 });
    queue(2, 'punchOut', {
      attendanceId: 'a5',
      serverAssessmentId: 156,
      recordedAt: '2026-09-08T06:00:00.000Z'
    });

    const result = await drainOutbox();

    expect(Api.AssessmentApi.punchOut).not.toHaveBeenCalled();
    expect(result.deferred).toBe(1);
    expect(mockRow(2).status).toBe('pending');
    expect(mockRow(1).retry_count).toBe(0);
  });

  test('a punch-out queued after a later punch-in does not hold that punch-in back', async () => {
    Api.AssessmentApi.punchOut.mockRejectedValue(new Error('Network Error'));
    Api.AssessmentApi.punchIn.mockResolvedValue({ data: { id: 10 } });
    queue(1, 'punchOut', {
      attendanceId: 'a6',
      serverAssessmentId: 156,
      recordedAt: '2026-09-08T06:00:00.000Z'
    });
    queue(2, 'punchIn', { attendanceId: 'a7', serverAssessmentId: 156 });

    await drainOutbox();

    expect(Api.AssessmentApi.punchIn).toHaveBeenCalled();
    expect(mockRow(2).status).toBe('synced');
  });
});
