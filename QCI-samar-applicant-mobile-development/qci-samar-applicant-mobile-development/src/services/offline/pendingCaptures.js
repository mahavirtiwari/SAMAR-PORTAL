import { Logger } from '../../utils/logger';
import {
  dequeueByOpKey,
  listUnsyncedByType,
  MAX_RETRIES,
} from '../database/repositories/outboxRepo';
import { deletePhotoFile, isUploadableFile } from './photoStorage';

// A capture screen's `kind` maps to the outbox op_type that holds its queued
// uploads. Deletes are their own op_types and are intentionally excluded — the
// overlay shows only images still waiting to reach the server.
const OP_TYPE_BY_KIND = { site: 'sitePicture', tour: 'siteTourPicture' };

/**
 * Read-back of offline captures that are queued but not yet on the server.
 *
 * An image captured offline lives only in the outbox until it drains; the
 * server GET and the server-mirror `site_picture_cache` both know nothing about
 * it. This returns those queued captures — rendered from their durable
 * `payload.filePath` (under DocumentDirectoryPath, which the sync engine also
 * uploads from post-reconnect) — so a capture screen can rehydrate them on
 * revisit instead of showing empty slots and tempting a duplicate recapture.
 *
 * Rows whose durable file has gone missing are skipped: they can't upload and
 * can't render.
 */
export const loadPendingCaptures = async ({ assessmentId, kind }) => {
  const opType = OP_TYPE_BY_KIND[kind];
  if (!assessmentId || !opType) {
    return [];
  }

  let rows = [];
  try {
    rows = await listUnsyncedByType(assessmentId, opType);
  } catch (error) {
    Logger.warn('[pending-captures] could not read outbox:', error?.message || error);
    return [];
  }

  const pending = [];
  for (const row of rows) {
    const payload = row.payload;
    if (!payload?.filePath) {
      continue;
    }
    if (!(await isUploadableFile(payload.filePath))) {
      continue;
    }
    pending.push({
      localId: payload.localId,
      opKey: row.op_key,
      type: payload.type, // site pictures: 'interior' | 'exterior'
      title: payload.title, // site tour: user-entered title
      filePath: payload.filePath,
      latitude: payload.latitude,
      longitude: payload.longitude,
      capturedAt: payload.capturedAt,
      status: row.status,
      // "Stuck" = the auto-drain has given up (server-rejected or retry-
      // exhausted). Drives the red "Failed" image badge; everything else that's
      // merely queued or mid-flight stays the amber "Unsaved" badge.
      stuck: row.status === 'failed' && (row.terminal === 1 || row.retry_count >= MAX_RETRIES),
    });
  }
  return pending;
};

/**
 * Drop a queued-but-not-yet-synced capture: it never reached the server, so the
 * user removing it just cancels the pending upload (row + its durable file)
 * rather than queuing a server delete the server can't act on.
 */
export const discardPendingCapture = async ({ opKey, filePath }) => {
  if (!opKey) {
    return;
  }
  await dequeueByOpKey(opKey);
  if (filePath) {
    await deletePhotoFile(filePath);
  }
};

export default { loadPendingCaptures, discardPendingCapture };
