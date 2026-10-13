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

/**
 * Drains the outbox in arrival order (FIFO by row id). Each row carries an
 * op_type + payload; the handler for that op_type rebuilds the server request
 * (file paths point at durable copies under DocumentDirectoryPath) and uploads.
 */
export const drainOutbox = async () => {
  if (draining) {
    Logger.info('[sync] drain already in progress, skipping');
    return { processed: 0, succeeded: 0, failed: 0, failures: [] };
  }
  draining = true;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
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
      return { processed: 0, succeeded: 0, failed: 0, failures: [] };
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
        succeeded += 1;
        bump(row.op_type, 'ok');
        Logger.info(`[sync] ok ${row.op_type} id=${row.id} (${Date.now() - itemStart}ms)`);
      } catch (error) {
        // 400/409/422 won't succeed on a retry of the same payload — mark
        // terminal so we stop re-attempting. A missing local file is terminal
        // for the same reason (it can never upload).
        const httpStatus = error?.response?.status;
        const terminal =
          httpStatus === 400 ||
          httpStatus === 409 ||
          httpStatus === 422 ||
          error?.isMissingFile === true;
        // No HTTP response = connectivity/timeout, not a payload problem. Don't
        // count it toward MAX_RETRIES so it keeps retrying on reconnect. A
        // missing file has no response either but IS terminal, so exclude it.
        const isNetworkError = !error?.response && !error?.isMissingFile;
        const responseData = error?.response?.data;
        const fieldError = responseData?.errors
          ? Object.values(responseData.errors)?.[0]?.[0]
          : null;
        const serverMessage =
          fieldError || responseData?.message || error?.message || String(error);
        Logger.warn(
          `[sync] fail ${row.op_type} id=${row.id} (${httpStatus ?? 'no status'})${
            terminal ? ' [terminal]' : ''
          } (${Date.now() - itemStart}ms): ${serverMessage}`,
        );
        await markFailed(row.id, serverMessage, { terminal, countRetry: !isNetworkError });
        failed += 1;
        failures.push({ opType: row.op_type, status: httpStatus ?? null, message: serverMessage });
        bump(row.op_type, 'fail');
      }
    }
  } finally {
    draining = false;
  }
  const breakdown = Object.entries(byType)
    .map(([t, c]) => `${t}:${c.ok}ok/${c.fail}fail`)
    .join(' ');
  Logger.info(
    `[sync] drain done: ${succeeded}/${processed} synced, ${failed} failed (${
      Date.now() - startedAt
    }ms)${breakdown ? ` — ${breakdown}` : ''}`,
  );
  return { processed, succeeded, failed, failures };
};

export default { drainOutbox };
