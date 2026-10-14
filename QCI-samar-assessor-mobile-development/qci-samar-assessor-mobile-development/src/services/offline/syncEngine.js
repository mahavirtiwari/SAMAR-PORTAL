import { checkInternetConnection } from '../../utils/checkInternetConnection';
import { Logger } from '../../utils/logger';
import Api from '../api';
import { idFromServer } from '../database/ids';
import { migrationsReady } from '../database/migrations/runner';
import { hasLaterPunchIn, markAttendanceSynced } from '../database/repositories/attendanceRepo';
import { markBasicInformationSynced } from '../database/repositories/basicInformationRepo';
import {
  hardDeleteParticipant,
  markMeetingCommentSynced,
  markMeetingParticipantSynced
} from '../database/repositories/meetingsRepo';
import {
  countUnsyncedForAssessmentBefore,
  hasEarlierUnsyncedMeeting,
  listStuckForLog,
  markFailed,
  markPending,
  markSynced,
  markSyncing,
  peekPending
} from '../database/repositories/outboxRepo';
import {
  hardDeleteEvidence,
  markResponseEvidenceSynced,
  markResponseSynced
} from '../database/repositories/responsesRepo';
import {
  hardDeleteSitePicture,
  hardDeleteSiteTourPicture,
  markSitePictureSynced,
  markSiteTourPictureSynced
} from '../database/repositories/sitePicturesRepo';
import { getToken } from '../storage/authStore';
import { isUploadableFile, resolvePhotoPath } from './photoStorage';
import { submitMeetingFully } from './recordMeeting';
import { requeueUnconfirmedSiteMedia } from './requeueUnconfirmed';
import { resolveSourceSiteTourPictureId } from './syncHelpers';

// A photo op whose local file is gone/empty can never succeed — its multipart
// POST fails with a no-status network error that, treated as connectivity,
// retries forever and fences punch-out (wedging the whole assessment). Throw a
// tagged error so the drain retires it terminally with a clear, real reason.
const assertUploadable = async (filePath, label) => {
  if (!(await isUploadableFile(filePath))) {
    const err = new Error(`${label} image file missing or empty (${filePath}) — needs re-capture`);
    err.isMissingFile = true;
    throw err;
  }
};

// A 2xx can still be a failure envelope ({ success:false, message }) — axios does
// not throw on it, so it would otherwise be marked synced with no server id and
// the capture lost. Fail ONLY on an explicit success:false (checked at both the
// top level and under data, and the server's message is at either), so a genuine
// rejection surfaces with the real reason. A merely missing id is NOT treated as
// a failure — some create responses nest the id differently — to avoid
// false-failing an upload the server actually accepted.
const requireServerId = (response, label) => {
  if (response?.success === false || response?.data?.success === false) {
    const baseMessage =
      response?.message || response?.data?.message || `Server rejected the ${label} upload`;
    // The server's message is often generic ("Failed to upload…"); the real cause
    // is in Laravel's `errors` bag (e.g. "The image failed to upload"), and the
    // `reference` code ties it to a backend log line. Fold both into last_error so
    // the stuck-log carries the actionable reason, not just the generic envelope.
    const errors = response?.errors || response?.data?.errors;
    const firstError =
      errors && typeof errors === 'object' ? Object.values(errors)?.[0]?.[0] : null;
    const reference = response?.reference || response?.data?.reference;
    const detail = [firstError, reference && `ref ${reference}`].filter(Boolean).join(' · ');
    const err = new Error(detail ? `${baseMessage} (${detail})` : baseMessage);
    err.response = response;
    throw err;
  }
  // Create endpoints wrap the record under a named key: site pictures and site
  // tour pictures return `data.picture`, evidence `data.evidence`, answers
  // `data.response`. Missing that key left server_id null after a successful
  // upload, and requeueUnconfirmedSiteMedia then re-uploaded the same photos on
  // every drain, forever.
  const data = response?.data;
  return (
    data?.id ||
    response?.id ||
    data?.data?.id ||
    data?.picture?.id ||
    data?.evidence?.id ||
    data?.response?.id ||
    data?.attendance?.id ||
    data?.meeting?.id ||
    null
  );
};

/**
 * Drains the outbox in arrival order (FIFO by row id). Each row carries
 * an op_type + payload; the handler for that op_type rebuilds the
 * server request from the payload (file paths point at durable copies
 * under DocumentDirectoryPath/assessments/...) and uploads.
 *
 * Concurrent drains are blocked by an in-process flag that is set
 * synchronously, before the first await, so two triggers landing in the same
 * tick cannot both pass the check. The flag is deliberately not persisted:
 * if the app is killed mid-drain, the outbox rows stay 'syncing' until the
 * next drain treats them as pending again. We accept this rare
 * duplicate-upload risk because the server endpoints are idempotent for our
 * captures (or close enough).
 */
let draining = false;
// Set when the server rate-limits a drain or the circuit breaker below trips;
// drains started before this instant are skipped so a throttled device stops
// hammering the limit window and a device facing a server outage stops
// re-uploading its whole queue on every trigger. `pauseReason` says which one
// ('rateLimited' | 'serverUnavailable') so the UI can word the pause correctly.
let rateLimitedUntil = 0;
let pauseReason = null;
// Consecutive 5xx / timed-out rows across drains (module level, so the backoff
// keeps growing while an outage lasts). Reset by any row that syncs.
let consecutiveServerFailures = 0;

const RETRY_AFTER_DEFAULT_MS = 30000;
const RETRY_AFTER_MAX_MS = 5 * 60 * 1000;
// Circuit breaker: after this many consecutive server failures the drain stops
// and pauses for min(10 min, 15s * 2^(n-1)) plus up to 15s of jitter, so a fleet
// of devices does not come back to a recovering server in lockstep.
const CIRCUIT_BREAKER_THRESHOLD = 2;
const BREAKER_BASE_MS = 15000;
const BREAKER_MAX_MS = 10 * 60 * 1000;
const BREAKER_JITTER_MS = 15000;

// Retry-After as milliseconds, or null when absent/unparseable. It may be
// delta-seconds or an HTTP-date.
const parseRetryAfterMs = (error) => {
  const header = error?.response?.headers?.['retry-after'];
  if (header == null || header === '') {
    return null;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return seconds > 0 ? seconds * 1000 : null;
  }
  const until = Date.parse(header);
  if (!Number.isFinite(until)) {
    return null;
  }
  const ms = until - Date.now();
  return ms > 0 ? ms : null;
};

// 429 pause. Clamped so a huge value cannot park sync for a day.
const retryAfterMs = (error) => {
  const ms = parseRetryAfterMs(error);
  if (ms == null) {
    return RETRY_AFTER_DEFAULT_MS;
  }
  return Math.min(ms, RETRY_AFTER_MAX_MS);
};

/**
 * Circuit-breaker pause after `failures` consecutive server failures:
 * min(10 min, 15s * 2^(n-1)) + random(0, 15s). A 503 carrying Retry-After is
 * honoured (never paused for less than it asks, still capped at 10 min).
 * Exported for tests; `random` is injectable for the same reason.
 */
export const serverOutageBackoffMs = (failures, error, random = Math.random) => {
  const exponent = Math.max(0, failures - 1);
  const base = Math.min(BREAKER_MAX_MS, BREAKER_BASE_MS * 2 ** exponent);
  let delay = base + Math.floor(random() * BREAKER_JITTER_MS);
  if (error?.response?.status === 503) {
    const asked = parseRetryAfterMs(error);
    if (asked != null) {
      delay = Math.max(delay, Math.min(asked, BREAKER_MAX_MS));
    }
  }
  return delay;
};

// A request that reached for the server and got no answer in time. Offline
// refusals and missing local files are not server trouble.
const isTimeoutError = (error) =>
  !error?.response &&
  !error?.isOffline &&
  !error?.isMissingFile &&
  (error?.code === 'ECONNABORTED' ||
    error?.code === 'ETIMEDOUT' ||
    /timeout/i.test(error?.message || ''));

// A new session starts with a clean slate: a throttle window opened under one
// user must not silently suppress the next user's post-login drain.
export const resetSyncThrottle = () => {
  rateLimitedUntil = 0;
  pauseReason = null;
  consecutiveServerFailures = 0;
};

// Clears the in-process drain latch. A drain in flight when the app is swiped
// from recents (Android keeps the JS context alive and re-mounts) leaves this
// flag set forever, so every later drain returns "already in progress" and sync
// wedges until the app is force-killed. Called at session boundaries — app
// startup and login — where any prior drain is stale, so clearing it is safe;
// the server dedupes on clientUuid, so a rare concurrent upload is idempotent.
export const resetDrainLatch = () => {
  // Only the flag is reset. A genuinely in-flight drain keeps its promise so
  // later callers still join its real outcome; a dead one settles and clears
  // its own handle, or is simply replaced by the next drain.
  draining = false;
};

// The in-flight drain's promise, so a second caller (a Sync Now tap during the
// reconnect auto-sync) joins it and gets the real outcome instead of an instant
// "busy" that the header used to render as a false "All clear".
let currentDrain = null;

const emptyResult = (extra = {}) => ({
  processed: 0,
  succeeded: 0,
  failed: 0,
  deferred: 0,
  failures: [],
  aborted: false,
  abortReason: null,
  pausedUntil: null,
  ...extra
});

const handlers = {
  punchIn: async (payload) => {
    if (payload.selfiePath) {
      await assertUploadable(payload.selfiePath, 'punchIn selfie');
    }
    const formData = new FormData();
    if (payload.selfiePath) {
      formData.append('selfie', {
        uri: resolvePhotoPath(payload.selfiePath),
        type: 'image/jpeg',
        name: 'selfie.jpg'
      });
    }
    if (payload.attendanceId) {
      formData.append('clientUuid', payload.attendanceId);
    }
    if (payload.recordedAt) {
      formData.append('recordedAt', payload.recordedAt);
    }
    if (payload.latitude != null) {
      formData.append('latitude', String(payload.latitude));
    }
    if (payload.longitude != null) {
      formData.append('longitude', String(payload.longitude));
    }
    if (payload.deviceMetadata?.deviceModel) {
      formData.append('deviceMetadata[deviceModel]', payload.deviceMetadata.deviceModel);
    }
    if (payload.deviceMetadata?.osVersion) {
      formData.append('deviceMetadata[osVersion]', payload.deviceMetadata.osVersion);
    }
    if (payload.deviceMetadata?.appVersion) {
      formData.append('deviceMetadata[appVersion]', payload.deviceMetadata.appVersion);
    }

    let response;
    try {
      response = await Api.AssessmentApi.punchIn({
        assessmentId: payload.serverAssessmentId,
        formData
      });
    } catch (error) {
      // "Already punched in" = the server already holds an open punch-in for
      // this assessor (duplicate capture, or a lost-response replay whose
      // uuid was regenerated, so clientUuid dedup can't match). The intent is
      // satisfied — treat as done so the punch-out fence releases instead of
      // wedging the whole queue behind a terminal row.
      const status = error?.response?.status;
      const message = error?.response?.data?.message || '';
      if (status === 400 && /already punched in/i.test(message)) {
        Logger.info('[sync] punchIn already recorded on server — treating as done');
        await markAttendanceSynced(payload.attendanceId, null);
        return;
      }
      throw error;
    }
    await markAttendanceSynced(payload.attendanceId, response?.data?.id || response?.id);
  },

  punchOut: async (payload) => {
    if (payload.selfiePath) {
      await assertUploadable(payload.selfiePath, 'punchOut selfie');
    }
    const formData = new FormData();
    if (payload.selfiePath) {
      formData.append('selfie', {
        uri: resolvePhotoPath(payload.selfiePath),
        type: 'image/jpeg',
        name: 'selfie_punchout.jpg'
      });
    }
    if (payload.attendanceId) {
      formData.append('clientUuid', payload.attendanceId);
    }
    if (payload.recordedAt) {
      formData.append('recordedAt', payload.recordedAt);
    }
    if (payload.latitude != null) {
      formData.append('latitude', String(payload.latitude));
    }
    if (payload.longitude != null) {
      formData.append('longitude', String(payload.longitude));
    }
    if (payload.deviceMetadata?.deviceModel) {
      formData.append('deviceMetadata[deviceModel]', payload.deviceMetadata.deviceModel);
    }
    if (payload.deviceMetadata?.osVersion) {
      formData.append('deviceMetadata[osVersion]', payload.deviceMetadata.osVersion);
    }
    if (payload.deviceMetadata?.appVersion) {
      formData.append('deviceMetadata[appVersion]', payload.deviceMetadata.appVersion);
    }

    let response;
    try {
      response = await Api.AssessmentApi.punchOut({
        assessmentId: payload.serverAssessmentId,
        formData
      });
    } catch (error) {
      // "Must punch in before punching out" = the server holds no open
      // punch-in for this assessor. When this device has ALREADY recorded a
      // later punch-in, this punch-out was queued against a stale status (a
      // reset wiped the open punch-in) and has been superseded: the intent is
      // satisfied, so treat it as done rather than retiring it terminal, which
      // would fence every later punch-out behind a row that can never succeed.
      // Without a later punch-in the rejection is real (e.g. the punch-in was
      // discarded) and must stay visible in the stuck list.
      const status = error?.response?.status;
      const message = error?.response?.data?.message || '';
      if (
        status === 400 &&
        /punch in before punching out/i.test(message) &&
        (await hasLaterPunchIn(idFromServer(payload.serverAssessmentId), payload.recordedAt))
      ) {
        Logger.warn('[sync] punchOut superseded by a later punch-in, treating as done');
        await markAttendanceSynced(payload.attendanceId, null);
        return;
      }
      throw error;
    }
    await markAttendanceSynced(payload.attendanceId, response?.data?.id || response?.id);
  },

  startAssessment: async (payload) => {
    try {
      await Api.AssessmentApi.startAssessment(payload.serverAssessmentId);
    } catch (error) {
      // The server only allows start from 'scheduled'. If it has already been
      // started (here on reconnect, or by another device), treat the op as done
      // rather than retrying forever.
      const status = error?.response?.status;
      const message = error?.response?.data?.message || '';
      if (status === 400 && /scheduled status/i.test(message)) {
        Logger.info('[sync] startAssessment already started — treating as done');
        return;
      }
      throw error;
    }
  },

  'meeting:opening': async (payload) => meetingHandler(payload, 'opening'),
  'meeting:closing': async (payload) => meetingHandler(payload, 'closing'),

  sitePicture: async (payload) => {
    await assertUploadable(payload.filePath, 'sitePicture');
    const formData = new FormData();
    formData.append(
      'title',
      payload.type === 'interior' ? 'Site Interior Picture' : 'Site Exterior Picture'
    );
    formData.append('image', {
      uri: resolvePhotoPath(payload.filePath),
      type: 'image/jpeg',
      name: `${payload.type}.jpg`
    });
    if (payload.localId) {
      formData.append('clientUuid', payload.localId);
    }
    if (payload.latitude != null) {
      formData.append('latitude', String(payload.latitude));
    }
    if (payload.longitude != null) {
      formData.append('longitude', String(payload.longitude));
    }
    if (payload.capturedAt) {
      formData.append('capturedAt', payload.capturedAt);
    }
    const response = await Api.SiteApi.addSitePicture({
      assessmentId: payload.serverAssessmentId,
      formData
    });
    await markSitePictureSynced(payload.localId, requireServerId(response, 'site picture'));
  },

  siteTourPicture: async (payload) => {
    await assertUploadable(payload.filePath, 'siteTourPicture');
    const formData = new FormData();
    formData.append('image', {
      uri: resolvePhotoPath(payload.filePath),
      type: 'image/jpeg',
      name: 'tour.jpg'
    });
    if (payload.localId) {
      formData.append('clientUuid', payload.localId);
    }
    if (payload.title) {
      formData.append('title', payload.title);
    }
    if (payload.latitude != null) {
      formData.append('latitude', String(payload.latitude));
    }
    if (payload.longitude != null) {
      formData.append('longitude', String(payload.longitude));
    }
    if (payload.capturedAt) {
      formData.append('capturedAt', payload.capturedAt);
    }
    const response = await Api.SiteApi.addSiteTourPicture({
      assessmentId: payload.serverAssessmentId,
      formData
    });
    await markSiteTourPictureSynced(
      payload.localId,
      requireServerId(response, 'site tour picture')
    );
  },

  response: async (payload) => {
    const response = await Api.AssessmentResponseApi.AddAssessmentResponse({
      assessmentId: payload.serverAssessmentId,
      questionId: payload.questionServerId,
      data: {
        selectedOption: payload.optionId,
        assessorRemarks: payload.remarks
      }
    });
    await markResponseSynced(payload.responseLocalId, response?.data?.id || response?.id);
  },

  responseEvidence: async (payload) => {
    await assertUploadable(payload.filePath, 'responseEvidence');
    // The picker stamps `server_id || localId`, so an offline-captured source
    // picture leaves a LOCAL text id in the payload. The server validates
    // integer+exists and 422s it — terminal, evidence lost. Resolve to the
    // picture's server id here (its own sync runs earlier in the FIFO); if the
    // picture still hasn't synced, defer this row instead of uploading a
    // payload that can only be rejected.
    const source = await resolveSourceSiteTourPictureId(payload.sourceSiteTourPictureId);
    if (source.unresolved) {
      const err = new Error('source site tour picture not yet synced — deferring evidence');
      err.isDeferred = true;
      throw err;
    }
    const formData = new FormData();
    formData.append('file', {
      uri: resolvePhotoPath(payload.filePath),
      type: 'image/jpeg',
      name: 'evidence.jpg'
    });
    // Site-tour picks carry the picture's title as description + its id as
    // sourceSiteTourPictureId — the stable link the picker re-matches on after a
    // reload. Camera captures have neither.
    formData.append('description', payload.description ?? '');
    if (source.serverId != null) {
      formData.append('sourceSiteTourPictureId', String(source.serverId));
    }
    if (payload.evidenceId) {
      formData.append('clientUuid', payload.evidenceId);
    }
    if (payload.latitude != null) {
      formData.append('latitude', String(payload.latitude));
    }
    if (payload.longitude != null) {
      formData.append('longitude', String(payload.longitude));
    }
    if (payload.capturedAt) {
      formData.append('capturedAt', payload.capturedAt);
    }
    const response = await Api.AssessmentResponseApi.addResponseEvidence({
      assessmentId: payload.serverAssessmentId,
      questionId: payload.questionServerId,
      data: formData
    });
    await markResponseEvidenceSynced(payload.evidenceId, requireServerId(response, 'evidence'));
  },

  basicInformation: async (payload) => {
    const response = await Api.BasicInformationApi.addBasicInformation({
      assessmentId: payload.serverAssessmentId,
      data: payload.data
    });
    await markBasicInformationSynced(
      idFromServer(payload.serverAssessmentId),
      response?.data?.id || response?.id
    );
  },

  parameterAllocation: async (payload) => {
    await Api.AssessmentParameterApi.bulkAssignParameters({
      assessmentId: payload.serverAssessmentId,
      data: payload.data
    });
  },

  // --- Deletes -----------------------------------------------------------
  // Each calls the existing API delete then removes the soft-deleted local
  // row. A 404 (already gone on the server) is treated as success so a
  // double-delete / already-removed item doesn't wedge the outbox.
  sitePictureDelete: async (payload) => {
    try {
      await Api.SiteApi.deleteSitePicture({
        assessmentId: payload.serverAssessmentId,
        pictureId: payload.pictureId
      });
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
    }
    if (payload.localId) {
      await hardDeleteSitePicture(payload.localId);
    }
  },

  siteTourPictureDelete: async (payload) => {
    try {
      await Api.SiteApi.deleteSiteTourPicture({
        assessmentId: payload.serverAssessmentId,
        pictureId: payload.pictureId
      });
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
    }
    if (payload.localId) {
      await hardDeleteSiteTourPicture(payload.localId);
    }
  },

  responseEvidenceDelete: async (payload) => {
    try {
      await Api.AssessmentResponseApi.deleteResponseEvidence({
        assessmentId: payload.serverAssessmentId,
        questionId: payload.questionServerId,
        evidenceId: payload.evidenceId
      });
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
    }
    if (payload.localId) {
      await hardDeleteEvidence(payload.localId);
    }
  },

  // --- Meeting edits -----------------------------------------------------
  meetingParticipantAdd: async (payload) => {
    const response = await Api.MeetingApi.addExternalParticipant({
      assessmentId: payload.serverAssessmentId,
      type: payload.type,
      data: { name: payload.name, designation: payload.designation }
    });
    if (payload.localParticipantId) {
      await markMeetingParticipantSynced(
        payload.localParticipantId,
        response?.data?.id || response?.id
      );
    }
  },

  meetingParticipantDelete: async (payload) => {
    try {
      await Api.MeetingApi.deleteExternalParticipant({
        assessmentId: payload.serverAssessmentId,
        type: payload.type,
        participantId: payload.participantId
      });
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
    }
    if (payload.localId) {
      await hardDeleteParticipant(payload.localId);
    }
  },

  meetingCommentUpsert: async (payload) => {
    const response = await Api.MeetingApi.addComment({
      assessmentId: payload.serverAssessmentId,
      type: payload.type,
      data: { comment: payload.comment }
    });
    if (payload.localCommentId) {
      await markMeetingCommentSynced(payload.localCommentId, response?.data?.id || response?.id);
    }
  }
};

const meetingHandler = async (payload, type) => {
  if (payload.imagePath) {
    await assertUploadable(payload.imagePath, `meeting:${type} image`);
  }
  // Three sequential API calls: meeting -> comment -> per-participant.
  await submitMeetingFully({
    serverAssessmentId: payload.serverAssessmentId,
    type,
    imagePath: payload.imagePath,
    latitude: payload.latitude,
    longitude: payload.longitude,
    conductedAt: payload.conductedAt,
    comment: payload.comment,
    participants: payload.participants,
    recordingLinks: payload.recordingLinks,
    persistedMeetingId: payload.meetingLocalId
  });
};

/**
 * Every trigger (interval, reconnect, foreground, post-login kick, header tap,
 * stuck-items Retry, capture-time flush) honours a rate-limit / server-outage
 * pause: the UI reports the pause and when sync resumes, instead of each tap
 * sending another burst into a throttled or failing server. `force` is only
 * for the pre-wipe flush on manual logout: a silent no-op right before the wipe
 * would destroy captures without a single upload attempt.
 */
export const drainOutbox = (opts = {}) => {
  if (draining && currentDrain) {
    Logger.info('[sync] drain already in progress, joining it');
    // `joined` tells the caller this drain's row snapshot predates them, so a
    // row they just queued was not attempted and one follow-up drain is due.
    return currentDrain.then((result) => ({ ...result, joined: true }));
  }
  const thisDrain = runDrain(opts).finally(() => {
    // Only release our own handle: a latch reset or a later drain may have
    // replaced it, and clearing theirs would strand later joiners.
    if (currentDrain === thisDrain) {
      currentDrain = null;
    }
  });
  currentDrain = thisDrain;
  return thisDrain;
};

const runDrain = async ({ force = false } = {}) => {
  if (draining) {
    Logger.info('[sync] drain already in progress, skipping');
    return emptyResult({ aborted: true, abortReason: 'busy' });
  }
  if (!force && Date.now() < rateLimitedUntil) {
    Logger.info(
      `[sync] paused (${pauseReason || 'rateLimited'}), skipping drain until the window clears`
    );
    return emptyResult({
      aborted: true,
      abortReason: pauseReason || 'rateLimited',
      pausedUntil: rateLimitedUntil
    });
  }
  // The flag must be taken before ANY await. An await between the check and
  // the set let two triggers in the same tick both pass and run concurrent
  // drains, uploading every row twice and racing the server's idempotency.
  draining = true;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  // Punch-outs held back by the sync fence this pass — not failures, but the
  // caller's "all done?" check must see them (succeeded+failed won't add up).
  let deferred = 0;
  // Per-failure detail (op type, HTTP status if the server answered, message)
  // so callers can tell a server rejection from a connectivity problem and
  // show the real reason instead of a blanket "check connection".
  const failures = [];
  // Per-op-type tally so the summary shows WHICH kind of capture is stuck
  // (e.g. responseEvidence:0ok/5fail) instead of just a total.
  const byType = {};
  const bump = (type, key) => {
    byType[type] = byType[type] || { ok: 0, fail: 0, deferred: 0 };
    byType[type][key] += 1;
  };
  const startedAt = Date.now();
  // Set on a lost session, a 429 or a tripped circuit breaker: every further row in this drain would fail
  // the same way, so stop instead of burning through the queue and, on a lost
  // session, re-triggering a forced logout per row.
  let aborted = false;
  let abortReason = null;
  try {
    // No logged-in user, nothing to drain against. Without this guard, a drain
    // triggered while logged out (interval tick, foreground, reconnect) hits
    // userClient with no access token, which re-fires a forced logout on every
    // trigger and re-shows the unsynced-items alert in a loop, blocking login.
    const accessToken = await getToken('accessToken');
    if (!accessToken?.token) {
      Logger.info('[sync] no access token, skipping drain');
      return emptyResult({ aborted: true, abortReason: 'unauthorized' });
    }
    // Never touch the outbox before its table exists — on a fresh install
    // the schema is still being created when the first drain is triggered.
    await migrationsReady;
    // Recover any capture marked 'synced' with no server id (the silent-sync
    // bug): re-queue it from its on-device file so this drain re-uploads it,
    // instead of it sitting device-only forever while the server lacks it.
    await requeueUnconfirmedSiteMedia();
    // Offline, every request is refused by the client's offline gate before it
    // leaves the phone, so a drain would mark all rows failed for nothing and the
    // header would report "N items failed" for what is simply no connection.
    if (!(await checkInternetConnection())) {
      const waiting = (await peekPending(500)).length;
      if (waiting > 0) {
        Logger.info(`[sync] offline — ${waiting} outbox row(s) wait for reconnect`);
        return emptyResult({ offline: true, pending: waiting });
      }
    }
    // Drain in passes until the outbox is empty or a pass makes no progress.
    // A single capped pass meant a large offline backlog needed repeated manual
    // syncs, each reporting "Sync complete" with work still queued. Every row is
    // attempted at most once per drain (the attempted set), so a failing row
    // cannot hot-loop or burn extra retries within one drain; rows held back by
    // a fence/deferral are re-evaluated each pass so they release as the rows
    // blocking them sync.
    const attempted = new Set();
    const MAX_PASSES = 20;
    for (let passNo = 0; passNo < MAX_PASSES && !aborted; passNo++) {
      const pending = (await peekPending(500)).filter((row) => !attempted.has(row.id));
      if (pending.length === 0) {
        if (passNo === 0) {
          Logger.info('[sync] outbox empty');
          // Surface stuck rows the drain skips (terminal / retry-exhausted) with
          // their stored reason, so "sync error but no logs" shows the real cause.
          const stuck = await listStuckForLog();
          for (const r of stuck) {
            Logger.warn(
              `[sync][stuck] ${r.op_type} status=${r.status} retries=${r.retry_count}${
                r.terminal ? ' [terminal]' : ''
              }: ${r.err || '(no error recorded)'}`
            );
          }
        }
        break;
      }
      Logger.info(`[sync] drain pass ${passNo + 1}: ${pending.length} outbox rows`);
      let passSucceeded = 0;
      // Deferred = the still-waiting set as of the latest pass, not a
      // cumulative tally (a row re-deferred across passes is one wait, not N).
      deferred = 0;
      for (const row of pending) {
        const handler = handlers[row.op_type];
        if (!handler) {
          Logger.warn(`[sync] no handler for op_type=${row.op_type}, skipping`);
          attempted.add(row.id);
          processed += 1;
          if (!(await markFailed(row.id, `No handler for ${row.op_type}`))) {
            continue;
          }
          failed += 1;
          failures.push({
            opType: row.op_type,
            status: null,
            message: `No handler for ${row.op_type}`
          });
          bump(row.op_type, 'fail');
          continue;
        }
        // Punch-out sync fence: the server lets the web user submit for QC the
        // moment every assessor shows punched OUT, and from then on it rejects
        // any late field data permanently. Holding punch-out until everything
        // captured BEFORE it has synced makes "punched out on server" mean
        // "all field data up to that punch-out is on the server". Only earlier
        // rows fence it — punch events must replay in capture order, and a row
        // queued after this punch-out (the next punch-in cycle) waiting on it
        // would otherwise deadlock the queue.
        if (row.op_type === 'punchOut') {
          const blockedBy = await countUnsyncedForAssessmentBefore(row.assessment_id, row.id);
          if (blockedBy > 0) {
            Logger.info(
              `[sync] punchOut deferred — ${blockedBy} earlier item(s) for this assessment not yet synced`
            );
            deferred += 1;
            bump(row.op_type, 'deferred');
            continue;
          }
        }
        // Meeting-edit fence: comment/participant edits are keyed by assessment +
        // type, so calling them before their parent meeting exists server-side
        // gets a real "meeting not found" 4xx back, which the catch below would
        // otherwise mark terminal, permanently wedging the item even once the
        // meeting itself later syncs. Hold these back while an earlier, still
        // non-terminal meeting:<type> row for this assessment hasn't synced yet.
        if (row.op_type === 'meetingCommentUpsert' || row.op_type === 'meetingParticipantAdd') {
          const meetingType = row.payload?.type;
          const blockedByMeeting =
            meetingType &&
            (await hasEarlierUnsyncedMeeting(row.assessment_id, `meeting:${meetingType}`, row.id));
          if (blockedByMeeting) {
            Logger.info(
              `[sync] ${row.op_type} deferred: meeting:${meetingType} not yet synced for this assessment`
            );
            deferred += 1;
            bump(row.op_type, 'deferred');
            continue;
          }
        }
        const itemStart = Date.now();
        processed += 1;
        Logger.info(
          `[sync] -> ${row.op_type} id=${row.id} assessment=${row.assessment_id} attempt=${
            (row.retry_count ?? 0) + 1
          }`
        );
        try {
          await markSyncing(row.id);
          await handler(row.payload);
          await markSynced(row.id);
          attempted.add(row.id);
          consecutiveServerFailures = 0;
          succeeded += 1;
          passSucceeded += 1;
          bump(row.op_type, 'ok');
          Logger.info(`[sync] ok ${row.op_type} id=${row.id} (${Date.now() - itemStart}ms)`);
        } catch (error) {
          // A handler-level deferral (e.g. evidence whose source site-tour
          // picture hasn't synced yet) — not a failure and not an attempt:
          // revert to pending and let a later pass pick it up once its
          // blocker has synced.
          if (error?.isDeferred === true) {
            await markPending(row.id);
            deferred += 1;
            bump(row.op_type, 'deferred');
            Logger.info(`[sync] ${row.op_type} id=${row.id} deferred: ${error.message}`);
            continue;
          }
          const httpStatus = error?.response?.status;
          // Session gone: not a payload problem and not this row's fault. Leave
          // it pending for the next logged-in drain and stop now, otherwise every
          // remaining row fails the same way and each one fires another forced
          // logout (the stacked unsynced-items alerts). A 401 response is the
          // rare shape; the common one is userClient rejecting with a bare Error
          // tagged sessionLost after it dispatched the logout itself. The keychain
          // re-read backstops a logout that already completed, and only runs when
          // the server did not answer: any response at all proves the session.
          const sessionLost =
            error?.sessionLost === true ||
            httpStatus === 401 ||
            (!error?.response && !error?.isOffline && !(await getToken('accessToken'))?.token);
          if (sessionLost) {
            await markPending(row.id);
            Logger.warn('[sync] session invalid, aborting drain');
            aborted = true;
            abortReason = 'unauthorized';
            break;
          }
          // 429: the server is throttling this user. Retrying the remaining rows
          // now only extends the throttle window, so leave this row pending,
          // remember the retry-after, and stop the drain.
          if (httpStatus === 429) {
            await markPending(row.id);
            rateLimitedUntil = Date.now() + retryAfterMs(error);
            pauseReason = 'rateLimited';
            Logger.warn(
              `[sync] 429: rate-limited, pausing drains for ${rateLimitedUntil - Date.now()}ms`
            );
            aborted = true;
            abortReason = 'rateLimited';
            break;
          }
          // 400 (request/business validation), 403 (not this user's item),
          // 404 (the parent no longer exists; delete handlers swallow their own
          // 404 before reaching here), 409 (business-rule lock) and 422
          // (validation) won't succeed on a retry of the same payload — mark
          // terminal so we stop re-attempting.
          // A missing/empty local file (flagged by assertUploadable) can never
          // upload — retire it terminally with its real reason rather than
          // letting it masquerade as a connectivity problem and retry forever.
          const terminal =
            httpStatus === 400 ||
            httpStatus === 403 ||
            httpStatus === 404 ||
            httpStatus === 409 ||
            httpStatus === 422 ||
            error?.isMissingFile === true;
          // No HTTP response = connectivity/timeout, not a payload problem. Don't
          // count it toward MAX_RETRIES — it should keep retrying on reconnect
          // and stay visible in the pending badge, not silently retire. A missing
          // file has no response either but IS terminal, so exclude it here.
          const isNetworkError = !error?.response && !error?.isMissingFile;
          // 5xx (server trouble, incl. maintenance 503) is transient: retrying
          // the same payload later is exactly right, so it must not burn the
          // retry cap either. A burst of server trouble was permanently
          // retiring good rows into the stuck list.
          const isTransientServer = httpStatus >= 500 && httpStatus <= 599;
          // Circuit-breaker input: a 5xx or a timeout means the server is in
          // trouble, not this payload. Other outcomes leave the count alone;
          // only a synced row proves the server healthy again.
          const tripsBreaker = isTransientServer || isTimeoutError(error);
          // Prefer the per-field validation reason (Laravel 422 puts it under
          // errors.<field>[0], e.g. "The comment must be at least 1 character")
          // over the generic top-level "Validation failed" — the field message is
          // what tells the assessor how to fix a stuck item in the review modal.
          const responseData = error?.response?.data;
          const fieldError = responseData?.errors
            ? Object.values(responseData.errors)?.[0]?.[0]
            : null;
          const serverMessage =
            fieldError || responseData?.message || error?.message || String(error);
          Logger.warn(
            `[sync] fail ${row.op_type} id=${row.id} (${httpStatus ?? 'no status'})${
              terminal ? ' [terminal]' : ''
            } (${Date.now() - itemStart}ms): ${serverMessage}`
          );
          const stamped = await markFailed(row.id, serverMessage, {
            terminal,
            countRetry: !isNetworkError && !isTransientServer
          });
          attempted.add(row.id);
          // A row another attempt already landed keeps its 'synced' and is not
          // a failure of this drain; counting it would make the toast say
          // "N failed" over a badge that shows nothing stuck.
          if (!stamped) {
            continue;
          }
          failed += 1;
          failures.push({
            opType: row.op_type,
            status: httpStatus ?? null,
            message: serverMessage
          });
          bump(row.op_type, 'fail');
          if (tripsBreaker) {
            consecutiveServerFailures += 1;
            if (consecutiveServerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
              // The server is down or overloaded: uploading the rest of the
              // queue now only adds to its load. Pause every drain trigger with
              // exponential backoff; the row stays failed without burning a
              // retry, so good photos are never retired by an outage.
              const pauseMs = serverOutageBackoffMs(consecutiveServerFailures, error);
              rateLimitedUntil = Date.now() + pauseMs;
              pauseReason = 'serverUnavailable';
              Logger.warn(
                `[sync] ${consecutiveServerFailures} consecutive server failures, pausing drains for ${pauseMs}ms`
              );
              aborted = true;
              abortReason = 'serverUnavailable';
              break;
            }
          }
        }
      }
      // No forward progress this pass — nothing a further pass could unblock.
      if (aborted || passSucceeded === 0) {
        break;
      }
    }
  } finally {
    draining = false;
  }
  const breakdown = Object.entries(byType)
    .map(([t, c]) => `${t}:${c.ok}ok/${c.fail}fail${c.deferred ? `/${c.deferred}deferred` : ''}`)
    .join(' ');
  Logger.info(
    `[sync] drain ${aborted ? `aborted (${abortReason})` : 'done'}: ${succeeded}/${processed} synced, ${failed} failed (${
      Date.now() - startedAt
    }ms)${breakdown ? ` — ${breakdown}` : ''}`
  );
  return {
    processed,
    succeeded,
    failed,
    deferred,
    failures,
    aborted,
    abortReason,
    pausedUntil:
      abortReason === 'rateLimited' || abortReason === 'serverUnavailable' ? rateLimitedUntil : null
  };
};
