import { Logger } from '../../utils/logger';
import Api from '../api';
import { migrationsReady } from '../database/migrations/runner';
import {
  markFailed,
  markSynced,
  markSyncing,
  peekPending,
} from '../database/repositories/outboxRepo';
import { isUploadableFile } from './photoStorage';
import { cacheLocalCapture } from './sitePictureCache';

// A photo op whose local file is gone/empty can never succeed — its multipart
// POST fails with a no-status network error that, treated as connectivity,
// retries forever. Throw a tagged error so the drain retires it terminally
// with a clear, real reason.
const assertUploadable = async (filePath, label) => {
  if (!(await isUploadableFile(filePath))) {
    const err = new Error(`${label} image file missing or empty (${filePath}) — needs re-capture`);
    err.isMissingFile = true;
    throw err;
  }
};

/**
 * Handlers rebuild the exact request the online path makes (via siteService),
 * threading the stable clientUuid so a replayed upload dedupes server-side
 * instead of inserting a duplicate. Deletes treat 404 (already gone) as success
 * so a double-delete never wedges the queue.
 */
const handlers = {
  sitePicture: async payload => {
    await assertUploadable(payload.filePath, 'sitePicture');
    const result = await Api.SiteApi.addSitePicture({
      assessmentId: payload.serverAssessmentId,
      type: payload.type,
      uri: payload.filePath,
      latitude: payload.latitude,
      longitude: payload.longitude,
      capturedAt: payload.capturedAt,
      clientUuid: payload.localId,
    });
    const created = result?.data?.picture;
    if (created?.id != null) {
      await cacheLocalCapture({
        assessmentId: payload.serverAssessmentId,
        kind: 'site',
        serverPictureId: created.id,
        localUri: payload.filePath,
        title: created.title,
        latitude: created.latitude ?? payload.latitude,
        longitude: created.longitude ?? payload.longitude,
        capturedAt: created.capturedAt ?? payload.capturedAt,
        downloadUrl: created.downloadUrl,
      });
    }
  },

  siteTourPicture: async payload => {
    await assertUploadable(payload.filePath, 'siteTourPicture');
    const result = await Api.SiteApi.addSiteTourPicture({
      assessmentId: payload.serverAssessmentId,
      title: payload.title,
      uri: payload.filePath,
      latitude: payload.latitude,
      longitude: payload.longitude,
      capturedAt: payload.capturedAt,
      clientUuid: payload.localId,
    });
    const created = result?.data?.picture;
    if (created?.id != null) {
      await cacheLocalCapture({
        assessmentId: payload.serverAssessmentId,
        kind: 'tour',
        serverPictureId: created.id,
        localUri: payload.filePath,
        title: created.title ?? payload.title,
        latitude: created.latitude ?? payload.latitude,
        longitude: created.longitude ?? payload.longitude,
        capturedAt: created.capturedAt ?? payload.capturedAt,
        downloadUrl: created.downloadUrl,
      });
    }
  },

  deleteSitePicture: async payload => {
    try {
      await Api.SiteApi.deleteSitePicture({
        assessmentId: payload.serverAssessmentId,
        pictureId: payload.pictureId,
      });
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
    }
  },

  deleteSiteTourPicture: async payload => {
    try {
      await Api.SiteApi.deleteSiteTourPicture({
        assessmentId: payload.serverAssessmentId,
        pictureId: payload.pictureId,
      });
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
    }
  },
};

// Concurrent drains are blocked by this in-process flag. It is deliberately not
// persisted — if the app is killed mid-drain, rows stay 'syncing' until the
// next drain treats them as pending again. The server endpoints are idempotent
// on clientUuid, so the rare duplicate-attempt is safe.
let draining = false;
// Set when the server rate-limits a drain (429) or the circuit breaker below
// trips; drains started before this instant are skipped, so a throttled device
// stops hammering the limit window and a device facing a server outage stops
// re-uploading its whole queue on every reconnect/foreground. `pauseReason` is
// 'rateLimited' | 'serverUnavailable' so the UI can word the pause correctly.
let pausedUntil = 0;
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
const parseRetryAfterMs = error => {
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

// 429 pause: Retry-After, else 30s, clamped so a huge value cannot park sync
// for a day.
const rateLimitPauseMs = error => {
  const ms = parseRetryAfterMs(error);
  return ms == null ? RETRY_AFTER_DEFAULT_MS : Math.min(ms, RETRY_AFTER_MAX_MS);
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
const isTimeoutError = error =>
  !error?.response &&
  !error?.isOffline &&
  !error?.isMissingFile &&
  (error?.code === 'ECONNABORTED' ||
    error?.code === 'ETIMEDOUT' ||
    /timeout/i.test(error?.message || ''));

// A new session starts with a clean slate: a pause opened under one user must
// not silently suppress the next user's drains.
export const resetSyncThrottle = () => {
  pausedUntil = 0;
  pauseReason = null;
  consecutiveServerFailures = 0;
};

const emptyResult = (extra = {}) => ({
  processed: 0,
  succeeded: 0,
  failed: 0,
  failures: [],
  aborted: false,
  abortReason: null,
  pausedUntil: null,
  ...extra,
});

/**
 * Drains the outbox in arrival order (FIFO by row id). Each row carries an
 * op_type + payload; the handler for that op_type rebuilds the server request
 * (file paths point at durable copies under DocumentDirectoryPath) and uploads.
 *
 * Every trigger (reconnect, foreground, header tap) honours a rate-limit /
 * server-outage pause; the result then carries aborted + abortReason +
 * pausedUntil so the UI can say when sync resumes.
 */
export const drainOutbox = async () => {
  if (draining) {
    Logger.info('[sync] drain already in progress, skipping');
    return emptyResult({ aborted: true, abortReason: 'busy' });
  }
  if (Date.now() < pausedUntil) {
    Logger.info(`[sync] paused (${pauseReason}), skipping drain until the window clears`);
    return emptyResult({ aborted: true, abortReason: pauseReason, pausedUntil });
  }
  draining = true;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  // Set on a 429 or a tripped circuit breaker: every further row in this drain
  // would fail the same way and add to the server's load, so stop.
  let aborted = false;
  let abortReason = null;
  // Per-failure detail (op type, HTTP status if the server answered, message)
  // so callers can tell a server rejection from a connectivity problem.
  const failures = [];
  const byType = {};
  const bump = (type, key) => {
    byType[type] = byType[type] || { ok: 0, fail: 0 };
    byType[type][key] += 1;
  };
  const startedAt = Date.now();
  try {
    // Never touch the outbox before its table exists — on a fresh install the
    // schema is still being created when the first drain is triggered.
    await migrationsReady;
    const pending = await peekPending(50);
    if (pending.length === 0) {
      Logger.info('[sync] outbox empty');
      return emptyResult();
    }
    Logger.info(`[sync] draining ${pending.length} outbox rows`);
    for (const row of pending) {
      processed += 1;
      const handler = handlers[row.op_type];
      if (!handler) {
        Logger.warn(`[sync] no handler for op_type=${row.op_type}, skipping`);
        await markFailed(row.id, `No handler for ${row.op_type}`, { terminal: true });
        failed += 1;
        failures.push({
          opType: row.op_type,
          status: null,
          message: `No handler for ${row.op_type}`,
        });
        bump(row.op_type, 'fail');
        continue;
      }
      const itemStart = Date.now();
      Logger.info(
        `[sync] -> ${row.op_type} id=${row.id} assessment=${row.assessment_id} attempt=${
          (row.retry_count ?? 0) + 1
        }`,
      );
      try {
        await markSyncing(row.id);
        await handler(row.payload);
        await markSynced(row.id, { onlyIfSyncing: true });
        consecutiveServerFailures = 0;
        succeeded += 1;
        bump(row.op_type, 'ok');
        Logger.info(`[sync] ok ${row.op_type} id=${row.id} (${Date.now() - itemStart}ms)`);
      } catch (error) {
        const httpStatus = error?.response?.status;
        const responseData = error?.response?.data;
        const fieldError = responseData?.errors
          ? Object.values(responseData.errors)?.[0]?.[0]
          : null;
        const serverMessage =
          fieldError || responseData?.message || error?.message || String(error);
        // 429: the server is throttling this user. Retrying the remaining rows
        // now only extends the throttle window, so put this row back without
        // burning a retry, remember the Retry-After and stop the drain.
        if (httpStatus === 429) {
          await markFailed(row.id, serverMessage, { countRetry: false });
          const pauseMs = rateLimitPauseMs(error);
          pausedUntil = Date.now() + pauseMs;
          pauseReason = 'rateLimited';
          Logger.warn(`[sync] 429: rate-limited, pausing drains for ${pauseMs}ms`);
          aborted = true;
          abortReason = 'rateLimited';
          break;
        }
        // 400/409/422 won't succeed on a retry of the same payload — mark
        // terminal so we stop re-attempting. A missing local file is terminal
        // for the same reason (it can never upload).
        const terminal =
          httpStatus === 400 ||
          httpStatus === 409 ||
          httpStatus === 422 ||
          error?.isMissingFile === true;
        // No HTTP response = connectivity/timeout, not a payload problem. Don't
        // count it toward MAX_RETRIES so it keeps retrying on reconnect. A
        // missing file has no response either but IS terminal, so exclude it.
        const isNetworkError = !error?.response && !error?.isMissingFile;
        // 5xx (server trouble, incl. maintenance 503) is transient: the same
        // payload will succeed later, so it must not burn the retry cap either,
        // or an outage permanently retires good photos.
        const isTransientServer = httpStatus >= 500 && httpStatus <= 599;
        Logger.warn(
          `[sync] fail ${row.op_type} id=${row.id} (${httpStatus ?? 'no status'})${
            terminal ? ' [terminal]' : ''
          } (${Date.now() - itemStart}ms): ${serverMessage}`,
        );
        await markFailed(row.id, serverMessage, {
          terminal,
          countRetry: !isNetworkError && !isTransientServer,
        });
        failed += 1;
        failures.push({ opType: row.op_type, status: httpStatus ?? null, message: serverMessage });
        bump(row.op_type, 'fail');
        // Circuit breaker: a 5xx or a timeout means the server is in trouble.
        // Two in a row stop the drain and pause every trigger with backoff.
        if (isTransientServer || isTimeoutError(error)) {
          consecutiveServerFailures += 1;
          if (consecutiveServerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
            const pauseMs = serverOutageBackoffMs(consecutiveServerFailures, error);
            pausedUntil = Date.now() + pauseMs;
            pauseReason = 'serverUnavailable';
            Logger.warn(
              `[sync] ${consecutiveServerFailures} consecutive server failures, pausing drains for ${pauseMs}ms`,
            );
            aborted = true;
            abortReason = 'serverUnavailable';
            break;
          }
        }
      }
    }
  } finally {
    draining = false;
  }
  const breakdown = Object.entries(byType)
    .map(([t, c]) => `${t}:${c.ok}ok/${c.fail}fail`)
    .join(' ');
  Logger.info(
    `[sync] drain ${aborted ? `aborted (${abortReason})` : 'done'}: ${succeeded}/${processed} synced, ${failed} failed (${
      Date.now() - startedAt
    }ms)${breakdown ? ` — ${breakdown}` : ''}`,
  );
  return {
    processed,
    succeeded,
    failed,
    failures,
    aborted,
    abortReason,
    pausedUntil: aborted ? pausedUntil : null,
  };
};

export default { drainOutbox, resetSyncThrottle };
